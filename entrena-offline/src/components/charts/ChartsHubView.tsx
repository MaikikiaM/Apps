// src/components/charts/ChartsHubView.tsx
// Centro unificado de analíticas gráficas con filtro de rango y pestañas

import React, { useState, useMemo } from 'react';
import { Waves, Dumbbell, Weight, Sparkles } from 'lucide-react';
import { useAppData } from '../../db/useAppData';
import { SwimChartsPanel } from './SwimChartsPanel';
import { StrengthChartsPanel } from './StrengthChartsPanel';
import { BodyWeightChartsPanel } from './BodyWeightChartsPanel';
import { addDaysToDateKey, toLocalDateKey } from '../../utils/dates';

export type ChartCategoryTab = 'swim' | 'calisthenics' | 'weights' | 'weight';
export type TimeRange = '1M' | '3M' | '6M' | '1A' | 'ALL';

export const ChartsHubView: React.FC = () => {
  const { logs, exercises, bodyWeights } = useAppData();

  const [activeTab, setActiveTab] = useState<ChartCategoryTab>('swim');
  const [timeRange, setTimeRange] = useState<TimeRange>('3M');
  const [showProjection, setShowProjection] = useState<boolean>(true);

  // Filtrar logs según el rango de tiempo seleccionado
  const filteredLogs = useMemo(() => {
    if (timeRange === 'ALL') return logs;
    const todayKey = toLocalDateKey(new Date());
    let daysBack = 30;
    if (timeRange === '1M') daysBack = 30;
    if (timeRange === '3M') daysBack = 90;
    if (timeRange === '6M') daysBack = 180;
    if (timeRange === '1A') daysBack = 365;

    const startKey = addDaysToDateKey(todayKey, -daysBack);
    return logs.filter(l => l.date >= startKey);
  }, [logs, timeRange]);

  return (
    <div className="main-content">
      {/* Selector de Rango de Tiempo y Switch de Proyección */}
      <div className="card" style={{ padding: '10px 14px', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
            Periodo
          </span>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#38bdf8', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showProjection}
              onChange={e => setShowProjection(e.target.checked)}
              style={{ accentColor: '#06b6d4', width: 15, height: 15 }}
            />
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Sparkles size={13} /> Proyección
            </span>
          </label>
        </div>

        <div className="tab-pills">
          {(['1M', '3M', '6M', '1A', 'ALL'] as TimeRange[]).map(r => (
            <button
              key={r}
              className={`tab-pill ${timeRange === r ? 'active' : ''}`}
              onClick={() => setTimeRange(r)}
            >
              {r === 'ALL' ? 'Todo' : r}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-pestañas de Categoría */}
      <div className="tab-pills" style={{ background: 'var(--bg-card)', padding: '4px' }}>
        <button
          className={`tab-pill ${activeTab === 'swim' ? 'active' : ''}`}
          onClick={() => setActiveTab('swim')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <Waves size={15} color="#06b6d4" />
          <span>Natación</span>
        </button>

        <button
          className={`tab-pill ${activeTab === 'calisthenics' ? 'active' : ''}`}
          onClick={() => setActiveTab('calisthenics')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <Dumbbell size={15} color="#10b981" />
          <span>Calistenia</span>
        </button>

        <button
          className={`tab-pill ${activeTab === 'weights' ? 'active' : ''}`}
          onClick={() => setActiveTab('weights')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <Dumbbell size={15} color="#f59e0b" />
          <span>Pesas</span>
        </button>

        <button
          className={`tab-pill ${activeTab === 'weight' ? 'active' : ''}`}
          onClick={() => setActiveTab('weight')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <Weight size={15} color="#a855f7" />
          <span>Peso</span>
        </button>
      </div>

      {/* Panel Activo */}
      {activeTab === 'swim' && (
        <SwimChartsPanel logs={filteredLogs} showProjection={showProjection} />
      )}

      {activeTab === 'calisthenics' && (
        <StrengthChartsPanel
          category="calisthenics"
          exercises={exercises}
          logs={filteredLogs}
          showProjection={showProjection}
        />
      )}

      {activeTab === 'weights' && (
        <StrengthChartsPanel
          category="weights"
          exercises={exercises}
          logs={filteredLogs}
          showProjection={showProjection}
        />
      )}

      {activeTab === 'weight' && (
        <BodyWeightChartsPanel
          bodyWeights={bodyWeights}
          logs={filteredLogs}
        />
      )}
    </div>
  );
};
