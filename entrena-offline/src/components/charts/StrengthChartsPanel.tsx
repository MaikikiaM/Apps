// src/components/charts/StrengthChartsPanel.tsx
// Gráficas detalladas para cada ejercicio de Calistenia y Pesas (Mancuernas)

import React, { useState, useMemo, useEffect } from 'react';
import { ChartCanvas } from '../common/ChartCanvas';
import { DailyWorkoutLog, ExerciseDefinition } from '../../types/models';
import { ChartConfiguration } from 'chart.js';
import { normalizeStrengthEntry } from '../../math/progressionEngine';
import { formatWeightKg } from '../../utils/formatters';

interface StrengthChartsPanelProps {
  category: 'calisthenics' | 'weights';
  exercises: ExerciseDefinition[];
  logs: DailyWorkoutLog[];
  showProjection: boolean;
}

export const StrengthChartsPanel: React.FC<StrengthChartsPanelProps> = ({
  category,
  exercises,
  logs,
  showProjection
}) => {
  const categoryExercises = useMemo(() => {
    return exercises.filter(e => e.category === category && !e.archived);
  }, [exercises, category]);

  const [selectedExId, setSelectedExId] = useState<string>(() => {
    return categoryExercises[0]?.id || '';
  });

  useEffect(() => {
    if (categoryExercises.length > 0 && !categoryExercises.some(e => e.id === selectedExId)) {
      setSelectedExId(categoryExercises[0].id);
    }
  }, [categoryExercises, selectedExId]);

  const activeDef = categoryExercises.find(e => e.id === selectedExId) || categoryExercises[0];
  const isWeights = category === 'weights';
  const accentColor = isWeights ? '#f59e0b' : '#10b981';

  const exerciseHistory = useMemo(() => {
    if (!activeDef) return [];
    const list: { date: string; totalReps: number; maxReps: number; weightKg: number; tonnageKg: number; e1rm: number }[] = [];

    const sortedLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date));
    for (const l of sortedLogs) {
      const st = l.strength.find(s => s.exerciseId === activeDef.id);
      if (st) {
        const stats = normalizeStrengthEntry(st);
        if (stats.totalReps > 0) {
          list.push({
            date: l.date,
            totalReps: stats.totalReps,
            maxReps: stats.maxReps,
            weightKg: stats.workingWeightKg,
            tonnageKg: stats.tonnageKg,
            e1rm: Math.round(stats.estimated1RM * 10) / 10
          });
        }
      }
    }
    return list;
  }, [logs, activeDef]);

  const kpiStats = useMemo(() => {
    let bestMaxReps = 0;
    let bestWeight = 0;
    let best1RM = 0;
    let totalRepsAll = 0;
    let totalTonnageAll = 0;

    for (const h of exerciseHistory) {
      if (h.maxReps > bestMaxReps) bestMaxReps = h.maxReps;
      if (h.weightKg > bestWeight) bestWeight = h.weightKg;
      if (h.e1rm > best1RM) best1RM = h.e1rm;
      totalRepsAll += h.totalReps;
      totalTonnageAll += h.tonnageKg;
    }

    return {
      sessions: exerciseHistory.length,
      bestMaxReps,
      bestWeight,
      best1RM,
      totalRepsAll,
      totalTonnageAll: Math.round(totalTonnageAll)
    };
  }, [exerciseHistory]);

  const labels = useMemo(() => exerciseHistory.map(h => h.date.slice(5)), [exerciseHistory]);

  const chartAConfig: ChartConfiguration = useMemo(() => {
    if (isWeights) {
      const data = exerciseHistory.map(h => h.weightKg);
      return {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Peso Mancuerna (kg)',
              data,
              borderColor: '#f59e0b',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              borderWidth: 2.5,
              fill: true,
              tension: 0.2,
              pointRadius: 3.5,
              pointBackgroundColor: '#f59e0b'
            }
          ]
        },
        options: {
          scales: {
            y: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } },
            x: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8', maxTicksLimit: 7 } }
          }
        }
      };
    }

    const data = exerciseHistory.map(h => h.totalReps);
    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Repeticiones Totales',
            data,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.25,
            pointRadius: 3.5,
            pointBackgroundColor: '#10b981'
          }
        ]
      },
      options: {
        scales: {
          y: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } },
          x: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8', maxTicksLimit: 7 } }
        }
      }
    };
  }, [exerciseHistory, labels, isWeights]);

  const chartBConfig: ChartConfiguration = useMemo(() => {
    if (isWeights) {
      const data = exerciseHistory.map(h => h.e1rm);
      const datasets: ChartConfiguration['data']['datasets'] = [
        {
          label: '1RM Estimado (kg)',
          data,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.15)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.25,
          pointRadius: 3.5,
          pointBackgroundColor: '#38bdf8'
        }
      ];

      if (showProjection && data.length >= 3) {
        const last = data[data.length - 1];
        const gain = (last - data[0]) / Math.max(1, data.length - 1);
        datasets.push({
          label: 'Proyección 1RM',
          data: [
            ...Array(data.length - 1).fill(null),
            last,
            Math.max(0, Math.round((last + gain * 0.8) * 10) / 10),
            Math.max(0, Math.round((last + gain * 1.5) * 10) / 10)
          ],
          borderColor: '#06b6d4',
          borderDash: [5, 5],
          borderWidth: 2,
          fill: false,
          pointRadius: 3.5
        });
      }

      const extLabels = [...labels];
      if (showProjection && data.length >= 3) extLabels.push('+1s', '+2s');

      return {
        type: 'line',
        data: { labels: extLabels, datasets },
        options: {
          scales: {
            y: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } },
            x: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8', maxTicksLimit: 7 } }
          }
        }
      };
    }

    const data = exerciseHistory.map(h => h.maxReps);
    const datasets: ChartConfiguration['data']['datasets'] = [
      {
        label: 'Mejor Serie (Reps)',
        data,
        borderColor: '#34d399',
        backgroundColor: 'rgba(52, 211, 153, 0.15)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.25,
        pointRadius: 3.5,
        pointBackgroundColor: '#34d399'
      }
    ];

    if (showProjection && data.length >= 3) {
      const last = data[data.length - 1];
      const gain = (last - data[0]) / Math.max(1, data.length - 1);
      datasets.push({
        label: 'Proyección Reps',
        data: [
          ...Array(data.length - 1).fill(null),
          last,
          Math.max(0, Math.round(last + gain * 0.8)),
          Math.max(0, Math.round(last + gain * 1.5))
        ],
        borderColor: '#10b981',
        borderDash: [5, 5],
        borderWidth: 2,
        fill: false,
        pointRadius: 3.5
      });
    }

    const extLabels = [...labels];
    if (showProjection && data.length >= 3) extLabels.push('+1s', '+2s');

    return {
      type: 'line',
      data: { labels: extLabels, datasets },
      options: {
        scales: {
          y: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } },
          x: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8', maxTicksLimit: 7 } }
        }
      }
    };
  }, [exerciseHistory, labels, isWeights, showProjection]);

  const chartCConfig: ChartConfiguration = useMemo(() => {
    const data = exerciseHistory.map(h => h.tonnageKg);
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Tonelaje Movido (kg × reps)',
            data,
            backgroundColor: isWeights ? 'rgba(245, 158, 11, 0.7)' : 'rgba(16, 185, 129, 0.7)',
            borderRadius: 6
          }
        ]
      },
      options: {
        scales: {
          y: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } },
          x: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8', maxTicksLimit: 7 } }
        }
      }
    };
  }, [exerciseHistory, labels, isWeights]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Selector de Ejercicio */}
      <div className="card" style={{ padding: '12px' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
          Selecciona Ejercicio
        </div>
        <div className="chip-group">
          {categoryExercises.map(ex => {
            const isSelected = ex.id === activeDef?.id;
            return (
              <button
                key={ex.id}
                type="button"
                className={`chip ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedExId(ex.id)}
                style={isSelected ? { borderColor: accentColor, color: accentColor, background: `${accentColor}20` } : undefined}
              >
                <span>{ex.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {exerciseHistory.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '30px 16px', color: '#64748b' }}>
          No hay registros de "{activeDef?.name}" en este periodo.
        </div>
      ) : (
        <>
          {/* KPIs del ejercicio */}
          <div className="stat-grid">
            <div className="stat-box">
              <span className="stat-box-label">{isWeights ? 'Peso Máximo' : 'Récord Serie'}</span>
              <span className="stat-box-value" style={{ color: accentColor }}>
                {isWeights ? formatWeightKg(kpiStats.bestWeight) : `${kpiStats.bestMaxReps} reps`}
              </span>
              <span className="stat-box-sub">{kpiStats.sessions} sesiones</span>
            </div>

            <div className="stat-box">
              <span className="stat-box-label">{isWeights ? '1RM Máx' : 'Reps Totales'}</span>
              <span className="stat-box-value" style={{ color: '#38bdf8' }}>
                {isWeights ? formatWeightKg(kpiStats.best1RM) : kpiStats.totalRepsAll}
              </span>
              <span className="stat-box-sub">
                {isWeights ? `${kpiStats.totalTonnageAll} kg movidos` : 'en este periodo'}
              </span>
            </div>
          </div>

          {/* Gráfica 1 */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">
                  {isWeights ? 'Peso Utilizado (kg Mancuerna)' : 'Repeticiones Totales'}
                </div>
                <div className="card-subtitle">{activeDef?.name}</div>
              </div>
            </div>
            <ChartCanvas config={chartAConfig} height={220} />
          </div>

          {/* Gráfica 2 */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">
                  {isWeights ? '1RM Máximo Estimado (kg)' : 'Mejor Serie (Récord Reps)'}
                </div>
                <div className="card-subtitle">{activeDef?.name} + Proyección</div>
              </div>
            </div>
            <ChartCanvas config={chartBConfig} height={220} />
          </div>

          {/* Gráfica 3 (solo si hay tonelaje o es pesas) */}
          {(isWeights || kpiStats.totalTonnageAll > 0) && (
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Volumen y Tonelaje por Sesión</div>
                  <div className="card-subtitle">Carga de trabajo total acumulada</div>
                </div>
              </div>
              <ChartCanvas config={chartCConfig} height={220} />
            </div>
          )}
        </>
      )}
    </div>
  );
};
