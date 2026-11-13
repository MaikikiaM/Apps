// src/components/logger/DailyLoggerView.tsx
// Vista principal de registro del día seleccionado con tira semanal, metas, temporizador y sensaciones

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  FileText,
  Trash2,
  Timer,
  Copy,
  Target,
  CalendarDays
} from 'lucide-react';
import { useAppData } from '../../db/useAppData';
import { SwimLoggerCard } from './SwimLoggerCard';
import { StrengthLoggerCard } from './StrengthLoggerCard';
import { RestTimerBar } from './RestTimerBar';
import { DailyWorkoutLog, SwimSession, StrengthEntry } from '../../types/models';
import {
  formatFriendlyDate,
  formatShortSpanishDate,
  addDaysToDateKey,
  toLocalDateKey,
  getWeekDateKeys
} from '../../utils/dates';
import {
  computeStreaksAndWeeklySummary,
  findLastExercisePerformance,
  findLastSwimSession,
  findLastWorkoutLog,
  computePersonalRecords,
  hasLogActivity,
  LastExercisePerformance
} from '../../utils/stats';
import { formatMeters } from '../../utils/formatters';

const FEELING_OPTIONS: { value: 1 | 2 | 3 | 4 | 5; emoji: string; label: string }[] = [
  { value: 1, emoji: '😫', label: 'Agotado' },
  { value: 2, emoji: '😕', label: 'Flojo' },
  { value: 3, emoji: '😐', label: 'Normal' },
  { value: 4, emoji: '💪', label: 'Bien' },
  { value: 5, emoji: '🔥', label: 'A tope' }
];

const WEEKDAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export const DailyLoggerView: React.FC = () => {
  const {
    selectedDateKey,
    setSelectedDateKey,
    logsMap,
    exercises,
    settings,
    saveCurrentLog,
    deleteCurrentLog,
    logs,
    externalReloadToken
  } = useAppData();

  const [savedNotification, setSavedNotification] = useState<boolean>(false);
  const [showRestTimer, setShowRestTimer] = useState<boolean>(false);
  const [confirmDeleteDay, setConfirmDeleteDay] = useState<boolean>(false);

  const activeExistingLog = logsMap.get(selectedDateKey);

  const [currentSwim, setCurrentSwim] = useState<SwimSession | undefined>(activeExistingLog?.swim);
  const [currentStrength, setCurrentStrength] = useState<StrengthEntry[]>(activeExistingLog?.strength || []);
  const [currentNotes, setCurrentNotes] = useState<string>(activeExistingLog?.notes || '');
  const [currentFeeling, setCurrentFeeling] = useState<1 | 2 | 3 | 4 | 5 | undefined>(activeExistingLog?.feeling);

  const lastSyncedRef = useRef<{ dateKey: string; token: number }>({
    dateKey: '',
    token: -1
  });
  const savedTimerRef = useRef<number | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  // Sincronizar borrador local SOLO cuando cambia la fecha o hay una recarga externa (import/demo/clear)
  useEffect(() => {
    if (
      lastSyncedRef.current.dateKey !== selectedDateKey ||
      lastSyncedRef.current.token !== externalReloadToken
    ) {
      const log = logsMap.get(selectedDateKey);
      setCurrentSwim(log?.swim);
      setCurrentStrength(log?.strength || []);
      setCurrentNotes(log?.notes || '');
      setCurrentFeeling(log?.feeling);
      setConfirmDeleteDay(false);
      lastSyncedRef.current = { dateKey: selectedDateKey, token: externalReloadToken };
    }
  }, [selectedDateKey, externalReloadToken, logsMap]);

  const exMap = useMemo(() => new Map(exercises.map(e => [e.id, e])), [exercises]);

  // Historial de pesos más recientes usados para cada ejercicio
  const lastUsedWeights = useMemo(() => {
    const map = new Map<string, number>();
    for (const log of logs) {
      if (log.date >= selectedDateKey) continue;
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
  }, [logs, selectedDateKey]);

  // Última marca por ejercicio (antes de la fecha seleccionada)
  const lastPerformances = useMemo(() => {
    const map = new Map<string, LastExercisePerformance>();
    for (const ex of exercises) {
      const perf = findLastExercisePerformance(logs, ex.id, selectedDateKey);
      if (perf) map.set(ex.id, perf);
    }
    return map;
  }, [logs, exercises, selectedDateKey]);

  // Récords personales previos (excluyendo hoy para detectar nuevos PRs en vivo)
  const personalRecords = useMemo(() => {
    return computePersonalRecords(logs, exercises, selectedDateKey).exerciseRecords;
  }, [logs, exercises, selectedDateKey]);

  const lastSwimSession = useMemo(
    () => findLastSwimSession(logs, selectedDateKey),
    [logs, selectedDateKey]
  );

  const lastWorkoutLog = useMemo(
    () => findLastWorkoutLog(logs, selectedDateKey),
    [logs, selectedDateKey]
  );

  const weeklySummary = useMemo(
    () => computeStreaksAndWeeklySummary(logs, selectedDateKey),
    [logs, selectedDateKey]
  );

  const weekKeys = useMemo(() => getWeekDateKeys(selectedDateKey), [selectedDateKey]);

  // Guardado reactivo automático (sin colapsar el card de natación si está abierto)
  const persistLog = async (
    newSwim: SwimSession | undefined,
    newStrength: StrengthEntry[],
    newNotes: string,
    newFeeling: 1 | 2 | 3 | 4 | 5 | undefined
  ) => {
    const swimHasMeaningfulData = !!(newSwim && (newSwim.totalMeters > 0 || newSwim.durationSeconds > 0));
    const hasData =
      swimHasMeaningfulData ||
      newStrength.length > 0 ||
      newNotes.trim().length > 0 ||
      newFeeling !== undefined;

    if (!hasData) {
      if (logsMap.get(selectedDateKey)) {
        await deleteCurrentLog(selectedDateKey);
      }
      return;
    }

    const payload: DailyWorkoutLog = {
      date: selectedDateKey,
      swim: newSwim,
      strength: newStrength,
      notes: newNotes,
      feeling: newFeeling,
      updatedAt: Date.now()
    };

    await saveCurrentLog(payload);
    setSavedNotification(true);
    if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
    savedTimerRef.current = window.setTimeout(() => setSavedNotification(false), 1800);
  };

  const onSwimChange = (swim: SwimSession | undefined) => {
    setCurrentSwim(swim);
    persistLog(swim, currentStrength, currentNotes, currentFeeling);
  };

  const onStrengthChange = (strength: StrengthEntry[]) => {
    setCurrentStrength(strength);
    persistLog(currentSwim, strength, currentNotes, currentFeeling);
  };

  const onNotesChange = (notes: string) => {
    setCurrentNotes(notes);
    persistLog(currentSwim, currentStrength, notes, currentFeeling);
  };

  const onFeelingChange = (feeling: 1 | 2 | 3 | 4 | 5) => {
    const nextFeeling = currentFeeling === feeling ? undefined : feeling;
    setCurrentFeeling(nextFeeling);
    persistLog(currentSwim, currentStrength, currentNotes, nextFeeling);
  };

  const handleRepeatLastWorkout = () => {
    if (!lastWorkoutLog) return;
    const copiedSwim = lastWorkoutLog.swim ? { ...lastWorkoutLog.swim } : undefined;
    const copiedStrength = lastWorkoutLog.strength.map(st => ({
      ...st,
      sets: st.sets.map(s => ({ ...s }))
    }));
    setCurrentSwim(copiedSwim);
    setCurrentStrength(copiedStrength);
    persistLog(copiedSwim, copiedStrength, currentNotes, currentFeeling);
  };

  const handleDeleteDay = async () => {
    if (!confirmDeleteDay) {
      setConfirmDeleteDay(true);
      window.setTimeout(() => setConfirmDeleteDay(false), 3500);
      return;
    }
    setCurrentSwim(undefined);
    setCurrentStrength([]);
    setCurrentNotes('');
    setCurrentFeeling(undefined);
    setConfirmDeleteDay(false);
    await deleteCurrentLog(selectedDateKey);
  };

  const todayKey = toLocalDateKey(new Date());
  const isToday = selectedDateKey === todayKey;
  const isDayEmpty = !currentSwim && currentStrength.length === 0 && !currentNotes.trim();

  const targetDays = settings.targetDaysWeekly || 4;
  const targetSwim = settings.targetSwimMetersWeekly || 2000;
  const daysPct = Math.min(100, Math.round((weeklySummary.weeklyActiveDays / Math.max(1, targetDays)) * 100));
  const swimPct = Math.min(100, Math.round((weeklySummary.weeklySwimMeters / Math.max(1, targetSwim)) * 100));

  return (
    <div className="main-content">
      {/* Selector de Fecha + Tira Semanal */}
      <div className="card" style={{ padding: '12px', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            style={{ width: 38, height: 38, minHeight: 38 }}
            onClick={() => setSelectedDateKey(addDaysToDateKey(selectedDateKey, -1))}
            title="Día anterior"
            aria-label="Día anterior"
          >
            <ChevronLeft size={20} />
          </button>

          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '1.02rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <span>{formatFriendlyDate(selectedDateKey)}</span>
                <CalendarDays size={14} color="#64748b" />
              </button>
              <input
                ref={dateInputRef}
                type="date"
                value={selectedDateKey}
                onChange={e => e.target.value && setSelectedDateKey(e.target.value)}
                style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
                aria-label="Elegir fecha"
              />
              {!isToday && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '2px 8px', minHeight: '24px', fontSize: '0.72rem', color: '#06b6d4' }}
                  onClick={() => setSelectedDateKey(todayKey)}
                >
                  Hoy
                </button>
              )}
            </div>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
              {selectedDateKey}
            </span>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-icon"
            style={{ width: 38, height: 38, minHeight: 38 }}
            onClick={() => setSelectedDateKey(addDaysToDateKey(selectedDateKey, 1))}
            title="Día siguiente"
            aria-label="Día siguiente"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Tira semanal L-D */}
        <div className="week-strip">
          {weekKeys.map((wk, idx) => {
            const wLog = logsMap.get(wk);
            const isSel = wk === selectedDateKey;
            const isWkToday = wk === todayKey;
            const dayNum = parseInt(wk.slice(8, 10), 10);

            const hasSwim = !!(wLog?.swim && wLog.swim.totalMeters > 0);
            let hasCali = false;
            let hasWeights = false;
            if (wLog) {
              for (const st of wLog.strength) {
                const def = exMap.get(st.exerciseId);
                if (st.sets.some(s => s.reps > 0) || (st.quickTotalReps && st.quickTotalReps > 0)) {
                  if (def?.category === 'calisthenics') hasCali = true;
                  if (def?.category === 'weights') hasWeights = true;
                }
              }
            }

            return (
              <button
                key={wk}
                type="button"
                className={`week-day-btn ${isWkToday ? 'today' : ''} ${isSel ? 'selected' : ''}`}
                onClick={() => setSelectedDateKey(wk)}
              >
                <span style={{ fontSize: '0.65rem', fontWeight: 700, opacity: 0.8 }}>
                  {WEEKDAY_SHORT[idx]}
                </span>
                <span style={{ fontSize: '0.84rem', fontWeight: isSel || isWkToday ? 800 : 600 }}>
                  {dayNum}
                </span>
                <div style={{ display: 'flex', gap: '2px', height: '5px', alignItems: 'center' }}>
                  {hasSwim && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#06b6d4' }} />}
                  {hasCali && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#10b981' }} />}
                  {hasWeights && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#f59e0b' }} />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Barra compacta de Metas Semanales + Botón Temporizador */}
      <div
        className="card"
        style={{
          padding: '10px 12px',
          gap: '8px',
          background: 'var(--bg-subtle)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, color: '#cbd5e1' }}>
            <Target size={14} color="#06b6d4" />
            <span>Semana: {weeklySummary.weeklyActiveDays}/{targetDays} días</span>
            {weeklySummary.weeklySwimMeters > 0 && (
              <span style={{ color: '#38bdf8' }}>· {formatMeters(weeklySummary.weeklySwimMeters)}/{formatMeters(targetSwim)}</span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {savedNotification && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', color: '#34d399', fontWeight: 700 }}>
                <CheckCircle2 size={12} /> Guardado
              </span>
            )}
            <button
              type="button"
              className={`btn btn-sm ${showRestTimer ? 'btn-primary' : 'btn-secondary'}`}
              style={{ minHeight: '30px', padding: '4px 10px', fontSize: '0.74rem' }}
              onClick={() => setShowRestTimer(v => !v)}
            >
              <Timer size={13} />
              <span>Descanso</span>
            </button>
          </div>
        </div>

        {/* Doble barra fina de progreso semanal */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
          <div className="goal-track" title="Días entrenados esta semana">
            <div className="goal-fill" style={{ width: `${daysPct}%`, background: '#10b981' }} />
          </div>
          <div className="goal-track" title="Metros nadados esta semana">
            <div className="goal-fill" style={{ width: `${swimPct}%`, background: '#06b6d4' }} />
          </div>
        </div>
      </div>

      {/* Temporizador de descanso interactivo */}
      {showRestTimer && (
        <RestTimerBar
          defaultSeconds={settings.restTimerDefaultSeconds || 90}
          onClose={() => setShowRestTimer(false)}
        />
      )}

      {/* Botón rápido "Repetir último entrenamiento" si el día está vacío */}
      {isDayEmpty && lastWorkoutLog && hasLogActivity(lastWorkoutLog) && (
        <button
          type="button"
          className="btn btn-secondary"
          style={{
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderColor: 'rgba(56, 189, 248, 0.35)',
            background: 'rgba(6, 182, 212, 0.08)'
          }}
          onClick={handleRepeatLastWorkout}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', color: '#e2e8f0' }}>
            <Copy size={15} color="#38bdf8" />
            <span>
              Repetir sesión del <strong>{formatShortSpanishDate(lastWorkoutLog.date)}</strong>
            </span>
          </span>
          <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700 }}>
            Copiar todo
          </span>
        </button>
      )}

      {/* 1. Tarjeta de Natación */}
      <SwimLoggerCard
        session={currentSwim}
        onChange={onSwimChange}
        defaultPoolLength={settings.poolLengthDefault}
        lastSwimSession={lastSwimSession}
      />

      {/* 2. Tarjeta de Calistenia */}
      <StrengthLoggerCard
        category="calisthenics"
        exercises={exercises}
        entries={currentStrength}
        onChange={onStrengthChange}
        lastUsedWeights={lastUsedWeights}
        lastPerformances={lastPerformances}
        personalRecords={personalRecords}
        onStartRestTimer={() => setShowRestTimer(true)}
      />

      {/* 3. Tarjeta de Pesas (Mancuernas) */}
      <StrengthLoggerCard
        category="weights"
        exercises={exercises}
        entries={currentStrength}
        onChange={onStrengthChange}
        lastUsedWeights={lastUsedWeights}
        lastPerformances={lastPerformances}
        personalRecords={personalRecords}
        onStartRestTimer={() => setShowRestTimer(true)}
      />

      {/* 4. Sensaciones y Notas del Día */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <FileText size={18} color="#94a3b8" />
            <span>Sensaciones / Notas</span>
          </div>
        </div>

        {/* Selector rápido de sensación 1-5 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '6px' }}>
          {FEELING_OPTIONS.map(opt => {
            const active = currentFeeling === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onFeelingChange(opt.value)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                  padding: '6px 2px',
                  borderRadius: '10px',
                  border: active ? '1px solid var(--accent-cyan)' : '1px solid var(--border-color)',
                  background: active ? 'rgba(6, 182, 212, 0.16)' : 'var(--bg-subtle)',
                  color: active ? '#38bdf8' : '#94a3b8',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <span style={{ fontSize: '1.1rem', lineHeight: 1.2 }}>{opt.emoji}</span>
                <span>{opt.label}</span>
              </button>
            );
          })}
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

      {/* Botón para vaciar entrenamiento del día con confirmación en 2 toques */}
      {(activeExistingLog || !isDayEmpty) && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2px' }}>
          <button
            type="button"
            className={`btn btn-sm ${confirmDeleteDay ? 'btn-danger-soft' : 'btn-ghost'}`}
            style={{ color: '#fb7185', fontSize: '0.8rem' }}
            onClick={handleDeleteDay}
          >
            <Trash2 size={14} />
            <span>{confirmDeleteDay ? 'Pulsa de nuevo para confirmar borrado' : 'Eliminar registro de este día'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
