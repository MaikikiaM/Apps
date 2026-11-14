// src/components/charts/BodyWeightChartsPanel.tsx
// Gráfica de evolución mensual del peso corporal y fuerza relativa

import React, { useMemo } from 'react';
import { ChartCanvas } from '../common/ChartCanvas';
import { BodyWeightEntry, DailyWorkoutLog } from '../../types/models';
import { ChartConfiguration } from 'chart.js';
import { formatWeightKg, formatNumberWithSign } from '../../utils/formatters';
import { normalizeStrengthEntry } from '../../math/progressionEngine';
import { formatChartSpanishDate, formatSpanishDateShortYear } from '../../utils/dates';

interface BodyWeightChartsPanelProps {
  bodyWeights: BodyWeightEntry[];
  logs: DailyWorkoutLog[];
}

export const BodyWeightChartsPanel: React.FC<BodyWeightChartsPanelProps> = ({
  bodyWeights,
  logs
}) => {
  const sortedBw = useMemo(() => {
    return [...bodyWeights].sort((a, b) => a.date.localeCompare(b.date));
  }, [bodyWeights]);

  const initialWeight = sortedBw.length > 0 ? sortedBw[0].weightKg : null;
  const currentWeight = sortedBw.length > 0 ? sortedBw[sortedBw.length - 1].weightKg : null;
  const deltaWeight = initialWeight !== null && currentWeight !== null ? currentWeight - initialWeight : null;

  const weightChartConfig: ChartConfiguration = useMemo(() => {
    const labels = sortedBw.map(bw => formatSpanishDateShortYear(bw.date));
    const data = sortedBw.map(bw => bw.weightKg);

    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Peso Corporal (kg)',
            data,
            borderColor: '#a855f7',
            backgroundColor: 'rgba(168, 85, 247, 0.15)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.3,
            pointRadius: 5,
            pointBackgroundColor: '#a855f7'
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
  }, [sortedBw]);

  const pullupDays = useMemo(() => {
    const list: { date: string; maxReps: number }[] = [];
    for (const l of logs) {
      const st = l.strength.find(s => s.exerciseId === 'pullups');
      if (st) {
        const stats = normalizeStrengthEntry(st);
        if (stats.maxReps > 0) {
          list.push({ date: l.date, maxReps: stats.maxReps });
        }
      }
    }
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [logs]);

  const pullupComparisonConfig: ChartConfiguration = useMemo(() => {
    return {
      type: 'line',
      data: {
        labels: pullupDays.map(d => formatChartSpanishDate(d.date)),
        datasets: [
          {
            label: 'Reps Máx Dominadas',
            data: pullupDays.map(d => d.maxReps),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
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
  }, [pullupDays]);

  if (sortedBw.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '30px 16px', color: '#64748b' }}>
        No hay registros de peso corporal todavía. Puedes añadir tu peso mensual en la pestaña <strong>Ajustes</strong>.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Resumen del peso */}
      <div className="stat-grid">
        <div className="stat-box">
          <span className="stat-box-label">Peso Actual</span>
          <span className="stat-box-value" style={{ color: '#d8b4fe' }}>
            {formatWeightKg(currentWeight!)}
          </span>
          <span className="stat-box-sub">Última medición</span>
        </div>

        <div className="stat-box">
          <span className="stat-box-label">Variación Total</span>
          <span
            className="stat-box-value"
            style={{ color: deltaWeight! <= 0 ? '#34d399' : '#f59e0b' }}
          >
            {formatNumberWithSign(deltaWeight!)} kg
          </span>
          <span className="stat-box-sub">desde el inicio</span>
        </div>
      </div>

      {/* Gráfica de evolución mensual */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Evolución del Peso Corporal</div>
            <div className="card-subtitle">Historial de pesajes mensuales</div>
          </div>
        </div>
        <ChartCanvas config={weightChartConfig} height={220} />
      </div>

      {/* Comparativa con Dominadas */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Fuerza Relativa (Dominadas)</div>
            <div className="card-subtitle">Progresión de repeticiones en peso corporal</div>
          </div>
        </div>
        {pullupDays.length > 0 ? (
          <ChartCanvas config={pullupComparisonConfig} height={210} />
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 12px', color: '#64748b', fontSize: '0.84rem' }}>
            Sin sesiones de Dominadas en este periodo para comparar fuerza relativa.
          </div>
        )}
      </div>
    </div>
  );
};
