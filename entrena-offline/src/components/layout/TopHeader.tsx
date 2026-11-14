// src/components/layout/TopHeader.tsx
import React, { useMemo } from 'react';
import { Waves, Flame } from 'lucide-react';
import { useAppData } from '../../db/useAppData';
import { computeStreaksAndWeeklySummary } from '../../utils/stats';

export const TopHeader: React.FC = () => {
  const { logs, settings } = useAppData();

  const summary = useMemo(() => computeStreaksAndWeeklySummary(logs), [logs]);

  return (
    <header className="top-header">
      <div className="top-header-title">
        <Waves style={{ color: '#06b6d4', width: 22, height: 22, flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {settings.userName ? `Hola, ${settings.userName}` : 'EntrenaOffline'}
        </span>
        <span
          style={{
            fontSize: '0.68rem',
            color: '#94a3b8',
            fontWeight: 700,
            background: 'rgba(148, 163, 184, 0.12)',
            padding: '2px 6px',
            borderRadius: '6px',
            flexShrink: 0
          }}
        >
          v1.8
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        {summary.totalActiveDays > 0 && (
          <div
            title={
              summary.currentStreakDays > 0
                ? `Racha actual: ${summary.currentStreakDays} días seguidos (Total: ${summary.totalActiveDays})`
                : `Días entrenados: ${summary.totalActiveDays}`
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: summary.currentStreakDays > 0 ? '#f59e0b' : '#94a3b8',
              background: summary.currentStreakDays > 0 ? 'rgba(245, 158, 11, 0.14)' : 'rgba(148, 163, 184, 0.1)',
              padding: '3px 8px',
              borderRadius: '9999px',
              border: `1px solid ${summary.currentStreakDays > 0 ? 'rgba(245, 158, 11, 0.35)' : 'rgba(148, 163, 184, 0.25)'}`
            }}
          >
            <Flame size={13} />
            <span>
              {summary.currentStreakDays > 0 ? `${summary.currentStreakDays}d` : `${summary.totalActiveDays}`}
            </span>
          </div>
        )}

        <div className="badge-offline">
          <span className="badge-dot" />
          <span>Offline</span>
        </div>
      </div>
    </header>
  );
};
