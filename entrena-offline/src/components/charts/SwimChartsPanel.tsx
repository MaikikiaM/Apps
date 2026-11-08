// src/components/charts/SwimChartsPanel.tsx
// Gráficas exhaustivas de natación: Totales, Estilos apilados, Curva individual por estilo, Tiempos, Ritmos y Donut

import React, { useState, useMemo } from 'react';
import { ChartCanvas } from '../common/ChartCanvas';
import { DailyWorkoutLog } from '../../types/models';
import { ChartConfiguration } from 'chart.js';
import { formatDurationMmSs } from '../../utils/formatters';

interface SwimChartsPanelProps {
  logs: DailyWorkoutLog[];
  showProjection: boolean;
}

export const SwimChartsPanel: React.FC<SwimChartsPanelProps> = ({ logs, showProjection }) => {
  const [selectedIndividualStroke, setSelectedIndividualStroke] = useState<'crawl' | 'back' | 'breast' | 'fly'>('crawl');

  const swimLogs = useMemo(() => {
    return logs
      .filter(l => l.swim && l.swim.totalMeters > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [logs]);

  if (swimLogs.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '30px 16px', color: '#64748b' }}>
        No hay sesiones de natación registradas todavía en el periodo seleccionado.
      </div>
    );
  }

  const labels = swimLogs.map(l => l.date.slice(5)); // 'MM-DD'

  // 1. Gráfica de Metros Totales + Proyección
  const totalMetersConfig: ChartConfiguration = useMemo(() => {
    const data = swimLogs.map(l => l.swim!.totalMeters);
    const datasets: any[] = [
      {
        label: 'Metros Totales',
        data,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.15)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.25,
        pointRadius: 4,
        pointBackgroundColor: '#06b6d4'
      }
    ];

    if (showProjection && data.length >= 3) {
      // Proyección simplificada para las siguientes 3 sesiones
      const last = data[data.length - 1];
      const prev = data[0];
      const delta = (last - prev) / Math.max(1, data.length - 1);
      const proj1 = Math.round(last + delta * 0.7);
      const proj2 = Math.round(last + delta * 1.3);

      datasets.push({
        label: 'Proyección futura',
        data: [...Array(data.length - 1).fill(null), last, proj1, proj2],
        borderColor: '#38bdf8',
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: '#38bdf8',
        fill: false
      });
    }

    const extendedLabels = [...labels];
    if (showProjection && data.length >= 3) {
      extendedLabels.push('+1s', '+2s');
    }

    return {
      type: 'line',
      data: {
        labels: extendedLabels,
        datasets
      },
      options: {
        scales: {
          y: {
            grid: { color: '#1e293b' },
            ticks: { color: '#94a3b8' }
          },
          x: {
            grid: { color: '#1e293b' },
            ticks: { color: '#94a3b8' }
          }
        }
      }
    };
  }, [swimLogs, labels, showProjection]);

  // 2. Gráfica Apilada por Estilos
  const stackedStrokesConfig: ChartConfiguration = useMemo(() => {
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Crol',
            data: swimLogs.map(l => l.swim!.crawlMeters),
            backgroundColor: '#06b6d4',
            stack: 'strokes'
          },
          {
            label: 'Espalda',
            data: swimLogs.map(l => l.swim!.backstrokeMeters),
            backgroundColor: '#3b82f6',
            stack: 'strokes'
          },
          {
            label: 'Braza',
            data: swimLogs.map(l => l.swim!.breaststrokeMeters),
            backgroundColor: '#10b981',
            stack: 'strokes'
          },
          {
            label: 'Mariposa',
            data: swimLogs.map(l => l.swim!.butterflyMeters),
            backgroundColor: '#f59e0b',
            stack: 'strokes'
          },
          {
            label: 'Otros / Mixto',
            data: swimLogs.map(l => {
              const sum = l.swim!.crawlMeters + l.swim!.backstrokeMeters + l.swim!.breaststrokeMeters + l.swim!.butterflyMeters;
              return Math.max(0, l.swim!.totalMeters - sum);
            }),
            backgroundColor: '#64748b',
            stack: 'strokes'
          }
        ]
      },
      options: {
        scales: {
          x: { stacked: true, grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } },
          y: { stacked: true, grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } }
        }
      }
    };
  }, [swimLogs, labels]);

  // 3. Gráfica Individual de cada estilo por separado
  const individualStrokeConfig: ChartConfiguration = useMemo(() => {
    const strokeKeyMap = {
      crawl: { key: 'crawlMeters' as const, label: 'Crol', color: '#06b6d4' },
      back: { key: 'backstrokeMeters' as const, label: 'Espalda', color: '#3b82f6' },
      breast: { key: 'breaststrokeMeters' as const, label: 'Braza', color: '#10b981' },
      fly: { key: 'butterflyMeters' as const, label: 'Mariposa', color: '#f59e0b' }
    };

    const target = strokeKeyMap[selectedIndividualStroke];
    const data = swimLogs.map(l => l.swim![target.key]);

    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: `Metros en ${target.label}`,
            data,
            borderColor: target.color,
            backgroundColor: `${target.color}22`,
            borderWidth: 2.5,
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: target.color
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
  }, [swimLogs, labels, selectedIndividualStroke]);

  // 4. Gráfica de Tiempos y Ritmo /100m
  const paceConfig: ChartConfiguration = useMemo(() => {
    const validPaceLogs = swimLogs.filter(l => l.swim!.durationSeconds > 0 && l.swim!.totalMeters > 0);
    const paceLabels = validPaceLogs.map(l => l.date.slice(5));
    // Ritmo en segundos por 100m
    const paceSecs = validPaceLogs.map(l => (l.swim!.durationSeconds / l.swim!.totalMeters) * 100);

    return {
      type: 'line',
      data: {
        labels: paceLabels,
        datasets: [
          {
            label: 'Ritmo Medio (/100m)',
            data: paceSecs,
            borderColor: '#34d399',
            backgroundColor: 'rgba(52, 211, 153, 0.1)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.2,
            pointRadius: 4,
            pointBackgroundColor: '#34d399'
          }
        ]
      },
      options: {
        scales: {
          y: {
            grid: { color: '#1e293b' },
            ticks: {
              color: '#94a3b8',
              callback: (val) => formatDurationMmSs(Number(val))
            }
          },
          x: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => `Ritmo: ${formatDurationMmSs(Number(ctx.parsed.y))} /100m`
            }
          }
        }
      }
    };
  }, [swimLogs]);

  // 5. Gráfica Donut de distribución histórica de estilos
  const donutConfig: ChartConfiguration = useMemo(() => {
    let totCrawl = 0;
    let totBack = 0;
    let totBreast = 0;
    let totFly = 0;
    let totOther = 0;

    for (const l of swimLogs) {
      totCrawl += l.swim!.crawlMeters;
      totBack += l.swim!.backstrokeMeters;
      totBreast += l.swim!.breaststrokeMeters;
      totFly += l.swim!.butterflyMeters;
      const sum = l.swim!.crawlMeters + l.swim!.backstrokeMeters + l.swim!.breaststrokeMeters + l.swim!.butterflyMeters;
      totOther += Math.max(0, l.swim!.totalMeters - sum);
    }

    return {
      type: 'doughnut',
      data: {
        labels: ['Crol', 'Espalda', 'Braza', 'Mariposa', 'Otros'],
        datasets: [
          {
            data: [totCrawl, totBack, totBreast, totFly, totOther],
            backgroundColor: ['#06b6d4', '#3b82f6', '#10b981', '#f59e0b', '#64748b'],
            borderColor: '#0b1120',
            borderWidth: 2
          }
        ]
      },
      options: {
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    };
  }, [swimLogs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Metros Totales */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Metros Totales por Sesión</div>
            <div className="card-subtitle">Evolución del volumen total de nado</div>
          </div>
        </div>
        <ChartCanvas config={totalMetersConfig} height={220} />
      </div>

      {/* 2. Desglose Apilado */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Desglose de Estilos por Día</div>
            <div className="card-subtitle">Volumen de cada estilo en cada sesión</div>
          </div>
        </div>
        <ChartCanvas config={stackedStrokesConfig} height={240} />
      </div>

      {/* 3. Curva Individual por Estilo */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Evolución por Estilo Individual</div>
            <div className="card-subtitle">Filtra para ver la curva exacta de un estilo</div>
          </div>
        </div>

        <div className="tab-pills">
          <button
            className={`tab-pill ${selectedIndividualStroke === 'crawl' ? 'active' : ''}`}
            onClick={() => setSelectedIndividualStroke('crawl')}
          >
            Crol
          </button>
          <button
            className={`tab-pill ${selectedIndividualStroke === 'back' ? 'active' : ''}`}
            onClick={() => setSelectedIndividualStroke('back')}
          >
            Espalda
          </button>
          <button
            className={`tab-pill ${selectedIndividualStroke === 'breast' ? 'active' : ''}`}
            onClick={() => setSelectedIndividualStroke('breast')}
          >
            Braza
          </button>
          <button
            className={`tab-pill ${selectedIndividualStroke === 'fly' ? 'active' : ''}`}
            onClick={() => setSelectedIndividualStroke('fly')}
          >
            Mariposa
          </button>
        </div>

        <ChartCanvas config={individualStrokeConfig} height={210} />
      </div>

      {/* 4. Ritmo /100m */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Ritmo Medio (/100m)</div>
            <div className="card-subtitle">Cuanto más baja la curva, más rápido nadas</div>
          </div>
        </div>
        <ChartCanvas config={paceConfig} height={210} />
      </div>

      {/* 5. Donut Histórico */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Distribución Histórica de Metros</div>
            <div className="card-subtitle">Porcentaje total acumulado por estilo</div>
          </div>
        </div>
        <ChartCanvas config={donutConfig} height={240} />
      </div>
    </div>
  );
};
