// src/components/calendar/CalendarView.tsx
// Calendario mensual interactivo con mapa de calor y desglose detallado por día

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Waves, Calendar as CalIcon, Scale, ArrowRight, Flame, Trophy } from 'lucide-react';
import { useAppData } from '../../db/useAppData';
import { getMonthCalendarGrid, parseLocalDateKey, toLocalDateKey, formatFullSpanishDate } from '../../utils/dates';
import { formatDurationHuman, formatSwimPace, formatWeightKg, formatMeters } from '../../utils/formatters';
import { normalizeStrengthEntry } from '../../math/progressionEngine';
import { computeStreaksAndWeeklySummary } from '../../utils/stats';

const FEELING_EMOJIS: Record<number, string> = {
  1: '😫 Agotado',
  2: '😕 Flojo',
  3: '😐 Normal',
  4: '💪 Bien',
  5: '🔥 A tope'
};

interface CalendarViewProps {
  onSelectDateToLog: (dateKey: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ onSelectDateToLog }) => {
  const { logs, logsMap, bodyWeights, exercises, settings, selectedDateKey, setSelectedDateKey } = useAppData();

  const [viewDate, setViewDate] = useState<Date>(() => parseLocalDateKey(selectedDateKey));

  const exMap = useMemo(() => new Map(exercises.map(e => [e.id, e])), [exercises]);
  const bodyWeightsMap = useMemo(() => new Map(bodyWeights.map(bw => [bw.date, bw])), [bodyWeights]);
  const streakSummary = useMemo(() => computeStreaksAndWeeklySummary(logs, selectedDateKey), [logs, selectedDateKey]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const handlePrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1, 12, 0, 0));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1, 12, 0, 0));
  };

  const handleGoToday = () => {
    const today = new Date();
    setViewDate(today);
    setSelectedDateKey(toLocalDateKey(today));
  };

  const calendarCells = useMemo(() => {
    return getMonthCalendarGrid(year, month);
  }, [year, month]);

  // Totales del mes visible
  const monthStats = useMemo(() => {
    let daysTrained = 0;
    let totalSwimMeters = 0;
    let totalSwimDurationSeconds = 0;
    let totalCaliReps = 0;
    let totalWeightsTonnage = 0;

    for (const cell of calendarCells) {
      if (!cell.isCurrentMonth) continue;
      const log = logsMap.get(cell.dateKey);
      if (log) {
        let hadActivity = false;
        if (log.swim && log.swim.totalMeters > 0) {
          hadActivity = true;
          totalSwimMeters += log.swim.totalMeters;
          totalSwimDurationSeconds += log.swim.durationSeconds || 0;
        }
        for (const st of log.strength) {
          const stats = normalizeStrengthEntry(st);
          if (stats.totalReps > 0) {
            hadActivity = true;
            const def = exMap.get(st.exerciseId);
            if (def?.category === 'calisthenics') {
              totalCaliReps += stats.totalReps;
            } else {
              totalWeightsTonnage += stats.tonnageKg;
            }
          }
        }
        if (hadActivity) daysTrained++;
      }
    }

    return {
      daysTrained,
      totalSwimMeters,
      totalSwimDurationSeconds,
      totalCaliReps,
      totalWeightsTonnage: Math.round(totalWeightsTonnage)
    };
  }, [calendarCells, logsMap, exMap]);

  // Detalle del día seleccionado actualmente
  const selectedLog = logsMap.get(selectedDateKey);
  const selectedBw = bodyWeightsMap.get(selectedDateKey);

  return (
    <div className="main-content">
      {/* Selector de Mes */}
      <div
        className="card"
        style={{
          padding: '12px 16px',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <button
          className="btn btn-secondary btn-icon"
          style={{ width: 38, height: 38, minHeight: 38 }}
          onClick={handlePrevMonth}
          title="Mes anterior"
        >
          <ChevronLeft size={20} />
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#fff' }}>
            {monthNames[month]} {year}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ padding: '2px 8px', minHeight: '24px', fontSize: '0.72rem', color: '#06b6d4' }}
            onClick={handleGoToday}
          >
            Volver a Hoy
          </button>
        </div>

        <button
          className="btn btn-secondary btn-icon"
          style={{ width: 38, height: 38, minHeight: 38 }}
          onClick={handleNextMonth}
          title="Mes siguiente"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Resumen del Mes + Rachas */}
      <div className="stat-grid">
        <div className="stat-box">
          <span className="stat-box-label">Días Entrenados</span>
          <span className="stat-box-value" style={{ color: '#38bdf8' }}>{monthStats.daysTrained}</span>
          <span className="stat-box-sub">en {monthNames[month]}</span>
        </div>

        <div className="stat-box">
          <span className="stat-box-label">Natación Mes</span>
          <span className="stat-box-value" style={{ color: '#06b6d4' }}>{formatMeters(monthStats.totalSwimMeters)}</span>
          <span className="stat-box-sub">{formatDurationHuman(monthStats.totalSwimDurationSeconds)}</span>
        </div>

        <div className="stat-box">
          <span className="stat-box-label">Reps Calistenia</span>
          <span className="stat-box-value" style={{ color: '#10b981' }}>{monthStats.totalCaliReps}</span>
          <span className="stat-box-sub">repeticiones totales</span>
        </div>

        <div className="stat-box">
          <span className="stat-box-label">Tonelaje Pesas</span>
          <span className="stat-box-value" style={{ color: '#f59e0b' }}>{monthStats.totalWeightsTonnage} kg</span>
          <span className="stat-box-sub">kg × reps acumulados</span>
        </div>
      </div>

      {/* Rachas y Meta Semanal */}
      <div className="card" style={{ padding: '12px 14px', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b' }}>
            <Flame size={15} />
            <span>Racha actual: {streakSummary.currentStreakDays} {streakSummary.currentStreakDays === 1 ? 'día' : 'días'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.76rem', color: '#94a3b8' }}>
            <Trophy size={13} color="#fbbf24" />
            <span>Mejor racha: {streakSummary.bestStreakDays}d</span>
          </div>
        </div>
        <div style={{ fontSize: '0.74rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
          <span>Meta semanal: {streakSummary.weeklyActiveDays}/{settings.targetDaysWeekly || 4} días</span>
          <span>Natación sem: {formatMeters(streakSummary.weeklySwimMeters)}/{formatMeters(settings.targetSwimMetersWeekly || 2000)}</span>
        </div>
      </div>

      {/* Cuadrícula del Calendario */}
      <div className="card" style={{ padding: '12px' }}>
        {/* Cabecera L M X J V S D */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '6px' }}>
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, idx) => (
            <span
              key={idx}
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: idx >= 5 ? '#f43f5e' : '#64748b'
              }}
            >
              {day}
            </span>
          ))}
        </div>

        {/* Celdas de días */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {calendarCells.map(cell => {
            const log = logsMap.get(cell.dateKey);
            const bw = bodyWeightsMap.get(cell.dateKey);
            const isSelected = cell.dateKey === selectedDateKey;

            const hasSwim = !!(log?.swim && log.swim.totalMeters > 0);
            let hasCali = false;
            let hasWeights = false;

            if (log) {
              for (const st of log.strength) {
                const def = exMap.get(st.exerciseId);
                if (st.sets.some(s => s.reps > 0) || (st.quickTotalReps && st.quickTotalReps > 0)) {
                  if (def?.category === 'calisthenics') hasCali = true;
                  if (def?.category === 'weights') hasWeights = true;
                }
              }
            }

            const hasBw = !!bw;
            const hasAny = hasSwim || hasCali || hasWeights || hasBw;

            return (
              <button
                key={cell.dateKey}
                onClick={() => setSelectedDateKey(cell.dateKey)}
                style={{
                  background: isSelected
                    ? 'rgba(6, 182, 212, 0.25)'
                    : hasAny
                    ? 'var(--bg-input)'
                    : 'transparent',
                  border: isSelected
                    ? '1.5px solid #06b6d4'
                    : cell.isToday
                    ? '1.5px solid #64748b'
                    : '1px solid transparent',
                  borderRadius: '10px',
                  padding: '8px 2px 6px 2px',
                  minHeight: '52px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  opacity: cell.isCurrentMonth ? 1 : 0.35,
                  transition: 'all 0.15s ease'
                }}
              >
                <span
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: cell.isToday || isSelected ? 800 : 600,
                    color: isSelected ? '#38bdf8' : cell.isCurrentMonth ? '#f8fafc' : '#475569'
                  }}
                >
                  {cell.dayNumber}
                </span>

                {/* Puntos de colores de disciplinas */}
                <div style={{ display: 'flex', gap: '2px', alignItems: 'center', height: '8px' }}>
                  {hasSwim && (
                    <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#06b6d4' }} />
                  )}
                  {hasCali && (
                    <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#10b981' }} />
                  )}
                  {hasWeights && (
                    <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                  )}
                  {hasBw && (
                    <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#a855f7' }} />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Leyenda de colores */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-around',
            fontSize: '0.72rem',
            color: '#94a3b8',
            marginTop: '12px',
            paddingTop: '8px',
            borderTop: '1px solid var(--border-color)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#06b6d4' }} />
            <span>Natación</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#10b981' }} />
            <span>Calistenia</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
            <span>Pesas</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#a855f7' }} />
            <span>Peso</span>
          </div>
        </div>
      </div>

      {/* Resumen del Día Seleccionado */}
      <div className="card">
        <div className="card-header">
          <div style={{ minWidth: 0, flex: '1 1 180px' }}>
            <div className="card-title" style={{ flexWrap: 'wrap' }}>
              <CalIcon size={18} color="#06b6d4" style={{ flexShrink: 0 }} />
              <span>{formatFullSpanishDate(selectedDateKey)}</span>
            </div>
            <div className="card-subtitle">
              {selectedLog ? 'Actividad registrada' : 'Sin entrenamiento registrado'}
              {selectedLog?.feeling ? ` · ${FEELING_EMOJIS[selectedLog.feeling]}` : ''}
            </div>
          </div>

          <button
            className="btn btn-primary btn-sm"
            style={{ flexShrink: 0 }}
            onClick={() => onSelectDateToLog(selectedDateKey)}
          >
            <span>{selectedLog ? 'Editar' : '+ Registrar'}</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {selectedLog ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Natación del día */}
            {selectedLog.swim && selectedLog.swim.totalMeters > 0 && (
              <div
                style={{
                  background: 'var(--bg-subtle)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  border: '1px solid rgba(6, 182, 212, 0.3)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#38bdf8' }}>
                    <Waves size={16} />
                    <span>Natación: {formatMeters(selectedLog.swim.totalMeters)}</span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    {formatDurationHuman(selectedLog.swim.durationSeconds)} ({formatSwimPace(selectedLog.swim.totalMeters, selectedLog.swim.durationSeconds)})
                  </span>
                </div>
                {/* Desglose estilos con wrap seguro */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: '0.78rem', color: '#cbd5e1' }}>
                  {selectedLog.swim.crawlMeters > 0 && <span>Crol: {selectedLog.swim.crawlMeters}m</span>}
                  {selectedLog.swim.backstrokeMeters > 0 && <span>Espalda: {selectedLog.swim.backstrokeMeters}m</span>}
                  {selectedLog.swim.breaststrokeMeters > 0 && <span>Braza: {selectedLog.swim.breaststrokeMeters}m</span>}
                  {selectedLog.swim.butterflyMeters > 0 && <span>Mariposa: {selectedLog.swim.butterflyMeters}m</span>}
                </div>
              </div>
            )}

            {/* Ejercicios de fuerza del día */}
            {selectedLog.strength.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selectedLog.strength.map(st => {
                  const def = exMap.get(st.exerciseId);
                  const stats = normalizeStrengthEntry(st);
                  const isWeight = def?.category === 'weights';
                  return (
                    <div
                      key={st.exerciseId}
                      style={{
                        background: 'var(--bg-subtle)',
                        borderRadius: '10px',
                        padding: '8px 12px',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: isWeight ? '#f59e0b' : '#34d399' }}>
                          {def?.name || st.exerciseId}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          {stats.setsCount} {stats.setsCount === 1 ? 'serie' : 'series'} · Total {stats.totalReps} reps · Máx {stats.maxReps} reps
                        </div>
                      </div>

                      {stats.workingWeightKg > 0 && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff' }}>
                            {formatWeightKg(stats.workingWeightKg)}
                          </div>
                          {isWeight && (
                            <div style={{ fontSize: '0.72rem', color: '#f59e0b' }}>
                              1RM ~{Math.round(stats.estimated1RM)} kg
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Notas del día */}
            {selectedLog.notes && (
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', padding: '4px 0' }}>
                "{selectedLog.notes}"
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px 0', color: '#64748b', fontSize: '0.85rem' }}>
            Día de descanso o sin datos. Toca "+ Registrar" para anotar natación o ejercicios en esta fecha.
          </div>
        )}

        {/* Peso corporal del día si coincide */}
        {selectedBw && (
          <div
            style={{
              marginTop: '4px',
              padding: '8px 12px',
              background: 'rgba(168, 85, 247, 0.1)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.82rem',
              color: '#d8b4fe'
            }}
          >
            <Scale size={16} />
            <span>Pesaje registrado este día: <strong>{selectedBw.weightKg} kg</strong></span>
          </div>
        )}
      </div>
    </div>
  );
};
