// src/components/logger/RestTimerBar.tsx
// Temporizador de descanso offline para series de fuerza con aviso sonoro y vibración

import React, { useState, useEffect, useRef } from 'react';
import { Timer, Play, Pause, RotateCcw, Plus, X } from 'lucide-react';
import { formatDurationMmSs } from '../../utils/formatters';

interface RestTimerBarProps {
  defaultSeconds?: number;
  onClose: () => void;
}

function playBeepNotification(): void {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([180, 90, 180]);
    }
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    [660, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.16);
      gain.gain.setValueAtTime(0.001, now + idx * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.16 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.16 + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.16);
      osc.stop(now + idx * 0.16 + 0.16);
    });
  } catch {
    // Ignorar si el navegador bloquea WebAudio sin interacción
  }
}

export const RestTimerBar: React.FC<RestTimerBarProps> = ({
  defaultSeconds = 90,
  onClose
}) => {
  const [presetSeconds, setPresetSeconds] = useState<number>(defaultSeconds);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(defaultSeconds);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [finished, setFinished] = useState<boolean>(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = window.setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          setIsRunning(false);
          setFinished(true);
          playBeepNotification();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning]);

  const handleSelectPreset = (secs: number) => {
    setPresetSeconds(secs);
    setRemainingSeconds(secs);
    setFinished(false);
    setIsRunning(true);
  };

  const handleTogglePlay = () => {
    if (remainingSeconds === 0) {
      setRemainingSeconds(presetSeconds);
      setFinished(false);
      setIsRunning(true);
    } else {
      setFinished(false);
      setIsRunning(prev => !prev);
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setFinished(false);
    setRemainingSeconds(presetSeconds);
  };

  const handleAdd15 = () => {
    setFinished(false);
    setRemainingSeconds(prev => prev + 15);
  };

  const progressPct = presetSeconds > 0 ? Math.min(100, (remainingSeconds / presetSeconds) * 100) : 0;

  return (
    <div
      className="rest-timer-card"
      style={{
        borderColor: finished ? '#10b981' : isRunning ? '#06b6d4' : 'var(--border-color)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Timer size={18} color={finished ? '#34d399' : '#06b6d4'} />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: finished ? '#34d399' : '#e2e8f0' }}>
            {finished ? '¡Descanso completado!' : 'Descanso entre series'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '1.35rem',
              fontWeight: 900,
              color: finished ? '#34d399' : isRunning ? '#38bdf8' : '#fff',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {formatDurationMmSs(remainingSeconds)}
          </span>
          <button
            className="btn btn-ghost btn-icon"
            style={{ width: 28, height: 28, minHeight: 28 }}
            onClick={onClose}
            aria-label="Cerrar temporizador"
          >
            <X size={15} color="#94a3b8" />
          </button>
        </div>
      </div>

      {/* Barra visual de tiempo */}
      <div className="goal-track" style={{ height: '5px' }}>
        <div
          className="goal-fill"
          style={{
            width: `${progressPct}%`,
            background: finished
              ? '#10b981'
              : 'linear-gradient(90deg, #06b6d4, #38bdf8)'
          }}
        />
      </div>

      {/* Controles y Presets */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[60, 90, 120, 180].map(sec => (
            <button
              key={sec}
              className={`chip ${presetSeconds === sec ? 'active' : ''}`}
              style={{ minHeight: '30px', padding: '4px 8px', fontSize: '0.73rem' }}
              onClick={() => handleSelectPreset(sec)}
            >
              {sec < 120 ? `${sec}s` : `${sec / 60}m`}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '5px' }}>
          <button
            className="btn btn-secondary btn-sm"
            style={{ minHeight: '32px', padding: '4px 8px' }}
            onClick={handleAdd15}
            title="Sumar 15 segundos"
          >
            <Plus size={12} />15s
          </button>
          <button
            className="btn btn-primary btn-sm"
            style={{ minHeight: '32px', padding: '4px 10px' }}
            onClick={handleTogglePlay}
          >
            {isRunning ? <Pause size={13} /> : <Play size={13} />}
            <span>{isRunning ? 'Pausa' : 'Iniciar'}</span>
          </button>
          <button
            className="btn btn-ghost btn-icon"
            style={{ width: 32, height: 32, minHeight: 32 }}
            onClick={handleReset}
            aria-label="Reiniciar temporizador"
          >
            <RotateCcw size={14} color="#94a3b8" />
          </button>
        </div>
      </div>
    </div>
  );
};
