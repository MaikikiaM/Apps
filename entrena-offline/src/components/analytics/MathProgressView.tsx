// src/components/analytics/MathProgressView.tsx
// Panel del modelo matemático diario: Índice Global de Avance, Fitness/Fatiga, Coach y Récords Personales

import React, { useMemo } from 'react';
import { BrainCircuit, Activity, Sparkles, Trophy, Compass } from 'lucide-react';
import { useAppData } from '../../db/useAppData';
import { computeDailyProgressionSeries } from '../../math/progressionEngine';
import { ChartCanvas } from '../common/ChartCanvas';
import { ChartConfiguration } from 'chart.js';
import { formatPercent, formatNumberWithSign, formatDurationMmSs, formatMeters, formatWeightKg } from '../../utils/formatters';
import { computePersonalRecords } from '../../utils/stats';
import { formatShortSpanishDate, formatChartSpanishDate, daysBetween, toLocalDateKey } from '../../utils/dates';

export const MathProgressView: React.FC = () => {
  const { logs, exercises, bodyWeights, selectedDateKey } = useAppData();

  const mathResult = useMemo(() => {
    return computeDailyProgressionSeries(logs, exercises, bodyWeights, selectedDateKey);
  }, [logs, exercises, bodyWeights, selectedDateKey]);

  const personalRecords = useMemo(() => {
    return computePersonalRecords(logs, exercises);
  }, [logs, exercises]);

  const { snapshots, todaySnapshot, overallIga, overallIgaChangePercent, projections } = mathResult;

  // Gráfica Diaria Continua del Índice Global de Avance (IGA)
  const igaChartConfig: ChartConfiguration = useMemo(() => {
    if (snapshots.length === 0) {
      return { type: 'line', data: { labels: [], datasets: [] } };
    }

    const labels = snapshots.map(s => formatChartSpanishDate(s.date));
    const data = snapshots.map(s => s.iga);

    const datasets: ChartConfiguration['data']['datasets'] = [
      {
        label: 'Índice Global (Base 100)',
        data,
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.15)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.25,
        pointRadius: 1.5,
        pointHoverRadius: 5,
        pointBackgroundColor: '#38bdf8'
      }
    ];

    const igaProj = projections.find(p => p.key === 'iga');
    if (igaProj && data.length >= 3) {
      const last = data[data.length - 1];
      const p15 = Math.round((last + (igaProj.projected30d - last) * 0.5) * 10) / 10;
      datasets.push({
        label: 'Proyección +30d',
        data: [...Array(data.length - 1).fill(null), last, p15, igaProj.projected30d],
        borderColor: '#06b6d4',
        borderDash: [5, 5],
        borderWidth: 2,
        fill: false,
        pointRadius: 3.5,
        pointBackgroundColor: '#06b6d4'
      });
    }

    const extLabels = [...labels];
    if (igaProj && data.length >= 3) {
      extLabels.push('+15d', '+30d');
    }

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
  }, [snapshots, projections]);

  // Gráfica de Fitness (CTL) vs Fatiga (ATL) vs Frescura (TSB)
  const banisterChartConfig: ChartConfiguration = useMemo(() => {
    if (snapshots.length === 0) {
      return { type: 'line', data: { labels: [], datasets: [] } };
    }

    const labels = snapshots.map(s => formatChartSpanishDate(s.date));

    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Forma (CTL 28d)',
            data: snapshots.map(s => s.ctl),
            borderColor: '#10b981',
            borderWidth: 2,
            tension: 0.2,
            pointRadius: 0
          },
          {
            label: 'Fatiga (ATL 7d)',
            data: snapshots.map(s => s.atl),
            borderColor: '#f43f5e',
            borderWidth: 1.5,
            borderDash: [3, 3],
            tension: 0.2,
            pointRadius: 0
          },
          {
            label: 'Frescura (TSB)',
            data: snapshots.map(s => s.tsb),
            borderColor: '#f59e0b',
            borderWidth: 1.5,
            tension: 0.2,
            pointRadius: 0
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
  }, [snapshots]);

  // Estado fisiológico hoy y recomendación de entrenamiento
  const tsbValue = todaySnapshot?.tsb || 0;
  let formStateLabel = 'En Mantenimiento';
  let formStateColor = '#94a3b8';
  let coachMessage = 'Buen momento para mantener una sesión equilibrada de fuerza o piscina.';

  if (tsbValue > 5) {
    formStateLabel = 'Fresco / Recuperado';
    formStateColor = '#34d399';
    coachMessage = 'Tu frescura es positiva: día ideal para intentar un récord personal (PR) o series exigentes.';
  } else if (tsbValue >= -10) {
    formStateLabel = 'Óptimo / Progresando';
    formStateColor = '#38bdf8';
    coachMessage = 'Estás en la zona óptima de carga: progresión constante sin sobreentrenamiento.';
  } else {
    formStateLabel = 'Carga Alta / Fatiga';
    formStateColor = '#f59e0b';
    coachMessage = 'Llevas varios días de carga intensa. Considera técnica suave en piscina o descanso activo.';
  }

  // Detectar días desde última sesión de natación/fuerza para afinar el consejo
  const todayKey = toLocalDateKey(new Date());
  const lastSwimLog = [...logs].reverse().find(l => l.swim && l.swim.totalMeters > 0);
  const daysSinceSwim = lastSwimLog ? daysBetween(lastSwimLog.date, todayKey) : null;
  if (daysSinceSwim !== null && daysSinceSwim >= 5 && tsbValue >= -10) {
    coachMessage += ` Llevas ${daysSinceSwim} días sin nadar: buena ocasión para volver al agua.`;
  }

  const igaProj = projections.find(p => p.key === 'iga');

  if (snapshots.length === 0) {
    return (
      <div className="main-content">
        <div className="card" style={{ textAlign: 'center', padding: '36px 16px', gap: '12px' }}>
          <BrainCircuit size={40} color="#06b6d4" style={{ margin: '0 auto' }} />
          <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Motor Matemático Listo</div>
          <div style={{ color: '#94a3b8', fontSize: '0.88rem', maxWidth: '400px', margin: '0 auto' }}>
            Registra tu primer entrenamiento o carga los datos de demostración en <strong>Ajustes</strong> para ver las predicciones y el modelo diario de rendimiento.
          </div>
        </div>
      </div>
    );
  }

  const exerciseRecordsList = Array.from(personalRecords.exerciseRecords.values());

  return (
    <div className="main-content">
      {/* Tarjeta Principal del Índice Global */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(16, 185, 129, 0.1))',
          borderColor: 'rgba(6, 182, 212, 0.4)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <BrainCircuit size={20} color="#06b6d4" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
              Índice Global de Rendimiento
            </span>
          </div>

          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              color: overallIgaChangePercent >= 0 ? '#34d399' : '#f43f5e',
              background: overallIgaChangePercent >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
              padding: '3px 8px',
              borderRadius: '9999px',
              border: `1px solid ${overallIgaChangePercent >= 0 ? 'rgba(16, 185, 129, 0.35)' : 'rgba(244, 63, 94, 0.35)'}`,
              flexShrink: 0
            }}
          >
            {formatPercent(overallIgaChangePercent)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '2px 0' }}>
          <span style={{ fontSize: '2.35rem', fontWeight: 900, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
            {overallIga}
          </span>
          <span style={{ fontSize: '0.95rem', color: '#94a3b8', fontWeight: 600 }}>pts (Base 100)</span>
        </div>

        {igaProj && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: '8px',
              paddingTop: '10px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            <div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Velocidad</div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#38bdf8' }}>
                {formatNumberWithSign(igaProj.monthlyGainRate)}/mes
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Pred. +30d</div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#34d399' }}>
                {igaProj.projected30d} pts
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Pred. +90d</div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#a855f7' }}>
                {igaProj.projected90d} pts
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Coach Offline / Recomendación del Día */}
      <div className="card" style={{ padding: '12px 14px', gap: '6px', borderColor: `${formStateColor}44` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', fontWeight: 700, color: '#f8fafc' }}>
            <Compass size={16} color={formStateColor} />
            <span>Estado Fisiológico: <strong style={{ color: formStateColor }}>{formStateLabel}</strong></span>
          </div>
          <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700 }}>
            TSB {formatNumberWithSign(tsbValue)}
          </span>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.4 }}>
          {coachMessage}
        </p>
      </div>

      {/* Gráfica Diaria Continua del IGA */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Evolución Diaria del Índice Global</div>
            <div className="card-subtitle">Calculado día a día con descansos y supercompensación</div>
          </div>
        </div>
        <ChartCanvas config={igaChartConfig} height={225} />
      </div>

      {/* Modelo de Carga Fisiológica Banister */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Forma (CTL), Fatiga (ATL) y Frescura</div>
            <div className="card-subtitle">
              Carga aguda vs crónica
            </div>
          </div>
          <Activity size={18} color="#06b6d4" />
        </div>
        <ChartCanvas config={banisterChartConfig} height={220} />
      </div>

      {/* Récords Personales (Hall of Fame) */}
      {(personalRecords.bestSwimMeters > 0 || exerciseRecordsList.length > 0) && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Trophy size={18} color="#fbbf24" />
              <span>Récords Personales (PRs)</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
            {personalRecords.bestSwimMeters > 0 && (
              <div className="stat-box" style={{ borderColor: 'rgba(6, 182, 212, 0.35)' }}>
                <span className="stat-box-label">Distancia Piscina</span>
                <span className="stat-box-value" style={{ fontSize: '1.1rem', color: '#38bdf8' }}>
                  {formatMeters(personalRecords.bestSwimMeters)}
                </span>
                <span className="stat-box-sub">
                  {personalRecords.bestSwimMetersDate ? formatShortSpanishDate(personalRecords.bestSwimMetersDate) : ''}
                </span>
              </div>
            )}

            {personalRecords.fastestPaceSecPer100m !== null && (
              <div className="stat-box" style={{ borderColor: 'rgba(16, 185, 129, 0.35)' }}>
                <span className="stat-box-label">Ritmo /100m</span>
                <span className="stat-box-value" style={{ fontSize: '1.1rem', color: '#34d399' }}>
                  {formatDurationMmSs(personalRecords.fastestPaceSecPer100m)}
                </span>
                <span className="stat-box-sub">
                  {personalRecords.fastestPaceDate ? formatShortSpanishDate(personalRecords.fastestPaceDate) : ''}
                </span>
              </div>
            )}

            {exerciseRecordsList.map(rec => (
              <div key={rec.exerciseId} className="stat-box">
                <span className="stat-box-label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {rec.name}
                </span>
                <span className="stat-box-value" style={{ fontSize: '1.08rem', color: rec.category === 'weights' ? '#f59e0b' : '#34d399' }}>
                  {rec.category === 'weights'
                    ? `${formatWeightKg(rec.bestWeightKg)} · 1RM ${Math.round(rec.bestEstimated1RM)}kg`
                    : `${rec.bestMaxReps} reps`}
                </span>
                <span className="stat-box-sub">
                  {rec.category === 'weights'
                    ? formatShortSpanishDate(rec.best1RMDate)
                    : `${formatShortSpanishDate(rec.bestMaxRepsDate)}${rec.bestWeightKg > 0 ? ` · +${rec.bestWeightKg}kg` : ''}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Proyecciones Detalladas por Ejercicio y Natación */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Sparkles size={18} color="#f59e0b" />
            <span>Estimaciones y Proyecciones a Futuro</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {projections.map(proj => {
            const decimals = proj.unit === 'm' ? 0 : 1;
            return (
              <div
                key={proj.key}
                style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#fff' }}>
                    {proj.title}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                    Actual: <strong>{proj.currentValue} {proj.unit}</strong> · {formatNumberWithSign(proj.monthlyGainRate, decimals)} {proj.unit}/mes
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#34d399' }}>
                    +30d: ~{proj.projected30d} {proj.unit}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#a855f7' }}>
                    +90d: ~{proj.projected90d} {proj.unit}
                  </div>
                </div>
              </div>
            );
          })}

          {projections.length <= 1 && (
            <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#64748b', padding: '8px 0' }}>
              Registra 3 o más sesiones de cada ejercicio para desbloquear sus predicciones matemáticas individuales.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
