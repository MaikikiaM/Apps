// src/components/logger/StrengthLoggerCard.tsx
// Tarjeta de registro flexible de fuerza: Calistenia y Pesas con mancuerna

import React from 'react';
import { Dumbbell, Plus, Trash2, Copy, Check } from 'lucide-react';
import { ExerciseDefinition, StrengthEntry, StrengthSet } from '../../types/models';

interface StrengthLoggerCardProps {
  category: 'calisthenics' | 'weights';
  exercises: ExerciseDefinition[];
  entries: StrengthEntry[];
  onChange: (updatedEntries: StrengthEntry[]) => void;
  lastUsedWeights: Map<string, number>; // Último peso usado en cada ejercicio
}

export const StrengthLoggerCard: React.FC<StrengthLoggerCardProps> = ({
  category,
  exercises,
  entries,
  onChange,
  lastUsedWeights
}) => {
  const categoryExercises = exercises.filter(e => e.category === category && !e.archived);
  const isWeights = category === 'weights';
  const categoryTitle = isWeights ? 'Pesas (Mancuernas)' : 'Calistenia';
  const accentColor = isWeights ? '#f59e0b' : '#10b981';

  // Ejercicios activos en el registro de hoy
  const activeEntriesMap = new Map(entries.map(e => [e.exerciseId, e]));

  const handleToggleExercise = (ex: ExerciseDefinition) => {
    if (activeEntriesMap.has(ex.id)) {
      // Quitar ejercicio
      onChange(entries.filter(e => e.exerciseId !== ex.id));
    } else {
      // Añadir ejercicio
      const defaultKg = lastUsedWeights.get(ex.id) || (ex.usesExternalWeight ? 12 : 0);
      const newEntry: StrengthEntry = {
        exerciseId: ex.id,
        mode: 'sets',
        sets: [
          { reps: 10, weightKg: defaultKg }
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
        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
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
              className={`chip ${isActive ? 'active' : ''}`}
              onClick={() => handleToggleExercise(ex)}
              style={isActive ? { borderColor: accentColor, color: accentColor } : undefined}
            >
              {isActive && <Check size={14} />}
              <span>{ex.name}</span>
            </button>
          );
        })}
      </div>

      {/* Lista de ejercicios activos a registrar */}
      {activeCategoryEntries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '12px 0', color: '#64748b', fontSize: '0.85rem' }}>
          Pulsa en cualquier ejercicio de arriba para anotarlo hoy
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {activeCategoryEntries.map(entry => {
            const def = exercises.find(e => e.id === entry.exerciseId);
            if (!def) return null;

            return (
              <ExerciseEntryBlock
                key={entry.exerciseId}
                def={def}
                entry={entry}
                accentColor={accentColor}
                onUpdate={updated => handleUpdateEntry(entry.exerciseId, updated)}
                onRemove={() => handleToggleExercise(def)}
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
  onUpdate: (updated: StrengthEntry) => void;
  onRemove: () => void;
}

const ExerciseEntryBlock: React.FC<ExerciseEntryBlockProps> = ({
  def,
  entry,
  accentColor,
  onUpdate,
  onRemove
}) => {
  const isSets = entry.mode === 'sets';

  const handleToggleMode = (mode: 'sets' | 'quick') => {
    if (mode === 'quick' && isSets) {
      // Migrar datos de series a modo rápido
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
      // Migrar datos rápidos a series
      const setsCount = entry.quickSetsCount || 3;
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
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}
    >
      {/* Cabecera del ejercicio */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>{def.name}</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{def.muscleGroup}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Conmutador Modo Series vs Modo Rápido */}
          <div className="tab-pills" style={{ height: '32px', padding: '2px' }}>
            <button
              className={`tab-pill ${isSets ? 'active' : ''}`}
              style={{ fontSize: '0.72rem', padding: '4px 8px' }}
              onClick={() => handleToggleMode('sets')}
            >
              Series
            </button>
            <button
              className={`tab-pill ${!isSets ? 'active' : ''}`}
              style={{ fontSize: '0.72rem', padding: '4px 8px' }}
              onClick={() => handleToggleMode('quick')}
            >
              Rápido
            </button>
          </div>

          <button
            className="btn btn-ghost btn-icon"
            style={{ width: 32, height: 32, minHeight: 32 }}
            onClick={onRemove}
            title="Quitar ejercicio"
          >
            <Trash2 size={15} color="#f43f5e" />
          </button>
        </div>
      </div>

      {/* Contenido en Modo Series */}
      {isSets ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 34px', gap: '6px', fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', paddingLeft: '4px' }}>
            <span>Serie</span>
            <span>Reps</span>
            <span>{def.usesExternalWeight ? 'Mancuerna' : 'Lastre (kg)'}</span>
            <span />
          </div>

          {entry.sets.map((set, idx) => (
            <div
              key={idx}
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr 1fr 34px',
                gap: '6px',
                alignItems: 'center'
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: accentColor, textAlign: 'center' }}>
                #{idx + 1}
              </span>

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="number"
                  min="0"
                  value={set.reps === 0 ? '' : set.reps}
                  placeholder="0"
                  onChange={e => handleSetChange(idx, 'reps', parseInt(e.target.value, 10) || 0)}
                  className="input-field"
                  style={{ minHeight: '38px', padding: '6px 8px', fontSize: '0.95rem', textAlign: 'center', width: '100%' }}
                />
              </div>

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={set.weightKg === 0 ? '' : set.weightKg}
                  placeholder={def.usesExternalWeight ? 'kg' : '0'}
                  onChange={e => handleSetChange(idx, 'weightKg', parseFloat(e.target.value) || 0)}
                  className="input-field"
                  style={{ minHeight: '38px', padding: '6px 8px', fontSize: '0.95rem', textAlign: 'center', width: '100%' }}
                />
              </div>

              <button
                className="btn btn-ghost btn-icon"
                style={{ width: 34, height: 34, minHeight: 34 }}
                onClick={() => handleRemoveSet(idx)}
                title="Eliminar serie"
              >
                <Trash2 size={14} color="#64748b" />
              </button>
            </div>
          ))}

          {/* Botones de añadir / repetir serie */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={handleAddSet}>
              <Plus size={14} />
              <span>Añadir serie</span>
            </button>
            <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={handleAddSet}>
              <Copy size={14} />
              <span>Repetir última</span>
            </button>
          </div>
        </div>
      ) : (
        /* Contenido en Modo Rápido */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          <div className="input-group">
            <label className="input-label">Total Reps del Día</label>
            <input
              type="number"
              min="0"
              value={entry.quickTotalReps === 0 ? '' : entry.quickTotalReps}
              placeholder="Ej. 30"
              onChange={e => onUpdate({ ...entry, quickTotalReps: parseInt(e.target.value, 10) || 0 })}
              className="input-field"
              style={{ minHeight: '40px' }}
            />
          </div>

          <div className="input-group">
            <label className="input-label">
              {def.usesExternalWeight ? 'Peso Mancuerna (kg)' : 'Lastre (kg)'}
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={entry.quickWeightKg === 0 ? '' : entry.quickWeightKg}
              placeholder="0"
              onChange={e => onUpdate({ ...entry, quickWeightKg: parseFloat(e.target.value) || 0 })}
              className="input-field"
              style={{ minHeight: '40px' }}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Mejor Serie (Reps)</label>
            <input
              type="number"
              min="0"
              value={entry.quickBestSetReps === 0 ? '' : entry.quickBestSetReps}
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
              min="1"
              value={entry.quickSetsCount || 3}
              placeholder="3"
              onChange={e => onUpdate({ ...entry, quickSetsCount: parseInt(e.target.value, 10) || 3 })}
              className="input-field"
              style={{ minHeight: '40px' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
