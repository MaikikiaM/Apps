// src/components/logger/SwimLoggerCard.tsx
// Tarjeta de registro de natación por 4 estilos, metros totales y tiempo dedicado

import React from 'react';
import { Waves, Clock, Trash2 } from 'lucide-react';
import { SwimSession } from '../../types/models';
import { formatSwimPace } from '../../utils/formatters';

interface SwimLoggerCardProps {
  session: SwimSession | undefined;
  onChange: (session: SwimSession | undefined) => void;
  defaultPoolLength: 25 | 50;
}

export const SwimLoggerCard: React.FC<SwimLoggerCardProps> = ({
  session,
  onChange,
  defaultPoolLength
}) => {
  const isEnabled = !!session;

  const current: SwimSession = session || {
    crawlMeters: 0,
    backstrokeMeters: 0,
    breaststrokeMeters: 0,
    butterflyMeters: 0,
    totalMeters: 0,
    durationSeconds: 0,
    poolLengthMeters: defaultPoolLength
  };

  const handleToggle = () => {
    if (isEnabled) {
      onChange(undefined);
    } else {
      onChange({
        crawlMeters: 0,
        backstrokeMeters: 0,
        breaststrokeMeters: 0,
        butterflyMeters: 0,
        totalMeters: 500,
        durationSeconds: 600,
        poolLengthMeters: defaultPoolLength
      });
    }
  };

  const updateStroke = (stroke: 'crawlMeters' | 'backstrokeMeters' | 'breaststrokeMeters' | 'butterflyMeters', deltaOrValue: number, isDelta = false) => {
    const prevVal = current[stroke] || 0;
    const newVal = Math.max(0, isDelta ? prevVal + deltaOrValue : deltaOrValue);

    const updated = {
      ...current,
      [stroke]: newVal
    };

    const strokeSum =
      (stroke === 'crawlMeters' ? newVal : updated.crawlMeters) +
      (stroke === 'backstrokeMeters' ? newVal : updated.backstrokeMeters) +
      (stroke === 'breaststrokeMeters' ? newVal : updated.breaststrokeMeters) +
      (stroke === 'butterflyMeters' ? newVal : updated.butterflyMeters);

    // Si los estilos suman más que el total anterior, subimos el total automáticamente
    if (strokeSum > updated.totalMeters) {
      updated.totalMeters = strokeSum;
    } else if (updated.totalMeters === prevVal && prevVal > 0) {
      // Si el total estaba vinculado a la suma anterior, mantener sincronizado
      updated.totalMeters = strokeSum;
    }

    onChange(updated);
  };

  const handleTotalMetersChange = (val: number) => {
    const strokeSum = current.crawlMeters + current.backstrokeMeters + current.breaststrokeMeters + current.butterflyMeters;
    // El total debe ser al menos la suma de estilos
    const newTotal = Math.max(strokeSum, Math.max(0, val));
    onChange({
      ...current,
      totalMeters: newTotal
    });
  };

  const durationMins = Math.floor(current.durationSeconds / 60);
  const durationSecs = current.durationSeconds % 60;

  const handleDurationChange = (mins: number, secs: number) => {
    const safeMins = Math.max(0, mins);
    const safeSecs = Math.max(0, Math.min(59, secs));
    onChange({
      ...current,
      durationSeconds: safeMins * 60 + safeSecs
    });
  };

  if (!isEnabled) {
    return (
      <div className="card" style={{ borderStyle: 'dashed' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(6, 182, 212, 0.15)', padding: '10px', borderRadius: '12px' }}>
              <Waves size={24} color="#06b6d4" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>Natación en Piscina</div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Crol, espalda, braza, mariposa y tiempos</div>
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleToggle}>
            + Añadir
          </button>
        </div>
      </div>
    );
  }

  const strokeSum = current.crawlMeters + current.backstrokeMeters + current.breaststrokeMeters + current.butterflyMeters;
  const unassignedMeters = Math.max(0, current.totalMeters - strokeSum);
  const paceDisplay = formatSwimPace(current.totalMeters, current.durationSeconds);

  return (
    <div className="card" style={{ borderColor: 'rgba(6, 182, 212, 0.4)' }}>
      {/* Header */}
      <div className="card-header">
        <div className="card-title">
          <Waves size={20} color="#06b6d4" />
          <span>Natación</span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className="btn btn-ghost btn-icon"
            style={{ width: 34, height: 34, minHeight: 34 }}
            onClick={() => onChange(undefined)}
            title="Quitar natación hoy"
          >
            <Trash2 size={16} color="#f43f5e" />
          </button>
        </div>
      </div>

      {/* Banner de Total y Ritmo */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(16, 185, 129, 0.08))',
          border: '1px solid rgba(6, 182, 212, 0.3)',
          borderRadius: '12px',
          padding: '12px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div>
          <div style={{ fontSize: '0.72rem', color: '#06b6d4', fontWeight: 700, textTransform: 'uppercase' }}>
            Metros Totales
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <input
              type="number"
              step="25"
              min="0"
              value={current.totalMeters === 0 ? '' : current.totalMeters}
              placeholder="0"
              onChange={e => handleTotalMetersChange(parseInt(e.target.value, 10) || 0)}
              style={{
                width: '100px',
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '1.6rem',
                fontWeight: 800,
                outline: 'none',
                fontVariantNumeric: 'tabular-nums'
              }}
            />
            <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 600 }}>m</span>
          </div>
          {unassignedMeters > 0 && (
            <div style={{ fontSize: '0.72rem', color: '#38bdf8' }}>
              ({strokeSum}m en estilos + {unassignedMeters}m variado)
            </div>
          )}
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>
            Ritmo Medio
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#34d399' }}>
            {paceDisplay}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
            Piscina: {current.poolLengthMeters}m
          </div>
        </div>
      </div>

      {/* Tiempo Dedicado */}
      <div className="input-group">
        <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Clock size={14} color="#06b6d4" />
          <span>Tiempo Dedicado</span>
        </label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--bg-input)', borderRadius: '10px', padding: '0 10px', border: '1px solid var(--border-color)' }}>
            <input
              type="number"
              min="0"
              value={durationMins === 0 ? '' : durationMins}
              placeholder="0"
              onChange={e => handleDurationChange(parseInt(e.target.value, 10) || 0, durationSecs)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '1.1rem',
                fontWeight: 700,
                padding: '10px 0',
                outline: 'none'
              }}
            />
            <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>min</span>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--bg-input)', borderRadius: '10px', padding: '0 10px', border: '1px solid var(--border-color)' }}>
            <input
              type="number"
              min="0"
              max="59"
              value={durationSecs === 0 ? '' : durationSecs}
              placeholder="0"
              onChange={e => handleDurationChange(durationMins, parseInt(e.target.value, 10) || 0)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '1.1rem',
                fontWeight: 700,
                padding: '10px 0',
                outline: 'none'
              }}
            />
            <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>seg</span>
          </div>

          {/* Selector de piscina 25m / 50m */}
          <div className="tab-pills" style={{ height: '44px', padding: '2px' }}>
            <button
              className={`tab-pill ${current.poolLengthMeters === 25 ? 'active' : ''}`}
              style={{ padding: '8px 10px' }}
              onClick={() => onChange({ ...current, poolLengthMeters: 25 })}
            >
              25m
            </button>
            <button
              className={`tab-pill ${current.poolLengthMeters === 50 ? 'active' : ''}`}
              style={{ padding: '8px 10px' }}
              onClick={() => onChange({ ...current, poolLengthMeters: 50 })}
            >
              50m
            </button>
          </div>
        </div>
      </div>

      {/* Desglose de los 4 Estilos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
          Desglose por Estilos
        </div>

        {/* 1. CROL */}
        <StrokeRow
          name="Crol"
          meters={current.crawlMeters}
          accentColor="#06b6d4"
          onChange={val => updateStroke('crawlMeters', val)}
          onAdd={delta => updateStroke('crawlMeters', delta, true)}
        />

        {/* 2. ESPALDA */}
        <StrokeRow
          name="Espalda"
          meters={current.backstrokeMeters}
          accentColor="#3b82f6"
          onChange={val => updateStroke('backstrokeMeters', val)}
          onAdd={delta => updateStroke('backstrokeMeters', delta, true)}
        />

        {/* 3. BRAZA */}
        <StrokeRow
          name="Braza"
          meters={current.breaststrokeMeters}
          accentColor="#10b981"
          onChange={val => updateStroke('breaststrokeMeters', val)}
          onAdd={delta => updateStroke('breaststrokeMeters', delta, true)}
        />

        {/* 4. MARIPOSA */}
        <StrokeRow
          name="Mariposa"
          meters={current.butterflyMeters}
          accentColor="#f59e0b"
          onChange={val => updateStroke('butterflyMeters', val)}
          onAdd={delta => updateStroke('butterflyMeters', delta, true)}
        />
      </div>
    </div>
  );
};

interface StrokeRowProps {
  name: string;
  meters: number;
  accentColor: string;
  onChange: (val: number) => void;
  onAdd: (delta: number) => void;
}

const StrokeRow: React.FC<StrokeRowProps> = ({ name, meters, accentColor, onChange, onAdd }) => {
  return (
    <div
      style={{
        background: 'var(--bg-subtle)',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '85px' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: accentColor }} />
        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{name}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <input
          type="number"
          step="25"
          min="0"
          value={meters === 0 ? '' : meters}
          placeholder="0"
          onChange={e => onChange(parseInt(e.target.value, 10) || 0)}
          style={{
            width: '65px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '0.95rem',
            fontWeight: 700,
            padding: '6px 8px',
            textAlign: 'right',
            outline: 'none'
          }}
        />
        <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>m</span>
      </div>

      {/* Botones rápidos */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          className="btn btn-ghost btn-sm"
          style={{ minHeight: '30px', padding: '3px 8px', fontSize: '0.75rem', background: 'var(--bg-input)' }}
          onClick={() => onAdd(25)}
        >
          +25
        </button>
        <button
          className="btn btn-ghost btn-sm"
          style={{ minHeight: '30px', padding: '3px 8px', fontSize: '0.75rem', background: 'var(--bg-input)' }}
          onClick={() => onAdd(50)}
        >
          +50
        </button>
        <button
          className="btn btn-ghost btn-sm"
          style={{ minHeight: '30px', padding: '3px 8px', fontSize: '0.75rem', background: 'var(--bg-input)' }}
          onClick={() => onAdd(100)}
        >
          +100
        </button>
      </div>
    </div>
  );
};
