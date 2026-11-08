// src/components/analytics/MathProgressView.tsx
// Panel del modelo matemático diario: Índice Global de Avance, Fitness/Fatiga y Proyecciones a 30 y 90 días

import React, { useMemo } from 'react';
import { BrainCircuit, Activity, Sparkles } from 'lucide-react';
import { useAppData } from '../../db/useAppData';
import { computeDailyProgressionSeries } from '../../math/progressionEngine';
import { ChartCanvas } from '../common/ChartCanvas';
import { ChartConfiguration } from 'chart.js';
import { formatPercent, formatNumberWithSign } from '../../utils/formatters';

export const MathProgressView: React.FC = () => {
  const { logs, exercises, bodyWeights, selectedDateKey } = useAppData();

  const mathResult = useMemo(() => {
    return computeDailyProgressionSeries(logs, exercises, bodyWeights, selectedDateKey);
  }, [logs, exercises, bodyWeights, selectedDateKey]);

  const { snapshots, todaySnapshot, overallIga, overallIgaChangePercent, projections } = mathResult;

  // Gráfica Diaria Continua del Índice Global de Avance (IGA)
  const igaChartConfig: ChartConfiguration = useMemo(() => {
    if (snapshots.length === 0) {
      return { type: 'line', data: { labels: [], datasets: [] } };
    }

    const labels = snapshots.map(s => s.date.slice(5));
    const data = snapshots.map(s => s.iga);

    const datasets: any[] = [
      {
        label: 'Índice Global de Rendimiento (Base 100)',
        data,
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.15)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.25,
        pointRadius: 2,
        pointHoverRadius: 6,
        pointBackgroundColor: '#38bdf8'
      }
    ];

    // Proyección a 30 días si hay suficientes datos
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
        pointRadius: 4,
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
          x: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } }
        }
      }
    };
  }, [snapshots, projections]);

  // Gráfica de Fitness (CTL) vs Fatiga (ATL) vs Frescura (TSB)
  const banisterChartConfig: ChartConfiguration = useMemo(() => {
    if (snapshots.length === 0) {
      return { type: 'line', data: { labels: [], datasets: [] } };
    }

    const labels = snapshots.map(s => s.date.slice(5));

    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Forma / Fitness (CTL 28d)',
            data: snapshots.map(s => s.ctl),
            borderColor: '#10b981',
            borderWidth: 2,
            tension: 0.2,
            pointRadius: 0
          },
          {
            label: 'Fatiga Aguda (ATL 7d)',
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
          x: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } }
        }
      }
    };
  }, [snapshots]);

  // Estado fisiológico hoy
  const tsbValue = todaySnapshot?.tsb || 0;
  let formStateLabel = 'En Mantenimiento';
  let formStateColor = '#94a3b8';
  if (tsbValue > 5) {
    formStateLabel = 'Fresco / Recuperado';
    formStateColor = '#34d399';
  } else if (tsbValue >= -10) {
    formStateLabel = 'Óptimo / Progresando';
    formStateColor = '#38bdf8';
  } else {
    formStateLabel = 'Carga Alta / Fatiga';
    formStateColor = '#f59e0b';
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BrainCircuit size={22} color="#06b6d4" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
              Índice Global de Rendimiento
            </span>
          </div>

          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              color: overallIgaChangePercent >= 0 ? '#34d399' : '#f43f5e',
              background: 'rgba(16, 185, 129, 0.15)',
              padding: '3px 8px',
              borderRadius: '9999px',
              border: '1px solid rgba(16, 185, 129, 0.3)'
            }}
          >
            {formatPercent(overallIgaChangePercent)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '4px 0' }}>
          <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
            {overallIga}
          </span>
          <span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 600 }}>pts (Base 100)</span>
        </div>

        {/* Proyecciones futuras */}
        {igaProj && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              paddingTop: '10px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            <div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Velocidad Actual</div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#38bdf8' }}>
                {formatNumberWithSign(igaProj.monthlyGainRate)} /mes
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Predicción +30d</div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#34d399' }}>
                {igaProj.projected30d} pts
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Predicción +90d</div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#a855f7' }}>
                {igaProj.projected90d} pts
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Gráfica Diaria Continua del IGA */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Evolución Diaria del Índice Global</div>
            <div className="card-subtitle">Calculado día a día con descansos y supercompensación</div>
          </div>
        </div>
        <ChartCanvas config={igaChartConfig} height={230} />
      </div>

      {/* Modelo de Carga Fisiológica Banister */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Forma (CTL), Fatiga (ATL) y Frescura</div>
            <div className="card-subtitle">
              Estado hoy: <strong style={{ color: formStateColor }}>{formStateLabel}</strong>
            </div>
          </div>
          <Activity size={18} color="#06b6d4" />
        </div>
        <ChartCanvas config={banisterChartConfig} height={220} />
      </div>

      {/* Proyecciones Detalladas por Ejercicio y Natación */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Sparkles size={18} color="#f59e0b" />
            <span>Estimaciones y Proyecciones a Futuro</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {projections.map(proj => (
            <div
              key={proj.key}
              style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '10px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>
                  {proj.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Actual: <strong>{proj.currentValue} {proj.unit}</strong> · Ritmo: {formatNumberWithSign(proj.monthlyGainRate)} {proj.unit}/mes
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#34d399' }}>
                  +30d: ~{proj.projected30d} {proj.unit}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#a855f7' }}>
                  +90d: ~{proj.projected90d} {proj.unit}
                </div>
              </div>
            </div>
          ))}

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
