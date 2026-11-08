// src/components/charts/BodyWeightChartsPanel.tsx
// Gráfica de evolución mensual del peso corporal y fuerza relativa

import React, { useMemo } from 'react';
import { ChartCanvas } from '../common/ChartCanvas';
import { BodyWeightEntry, DailyWorkoutLog } from '../../types/models';
import { ChartConfiguration } from 'chart.js';
import { formatWeightKg, formatNumberWithSign } from '../../utils/formatters';
import { normalizeStrengthEntry } from '../../math/progressionEngine';

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
  const deltaWeight = initialWeight && currentWeight ? (currentWeight - initialWeight) : null;

  // Gráfica de peso corporal continuo
  const weightChartConfig: ChartConfiguration = useMemo(() => {
    const labels = sortedBw.map(bw => bw.date);
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
            pointRadius: 6,
            pointBackgroundColor: '#a855f7'
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
  }, [sortedBw]);

  // Comparativa Peso vs Rendimiento en Dominadas
  const pullupComparisonConfig: ChartConfiguration = useMemo(() => {
    const pullupDays: { date: string; maxReps: number }[] = [];
    for (const l of logs) {
      const st = l.strength.find(s => s.exerciseId === 'pullups');
      if (st) {
        const stats = normalizeStrengthEntry(st);
        if (stats.maxReps > 0) {
          pullupDays.push({ date: l.date, maxReps: stats.maxReps });
        }
      }
    }
    pullupDays.sort((a, b) => a.date.localeCompare(b.date));

    return {
      type: 'line',
      data: {
        labels: pullupDays.map(d => d.date.slice(5)),
        datasets: [
          {
            label: 'Reps Máx Dominadas',
            data: pullupDays.map(d => d.maxReps),
            borderColor: '#10b981',
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            tension: 0.25,
            pointRadius: 4,
            pointBackgroundColor: '#10b981'
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
  }, [logs]);

  if (sortedBw.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '30px 16px', color: '#64748b' }}>
        No hay registros de peso corporal todavía. Puedes añadir tu peso mensual en la pestaña <strong>Ajustes</strong>.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
        <ChartCanvas config={pullupComparisonConfig} height={210} />
      </div>
    </div>
  );
};
