// src/components/logger/DailyLoggerView.tsx
// Vista principal de registro del día seleccionado

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, FileText, Trash2 } from 'lucide-react';
import { useAppData } from '../../db/useAppData';
import { SwimLoggerCard } from './SwimLoggerCard';
import { StrengthLoggerCard } from './StrengthLoggerCard';
import { DailyWorkoutLog, SwimSession, StrengthEntry } from '../../types/models';
import { formatFriendlyDate, addDaysToDateKey, toLocalDateKey } from '../../utils/dates';

export const DailyLoggerView: React.FC = () => {
  const {
    selectedDateKey,
    setSelectedDateKey,
    logsMap,
    exercises,
    settings,
    saveCurrentLog,
    deleteCurrentLog,
    logs
  } = useAppData();

  const [savedNotification, setSavedNotification] = useState<boolean>(false);

  // Log local en edición para el día seleccionado
  const activeExistingLog = logsMap.get(selectedDateKey);

  const [currentSwim, setCurrentSwim] = useState<SwimSession | undefined>(activeExistingLog?.swim);
  const [currentStrength, setCurrentStrength] = useState<StrengthEntry[]>(activeExistingLog?.strength || []);
  const [currentNotes, setCurrentNotes] = useState<string>(activeExistingLog?.notes || '');

  // Sincronizar cuando cambia la fecha seleccionada
  useEffect(() => {
    const log = logsMap.get(selectedDateKey);
    setCurrentSwim(log?.swim);
    setCurrentStrength(log?.strength || []);
    setCurrentNotes(log?.notes || '');
  }, [selectedDateKey, logsMap]);

  // Historial de pesos más recientes usados para cada ejercicio
  const lastUsedWeights = useMemo(() => {
    const map = new Map<string, number>();
    for (const log of logs) {
      for (const st of log.strength) {
        if (st.mode === 'sets') {
          for (const s of st.sets) {
            if (s.weightKg > 0) map.set(st.exerciseId, s.weightKg);
          }
        } else if (st.quickWeightKg && st.quickWeightKg > 0) {
          map.set(st.exerciseId, st.quickWeightKg);
        }
      }
    }
    return map;
  }, [logs]);

  // Guardado reactivo automático
  const handleSave = async (
    newSwim: SwimSession | undefined,
    newStrength: StrengthEntry[],
    newNotes: string
  ) => {
    // Si no hay nada registrado, podemos borrar el log si existía
    const hasData = (newSwim && newSwim.totalMeters > 0) || newStrength.length > 0 || newNotes.trim().length > 0;

    if (!hasData) {
      if (activeExistingLog) {
        await deleteCurrentLog(selectedDateKey);
      }
      return;
    }

    const payload: DailyWorkoutLog = {
      date: selectedDateKey,
      swim: newSwim,
      strength: newStrength,
      notes: newNotes,
      updatedAt: Date.now()
    };

    await saveCurrentLog(payload);
    setSavedNotification(true);
    setTimeout(() => setSavedNotification(false), 2000);
  };

  const onSwimChange = (swim: SwimSession | undefined) => {
    setCurrentSwim(swim);
    handleSave(swim, currentStrength, currentNotes);
  };

  const onStrengthChange = (strength: StrengthEntry[]) => {
    setCurrentStrength(strength);
    handleSave(currentSwim, strength, currentNotes);
  };

  const onNotesChange = (notes: string) => {
    setCurrentNotes(notes);
    handleSave(currentSwim, currentStrength, notes);
  };

  const handlePrevDay = () => {
    setSelectedDateKey(addDaysToDateKey(selectedDateKey, -1));
  };

  const handleNextDay = () => {
    setSelectedDateKey(addDaysToDateKey(selectedDateKey, 1));
  };

  const handleGoToday = () => {
    setSelectedDateKey(toLocalDateKey(new Date()));
  };

  const isToday = selectedDateKey === toLocalDateKey(new Date());

  return (
    <div className="main-content">
      {/* Selector de Fecha */}
      <div
        className="card"
        style={{
          padding: '10px 14px',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}
      >
        <button
          className="btn btn-secondary btn-icon"
          style={{ width: 40, height: 40, minHeight: 40 }}
          onClick={handlePrevDay}
          title="Día anterior"
        >
          <ChevronLeft size={20} />
        </button>

        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#fff' }}>
              {formatFriendlyDate(selectedDateKey)}
            </span>
            {!isToday && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ padding: '2px 8px', minHeight: '26px', fontSize: '0.72rem', color: '#06b6d4' }}
                onClick={handleGoToday}
              >
                Ir a hoy
              </button>
            )}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
            {selectedDateKey}
          </span>
        </div>

        <button
          className="btn btn-secondary btn-icon"
          style={{ width: 40, height: 40, minHeight: 40 }}
          onClick={handleNextDay}
          title="Día siguiente"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Indicador de guardado offline */}
      <div style={{ height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {savedNotification && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.75rem',
              color: '#34d399',
              fontWeight: 600
            }}
          >
            <CheckCircle2 size={13} /> Guardado offline ✓
          </span>
        )}
      </div>

      {/* 1. Tarjeta de Natación */}
      <SwimLoggerCard
        session={currentSwim}
        onChange={onSwimChange}
        defaultPoolLength={settings.poolLengthDefault}
      />

      {/* 2. Tarjeta de Calistenia */}
      <StrengthLoggerCard
        category="calisthenics"
        exercises={exercises}
        entries={currentStrength}
        onChange={onStrengthChange}
        lastUsedWeights={lastUsedWeights}
      />

      {/* 3. Tarjeta de Pesas (Mancuernas) */}
      <StrengthLoggerCard
        category="weights"
        exercises={exercises}
        entries={currentStrength}
        onChange={onStrengthChange}
        lastUsedWeights={lastUsedWeights}
      />

      {/* 4. Notas del Día */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <FileText size={18} color="#94a3b8" />
            <span>Sensaciones / Notas</span>
          </div>
        </div>
        <textarea
          rows={2}
          value={currentNotes}
          placeholder="Ej. Buena energía en piscina, series duras de bíceps..."
          onChange={e => onNotesChange(e.target.value)}
          className="input-field"
          style={{ resize: 'none', fontSize: '0.9rem', fontWeight: 500 }}
        />
      </div>

      {/* Botón para vaciar entrenamiento del día si tiene datos */}
      {activeExistingLog && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: '#f43f5e', fontSize: '0.8rem' }}
            onClick={() => {
              if (window.confirm('¿Borrar todo el entrenamiento de este día?')) {
                deleteCurrentLog(selectedDateKey);
              }
            }}
          >
            <Trash2 size={14} />
            <span>Eliminar registro de este día</span>
          </button>
        </div>
      )}
    </div>
  );
};
