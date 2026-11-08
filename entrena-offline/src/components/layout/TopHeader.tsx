// src/components/layout/TopHeader.tsx
import React from 'react';
import { Waves, Flame } from 'lucide-react';
import { useAppData } from '../../db/useAppData';

export const TopHeader: React.FC = () => {
  const { logs } = useAppData();

  // Calcular racha activa (días consecutivos recientes entrenados o semanas)
  const totalWorkouts = logs.length;

  return (
    <header className="top-header">
      <div className="top-header-title">
        <Waves className="top-nav-icon" style={{ color: '#06b6d4', width: 24, height: 24 }} />
        <span>EntrenaOffline</span>
        <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, background: 'rgba(148, 163, 184, 0.1)', padding: '2px 6px', borderRadius: '6px' }}>v1.1</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {totalWorkouts > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: '#f59e0b',
              background: 'rgba(245, 158, 11, 0.12)',
              padding: '3px 8px',
              borderRadius: '9999px',
              border: '1px solid rgba(245, 158, 11, 0.3)'
            }}
          >
            <Flame size={14} />
            <span>{totalWorkouts}</span>
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
