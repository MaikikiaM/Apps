// src/components/logger/StrengthLoggerCard.tsx
// Tarjeta de registro flexible de fuerza: Calistenia y Pesas con mancuerna, marca anterior, PRs y descanso

import React, { useState } from 'react';
import {
  Dumbbell,
  Plus,
  Trash2,
  Copy,
  Check,
  Trophy,
  History,
  ChevronDown,
  ChevronUp,
  Timer
} from 'lucide-react';
import { ExerciseDefinition, StrengthEntry, StrengthSet } from '../../types/models';
import { LastExercisePerformance, ExercisePersonalRecord } from '../../utils/stats';
import { normalizeStrengthEntry } from '../../math/progressionEngine';
import { formatShortSpanishDate } from '../../utils/dates';
import { formatWeightKg } from '../../utils/formatters';

interface StrengthLoggerCardProps {
  category: 'calisthenics' | 'weights';
  exercises: ExerciseDefinition[];
  entries: StrengthEntry[];
  onChange: (updatedEntries: StrengthEntry[]) => void;
  lastUsedWeights: Map<string, number>;
  lastPerformances?: Map<string, LastExercisePerformance>;
  personalRecords?: Map<string, ExercisePersonalRecord>;
  onStartRestTimer?: () => void;
}

export const StrengthLoggerCard: React.FC<StrengthLoggerCardProps> = ({
  category,
  exercises,
  entries,
  onChange,
  lastUsedWeights,
  lastPerformances,
  personalRecords,
  onStartRestTimer
}) => {
  const categoryExercises = exercises.filter(e => e.category === category && !e.archived);
  const isWeights = category === 'weights';
  const categoryTitle = isWeights ? 'Pesas (Mancuernas)' : 'Calistenia';
  const accentColor = isWeights ? '#f59e0b' : '#10b981';

  const activeEntriesMap = new Map(entries.map(e => [e.exerciseId, e]));

  const handleToggleExercise = (ex: ExerciseDefinition) => {
    if (activeEntriesMap.has(ex.id)) {
      onChange(entries.filter(e => e.exerciseId !== ex.id));
    } else {
      const lastPerf = lastPerformances?.get(ex.id);
      const defaultKg = lastPerf?.workingWeightKg || lastUsedWeights.get(ex.id) || (ex.usesExternalWeight ? 12 : 0);
      const defaultReps = lastPerf && lastPerf.entry.mode === 'sets' && lastPerf.entry.sets[0]
        ? lastPerf.entry.sets[0].reps
        : 10;

      const newEntry: StrengthEntry = {
        exerciseId: ex.id,
        mode: 'sets',
        sets: [
          { reps: defaultReps, weightKg: defaultKg }
        ]
      };
      onChange([...entries, newEntry]);
    }
  };

  const handleUpdateEntry = (exerciseId: string, updated: StrengthEntry) => {
    onChange(entries.map(e => (e.exerciseId === exerciseId ? updated : e)));
  };

  const activeCategoryEntries = entries.filter(entry => {
    const def = exercises.find(e => e.id === entry.exerciseId);
    return def?.category === category;
  });

  return (
    <div className="card" style={{ borderColor: activeCategoryEntries.length > 0 ? `${accentColor}55` : undefined }}>
      <div className="card-header">
        <div className="card-title">
          <Dumbbell size={20} color={accentColor} />
          <span>{categoryTitle}</span>
        </div>
        <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
          {activeCategoryEntries.length} {activeCategoryEntries.length === 1 ? 'ejercicio' : 'ejercicios'}
        </span>
      </div>

      {/* Selector de Chips de ejercicios disponibles */}
      <div className="chip-group">
        {categoryExercises.map(ex => {
          const isActive = activeEntriesMap.has(ex.id);
          return (
            <button
              key={ex.id}
              type="button"
              className={`chip ${isActive ? 'active' : ''}`}
              onClick={() => handleToggleExercise(ex)}
              style={isActive ? { borderColor: accentColor, color: accentColor, background: `${accentColor}20` } : undefined}
            >
              {isActive && <Check size={14} />}
              <span>{ex.name}</span>
            </button>
          );
        })}
      </div>

      {/* Lista de ejercicios activos a registrar */}
      {activeCategoryEntries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '10px 0', color: '#64748b', fontSize: '0.84rem' }}>
          Pulsa en cualquier ejercicio de arriba para anotarlo hoy
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {activeCategoryEntries.map(entry => {
            const def = exercises.find(e => e.id === entry.exerciseId);
            if (!def) return null;

            return (
              <ExerciseEntryBlock
                key={entry.exerciseId}
                def={def}
                entry={entry}
                accentColor={accentColor}
                lastPerf={lastPerformances?.get(entry.exerciseId)}
                record={personalRecords?.get(entry.exerciseId)}
                onUpdate={updated => handleUpdateEntry(entry.exerciseId, updated)}
                onRemove={() => handleToggleExercise(def)}
                onStartRestTimer={onStartRestTimer}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

interface ExerciseEntryBlockProps {
  def: ExerciseDefinition;
  entry: StrengthEntry;
  accentColor: string;
  lastPerf?: LastExercisePerformance;
  record?: ExercisePersonalRecord;
  onUpdate: (updated: StrengthEntry) => void;
  onRemove: () => void;
  onStartRestTimer?: () => void;
}

const ExerciseEntryBlock: React.FC<ExerciseEntryBlockProps> = ({
  def,
  entry,
  accentColor,
  lastPerf,
  record,
  onUpdate,
  onRemove,
  onStartRestTimer
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const isSets = entry.mode === 'sets';
  const currentStats = normalizeStrengthEntry(entry);

  // Detectar si supera récord histórico previo
  const isNewPR = (() => {
    if (!record || currentStats.totalReps <= 0) return false;
    if (def.category === 'weights') {
      return currentStats.estimated1RM > record.bestEstimated1RM + 0.05;
    }
    return currentStats.maxReps > record.bestMaxReps;
  })();

  const handleToggleMode = (mode: 'sets' | 'quick') => {
    if (mode === 'quick' && isSets) {
      const totalReps = entry.sets.reduce((acc, s) => acc + s.reps, 0);
      const maxReps = entry.sets.length > 0 ? Math.max(...entry.sets.map(s => s.reps)) : 10;
      const weight = entry.sets.length > 0 ? Math.max(...entry.sets.map(s => s.weightKg || 0)) : 0;
      onUpdate({
        ...entry,
        mode: 'quick',
        quickTotalReps: totalReps || 24,
        quickBestSetReps: maxReps || 10,
        quickSetsCount: entry.sets.length || 3,
        quickWeightKg: weight
      });
    } else if (mode === 'sets' && !isSets) {
      const setsCount = Math.max(1, entry.quickSetsCount || 3);
      const repsPerSet = Math.max(1, Math.round((entry.quickTotalReps || 24) / setsCount));
      const sets: StrengthSet[] = Array.from({ length: setsCount }, () => ({
        reps: repsPerSet,
        weightKg: entry.quickWeightKg || 0
      }));
      onUpdate({
        ...entry,
        mode: 'sets',
        sets
      });
    }
  };

  const handleCopyLastSession = () => {
    if (!lastPerf) return;
    onUpdate({
      ...lastPerf.entry,
      sets: lastPerf.entry.sets.map(s => ({ ...s }))
    });
  };

  const handleSetChange = (idx: number, field: 'reps' | 'weightKg', val: number) => {
    const newSets = [...entry.sets];
    newSets[idx] = {
      ...newSets[idx],
      [field]: Math.max(0, val)
    };
    onUpdate({ ...entry, sets: newSets });
  };

  const handleAddSet = () => {
    const lastSet = entry.sets[entry.sets.length - 1];
    const newSet: StrengthSet = lastSet
      ? { reps: lastSet.reps, weightKg: lastSet.weightKg }
      : { reps: 10, weightKg: def.usesExternalWeight ? 12 : 0 };
    onUpdate({
      ...entry,
      sets: [...entry.sets, newSet]
    });
  };

  const handleRemoveSet = (idx: number) => {
    if (entry.sets.length <= 1) {
      onRemove();
      return;
    }
    const newSets = entry.sets.filter((_, i) => i !== idx);
    onUpdate({ ...entry, sets: newSets });
  };

  return (
    <div
      style={{
        background: 'var(--bg-subtle)',
        border: `1px solid ${isNewPR ? 'rgba(245, 158, 11, 0.5)' : 'var(--border-color)'}`,
        borderRadius: '14px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        minWidth: 0
      }}
    >
      {/* Cabecera del ejercicio con wrap seguro en móvil */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 160px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>{def.name}</span>
            {isNewPR && (
              <span className="badge-pr">
                <Trophy size={11} /> Nuevo Récord
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '2px' }}>
            {currentStats.setsCount} {currentStats.setsCount === 1 ? 'serie' : 'series'} · {currentStats.totalReps} reps
            {currentStats.tonnageKg > 0 && ` · ${Math.round(currentStats.tonnageKg)} kg movidos`}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
          {/* Conmutador Modo Series vs Modo Rápido */}
          <div className="tab-pills" style={{ width: 'auto', padding: '2px' }}>
            <button
              type="button"
              className={`tab-pill ${isSets ? 'active' : ''}`}
              style={{ fontSize: '0.72rem', padding: '5px 8px' }}
              onClick={() => handleToggleMode('sets')}
            >
              Series
            </button>
            <button
              type="button"
              className={`tab-pill ${!isSets ? 'active' : ''}`}
              style={{ fontSize: '0.72rem', padding: '5px 8px' }}
              onClick={() => handleToggleMode('quick')}
            >
              Rápido
            </button>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-icon"
            style={{ width: 32, height: 32, minHeight: 32 }}
            onClick={() => setIsCollapsed(c => !c)}
            aria-label={isCollapsed ? 'Expandir ejercicio' : 'Plegar ejercicio'}
          >
            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-icon"
            style={{ width: 32, height: 32, minHeight: 32 }}
            onClick={onRemove}
            title="Quitar ejercicio"
            aria-label={`Quitar ${def.name}`}
          >
            <Trash2 size={15} color="#f43f5e" />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Referencia de la última sesión */}
          {lastPerf && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                background: 'rgba(30, 41, 66, 0.55)',
                borderRadius: '9px',
                padding: '6px 10px',
                fontSize: '0.74rem',
                color: '#cbd5e1',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                <History size={13} color="#38bdf8" style={{ flexShrink: 0 }} />
                <span>
                  Última ({formatShortSpanishDate(lastPerf.date)}):{' '}
                  <strong>
                    {lastPerf.setsCount}×{lastPerf.maxReps}
                  </strong>
                  {lastPerf.workingWeightKg > 0 ? ` @ ${formatWeightKg(lastPerf.workingWeightKg)}` : ''}
                  {' '}({lastPerf.totalReps} reps)
                </span>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ minHeight: '26px', padding: '2px 8px', fontSize: '0.72rem', color: '#38bdf8' }}
                onClick={handleCopyLastSession}
              >
                <Copy size={11} /> Copiar
              </button>
            </div>
          )}

          {/* Contenido en Modo Series */}
          {isSets ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '32px minmax(0, 1fr) minmax(0, 1fr) 32px',
                  gap: '6px',
                  fontSize: '0.7rem',
                  color: '#64748b',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  paddingLeft: '2px'
                }}
              >
                <span style={{ textAlign: 'center' }}>#</span>
                <span style={{ textAlign: 'center' }}>Reps</span>
                <span style={{ textAlign: 'center' }}>
                  {def.usesExternalWeight ? 'Peso (kg)' : 'Lastre (kg)'}
                </span>
                <span />
              </div>

              {entry.sets.map((set, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '32px minmax(0, 1fr) minmax(0, 1fr) 32px',
                    gap: '6px',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ fontWeight: 800, fontSize: '0.84rem', color: accentColor, textAlign: 'center' }}>
                    #{idx + 1}
                  </span>

                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={set.reps === 0 ? '' : set.reps}
                    placeholder="0"
                    aria-label={`Repeticiones serie ${idx + 1}`}
                    onChange={e => handleSetChange(idx, 'reps', parseInt(e.target.value, 10) || 0)}
                    className="input-field"
                    style={{ minHeight: '40px', padding: '6px 8px', fontSize: '0.96rem', textAlign: 'center' }}
                  />

                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min="0"
                    value={set.weightKg === 0 ? '' : set.weightKg}
                    placeholder={def.usesExternalWeight ? 'kg' : '0'}
                    aria-label={`Peso serie ${idx + 1}`}
                    onChange={e => handleSetChange(idx, 'weightKg', parseFloat(e.target.value) || 0)}
                    className="input-field"
                    style={{ minHeight: '40px', padding: '6px 8px', fontSize: '0.96rem', textAlign: 'center' }}
                  />

                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    style={{ width: 32, height: 34, minHeight: 34 }}
                    onClick={() => handleRemoveSet(idx)}
                    title="Eliminar serie"
                    aria-label={`Eliminar serie ${idx + 1}`}
                  >
                    <Trash2 size={14} color="#64748b" />
                  </button>
                </div>
              ))}

              {/* Botones de añadir serie + descanso */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={handleAddSet}>
                  <Plus size={14} />
                  <span>Añadir serie</span>
                </button>
                {onStartRestTimer && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ borderColor: 'rgba(6, 182, 212, 0.4)', color: '#38bdf8' }}
                    onClick={onStartRestTimer}
                  >
                    <Timer size={14} />
                    <span>Descanso</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Contenido en Modo Rápido */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
              <div className="input-group">
                <label className="input-label">Total Reps</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={entry.quickTotalReps === 0 || entry.quickTotalReps === undefined ? '' : entry.quickTotalReps}
                  placeholder="Ej. 30"
                  onChange={e => onUpdate({ ...entry, quickTotalReps: parseInt(e.target.value, 10) || 0 })}
                  className="input-field"
                  style={{ minHeight: '40px' }}
                />
              </div>

              <div className="input-group">
                <label className="input-label">
                  {def.usesExternalWeight ? 'Peso (kg)' : 'Lastre (kg)'}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  min="0"
                  value={entry.quickWeightKg === 0 || entry.quickWeightKg === undefined ? '' : entry.quickWeightKg}
                  placeholder="0"
                  onChange={e => onUpdate({ ...entry, quickWeightKg: parseFloat(e.target.value) || 0 })}
                  className="input-field"
                  style={{ minHeight: '40px' }}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Mejor Serie</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={entry.quickBestSetReps === 0 || entry.quickBestSetReps === undefined ? '' : entry.quickBestSetReps}
                  placeholder="Opcional"
                  onChange={e => onUpdate({ ...entry, quickBestSetReps: parseInt(e.target.value, 10) || undefined })}
                  className="input-field"
                  style={{ minHeight: '40px' }}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Nº de Series</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={entry.quickSetsCount === undefined ? '' : entry.quickSetsCount}
                  placeholder="3"
                  onChange={e => {
                    const parsed = parseInt(e.target.value, 10);
                    onUpdate({ ...entry, quickSetsCount: isNaN(parsed) ? undefined : Math.max(0, parsed) });
                  }}
                  onBlur={() => {
                    if (!entry.quickSetsCount || entry.quickSetsCount < 1) {
                      onUpdate({ ...entry, quickSetsCount: 3 });
                    }
                  }}
                  className="input-field"
                  style={{ minHeight: '40px' }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
