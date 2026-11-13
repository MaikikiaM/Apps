// src/components/logger/SwimLoggerCard.tsx
// Tarjeta de registro de natación por 4 estilos, metros totales, largos y tiempo dedicado (100% responsive móvil)

import React, { useState, useEffect } from 'react';
import { Waves, Clock, Trash2, Copy, Minus, Plus, RotateCcw } from 'lucide-react';
import { SwimSession } from '../../types/models';
import { formatSwimPace, formatMeters, formatDurationHuman } from '../../utils/formatters';
import { formatShortSpanishDate } from '../../utils/dates';

interface SwimLoggerCardProps {
  session: SwimSession | undefined;
  onChange: (session: SwimSession | undefined) => void;
  defaultPoolLength: 25 | 50;
  lastSwimSession?: { date: string; swim: SwimSession } | null;
}

const STROKE_META = [
  { key: 'crawlMeters' as const, name: 'Crol', color: '#06b6d4' },
  { key: 'backstrokeMeters' as const, name: 'Espalda', color: '#3b82f6' },
  { key: 'breaststrokeMeters' as const, name: 'Braza', color: '#10b981' },
  { key: 'butterflyMeters' as const, name: 'Mariposa', color: '#f59e0b' }
];

export const SwimLoggerCard: React.FC<SwimLoggerCardProps> = ({
  session,
  onChange,
  defaultPoolLength,
  lastSwimSession
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

  // Estados locales de texto para Minutos y Segundos para editar libremente sin saltos
  const [minsInput, setMinsInput] = useState<string>('');
  const [secsInput, setSecsInput] = useState<string>('');

  useEffect(() => {
    const mins = Math.floor(current.durationSeconds / 60);
    const secs = current.durationSeconds % 60;
    setMinsInput(mins === 0 ? '' : String(mins));
    setSecsInput(secs === 0 ? '' : String(secs));
  }, [current.durationSeconds]);

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

  const handleRepeatLastSwim = () => {
    if (!lastSwimSession) return;
    onChange({
      ...lastSwimSession.swim
    });
  };

  const updateStroke = (
    stroke: 'crawlMeters' | 'backstrokeMeters' | 'breaststrokeMeters' | 'butterflyMeters',
    deltaOrValue: number,
    isDelta = false
  ) => {
    const prevVal = current[stroke] || 0;
    const prevStrokeSum =
      (current.crawlMeters || 0) +
      (current.backstrokeMeters || 0) +
      (current.breaststrokeMeters || 0) +
      (current.butterflyMeters || 0);

    const newVal = Math.max(0, isDelta ? prevVal + deltaOrValue : deltaOrValue);

    const updated = {
      ...current,
      [stroke]: newVal
    };

    const newStrokeSum =
      (stroke === 'crawlMeters' ? newVal : updated.crawlMeters) +
      (stroke === 'backstrokeMeters' ? newVal : updated.backstrokeMeters) +
      (stroke === 'breaststrokeMeters' ? newVal : updated.breaststrokeMeters) +
      (stroke === 'butterflyMeters' ? newVal : updated.butterflyMeters);

    // Mantener totalMeters sincronizado si los estilos lo superan o si estaba vinculado exactamente a la suma previa
    if (newStrokeSum > updated.totalMeters) {
      updated.totalMeters = newStrokeSum;
    } else if (current.totalMeters === prevStrokeSum) {
      updated.totalMeters = newStrokeSum;
    }

    onChange(updated);
  };

  const handleTotalMetersChange = (val: number) => {
    const strokeSum =
      current.crawlMeters +
      current.backstrokeMeters +
      current.breaststrokeMeters +
      current.butterflyMeters;
    const newTotal = Math.max(strokeSum, Math.max(0, val));
    onChange({
      ...current,
      totalMeters: newTotal
    });
  };

  const commitDuration = (rawMins: string, rawSecs: string) => {
    const parsedMins = Math.max(0, parseInt(rawMins, 10) || 0);
    const parsedSecs = Math.max(0, parseInt(rawSecs, 10) || 0);
    const totalSeconds = parsedMins * 60 + parsedSecs;
    onChange({
      ...current,
      durationSeconds: totalSeconds
    });
  };

  const handleQuickMinutes = (minutes: number) => {
    const totalSeconds = Math.max(0, minutes * 60);
    onChange({
      ...current,
      durationSeconds: totalSeconds
    });
  };

  if (!isEnabled) {
    return (
      <div className="card" style={{ borderStyle: 'dashed' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
            <div style={{ background: 'rgba(6, 182, 212, 0.15)', padding: '10px', borderRadius: '12px', flexShrink: 0 }}>
              <Waves size={22} color="#06b6d4" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>Natación en Piscina</div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                Crol, espalda, braza, mariposa y tiempos
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            {lastSwimSession && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleRepeatLastSwim}
                title={`Copiar sesión del ${formatShortSpanishDate(lastSwimSession.date)}`}
              >
                <Copy size={13} />
                <span>Repetir ({lastSwimSession.swim.totalMeters}m)</span>
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={handleToggle}>
              + Añadir
            </button>
          </div>
        </div>
      </div>
    );
  }

  const strokeSum =
    current.crawlMeters +
    current.backstrokeMeters +
    current.breaststrokeMeters +
    current.butterflyMeters;
  const unassignedMeters = Math.max(0, current.totalMeters - strokeSum);
  const paceDisplay = formatSwimPace(current.totalMeters, current.durationSeconds);
  const totalLaps = current.poolLengthMeters > 0
    ? Math.round((current.totalMeters / current.poolLengthMeters) * 10) / 10
    : 0;

  return (
    <div className="card" style={{ borderColor: 'rgba(6, 182, 212, 0.4)' }}>
      {/* Header */}
      <div className="card-header">
        <div className="card-title">
          <Waves size={20} color="#06b6d4" />
          <span>Natación</span>
          {current.totalMeters > 0 && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#38bdf8',
                background: 'rgba(6, 182, 212, 0.14)',
                padding: '2px 8px',
                borderRadius: '9999px'
              }}
            >
              {totalLaps} largos
            </span>
          )}
        </div>
        <button
          className="btn btn-ghost btn-icon"
          style={{ width: 34, height: 34, minHeight: 34 }}
          onClick={() => onChange(undefined)}
          title="Quitar natación hoy"
          aria-label="Quitar natación hoy"
        >
          <Trash2 size={16} color="#f43f5e" />
        </button>
      </div>

      {/* Banner de Total y Ritmo */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.16), rgba(16, 185, 129, 0.08))',
          border: '1px solid rgba(6, 182, 212, 0.3)',
          borderRadius: '14px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.7rem', color: '#06b6d4', fontWeight: 700, textTransform: 'uppercase' }}>
              Metros Totales
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <input
                type="number"
                inputMode="numeric"
                step="25"
                min="0"
                value={current.totalMeters === 0 ? '' : current.totalMeters}
                placeholder="0"
                onChange={e => handleTotalMetersChange(parseInt(e.target.value, 10) || 0)}
                aria-label="Metros totales"
                style={{
                  width: '96px',
                  minWidth: 0,
                  background: 'rgba(15, 23, 42, 0.45)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: '8px',
                  padding: '2px 8px',
                  color: '#fff',
                  fontSize: '1.45rem',
                  fontWeight: 800,
                  outline: 'none',
                  fontVariantNumeric: 'tabular-nums'
                }}
              />
              <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 700 }}>m</span>
            </div>
            {unassignedMeters > 0 && (
              <div style={{ fontSize: '0.72rem', color: '#38bdf8', marginTop: '3px' }}>
                {strokeSum}m en estilos + {unassignedMeters}m variado
              </div>
            )}
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>
              Ritmo Medio
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#34d399' }}>
              {paceDisplay}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              {current.durationSeconds > 0 ? formatDurationHuman(current.durationSeconds) : 'Sin tiempo'}
            </div>
          </div>
        </div>

        {/* Barra proporcional de estilos */}
        {current.totalMeters > 0 && (
          <div style={{ display: 'flex', height: '6px', borderRadius: '9999px', overflow: 'hidden', background: 'rgba(15, 23, 42, 0.6)', gap: '1px' }}>
            {STROKE_META.map(st => {
              const val = current[st.key] || 0;
              if (val <= 0) return null;
              const pct = (val / current.totalMeters) * 100;
              return (
                <div
                  key={st.key}
                  style={{ width: `${pct}%`, backgroundColor: st.color }}
                  title={`${st.name}: ${formatMeters(val)}`}
                />
              );
            })}
            {unassignedMeters > 0 && (
              <div
                style={{ width: `${(unassignedMeters / current.totalMeters) * 100}%`, backgroundColor: '#64748b' }}
                title={`Variado: ${formatMeters(unassignedMeters)}`}
              />
            )}
          </div>
        )}
      </div>

      {/* Tiempo Dedicado (2 columnas amplias para Minutos y Segundos) */}
      <div className="input-group">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Clock size={14} color="#06b6d4" />
            <span>Tiempo Dedicado</span>
          </label>
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
            Minutos y segundos
          </span>
        </div>

        <div className="swim-time-grid">
          <div className="swim-time-box">
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={minsInput}
              placeholder="0"
              aria-label="Minutos dedicados"
              onChange={e => {
                const v = e.target.value;
                setMinsInput(v);
                commitDuration(v, secsInput);
              }}
              className="swim-time-input"
            />
            <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 700, flexShrink: 0 }}>
              min
            </span>
          </div>

          <div className="swim-time-box">
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max="59"
              value={secsInput}
              placeholder="00"
              aria-label="Segundos dedicados"
              onChange={e => {
                const v = e.target.value;
                setSecsInput(v);
                commitDuration(minsInput, v);
              }}
              onBlur={() => {
                // Si introdujeron >=60s, normalizar a min:seg automáticamente
                commitDuration(minsInput, secsInput);
              }}
              className="swim-time-input"
            />
            <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 700, flexShrink: 0 }}>
              seg
            </span>
          </div>
        </div>

        {/* Presets rápidos de duración */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
          {[15, 20, 30, 45, 60].map(m => {
            const active = Math.floor(current.durationSeconds / 60) === m && current.durationSeconds % 60 === 0;
            return (
              <button
                key={m}
                type="button"
                className={`chip ${active ? 'active' : ''}`}
                style={{ minHeight: '30px', padding: '3px 10px', fontSize: '0.74rem' }}
                onClick={() => handleQuickMinutes(m)}
              >
                {m} min
              </button>
            );
          })}
        </div>
      </div>

      {/* Selector de Piscina 25m / 50m en su propia fila limpia */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <span className="input-label">Piscina</span>
        <div className="tab-pills" style={{ maxWidth: '190px' }}>
          <button
            type="button"
            className={`tab-pill ${current.poolLengthMeters === 25 ? 'active' : ''}`}
            style={{ padding: '6px 10px' }}
            onClick={() => onChange({ ...current, poolLengthMeters: 25 })}
          >
            Corta 25m
          </button>
          <button
            type="button"
            className={`tab-pill ${current.poolLengthMeters === 50 ? 'active' : ''}`}
            style={{ padding: '6px 10px' }}
            onClick={() => onChange({ ...current, poolLengthMeters: 50 })}
          >
            Olímpica 50m
          </button>
        </div>
      </div>

      {/* Desglose de los 4 Estilos (Diseño móvil en 2 filas que nunca se sale del cuadro) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="input-label">Desglose por Estilos</span>
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
            Suma: {formatMeters(strokeSum)}
          </span>
        </div>

        {STROKE_META.map(st => (
          <StrokeRow
            key={st.key}
            name={st.name}
            meters={current[st.key]}
            poolLength={current.poolLengthMeters}
            accentColor={st.color}
            onChange={val => updateStroke(st.key, val)}
            onAdd={delta => updateStroke(st.key, delta, true)}
          />
        ))}
      </div>
    </div>
  );
};

interface StrokeRowProps {
  name: string;
  meters: number;
  poolLength: 25 | 50;
  accentColor: string;
  onChange: (val: number) => void;
  onAdd: (delta: number) => void;
}

const StrokeRow: React.FC<StrokeRowProps> = ({
  name,
  meters,
  poolLength,
  accentColor,
  onChange,
  onAdd
}) => {
  const laps = poolLength > 0 ? Math.round((meters / poolLength) * 10) / 10 : 0;

  return (
    <div className="swim-stroke-card">
      {/* Fila superior: nombre + largos + stepper de metros */}
      <div className="swim-stroke-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: accentColor, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#f8fafc' }}>{name}</div>
            {meters > 0 && (
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                {laps} {laps === 1 ? 'largo' : 'largos'}
              </div>
            )}
          </div>
        </div>

        <div className="swim-stroke-stepper">
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            style={{ width: 34, height: 34, minHeight: 34, borderRadius: '9px' }}
            onClick={() => onAdd(-25)}
            aria-label={`Restar 25m a ${name}`}
            disabled={meters <= 0}
          >
            <Minus size={14} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '9px', padding: '0 7px' }}>
            <input
              type="number"
              inputMode="numeric"
              step="25"
              min="0"
              value={meters === 0 ? '' : meters}
              placeholder="0"
              aria-label={`Metros de ${name}`}
              onChange={e => onChange(parseInt(e.target.value, 10) || 0)}
              style={{
                width: '56px',
                minWidth: 0,
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '0.95rem',
                fontWeight: 700,
                padding: '6px 0',
                textAlign: 'right',
                outline: 'none'
              }}
            />
            <span style={{ color: '#64748b', fontSize: '0.76rem', fontWeight: 700 }}>m</span>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-icon"
            style={{ width: 34, height: 34, minHeight: 34, borderRadius: '9px' }}
            onClick={() => onAdd(25)}
            aria-label={`Sumar 25m a ${name}`}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Fila inferior: botones rápidos adaptados al ancho completo */}
      <div className="swim-quick-grid">
        <button
          type="button"
          className="swim-quick-btn"
          style={{ color: meters > 0 ? '#94a3b8' : '#475569' }}
          onClick={() => onChange(0)}
          disabled={meters === 0}
          title={`Poner ${name} a 0`}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <RotateCcw size={11} /> 0
          </span>
        </button>
        <button type="button" className="swim-quick-btn" onClick={() => onAdd(50)}>
          +50
        </button>
        <button type="button" className="swim-quick-btn" onClick={() => onAdd(100)}>
          +100
        </button>
        <button type="button" className="swim-quick-btn" onClick={() => onAdd(200)}>
          +200
        </button>
      </div>
    </div>
  );
};
