// src/components/settings/SettingsView.tsx
// Ajustes generales: Registro mensual de peso, gestión del catálogo de ejercicios, backup JSON y guía móvil

import React, { useState } from 'react';
import {
  Scale,
  Plus,
  Trash2,
  Download,
  Upload,
  Database,
  Smartphone,
  Edit2
} from 'lucide-react';
import { useAppData } from '../../db/useAppData';
import { ExerciseDefinition, ExerciseCategory, BodyWeightEntry } from '../../types/models';
import { toLocalDateKey, formatFriendlyDate } from '../../utils/dates';
import { exportDataAsJson, importDataFromJson } from '../../db/database';
import { formatWeightKg } from '../../utils/formatters';

export const SettingsView: React.FC = () => {
  const {
    bodyWeights,
    saveWeightRecord,
    deleteWeightRecord,
    exercises,
    saveExerciseDef,
    settings,
    updateSettings,
    loadDemoAndRefresh,
    clearDataAndRefresh,
    refreshData
  } = useAppData();

  // Estados locales para peso mensual
  const [newBwDate, setNewBwDate] = useState<string>(toLocalDateKey(new Date()));
  const [newBwKg, setNewBwKg] = useState<string>('');
  const [newBwNotes, setNewBwNotes] = useState<string>('');

  // Estados locales para nuevo ejercicio
  const [showNewExModal, setShowNewExModal] = useState<boolean>(false);
  const [newExName, setNewExName] = useState<string>('');
  const [newExCat, setNewExCat] = useState<ExerciseCategory>('calisthenics');
  const [newExMuscle, setNewExMuscle] = useState<string>('');

  // Estado para renombrar ejercicio
  const [editingExId, setEditingExId] = useState<string | null>(null);
  const [editingExName, setEditingExName] = useState<string>('');

  // Estado de mensajes
  const [statusMessage, setStatusMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const showStatus = (text: string, error = false) => {
    setStatusMessage({ text, error });
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Guardar peso corporal mensual
  const handleSaveWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    const kg = parseFloat(newBwKg);
    if (!kg || kg <= 20 || kg >= 300) {
      showStatus('Introduce un peso válido en kg (ej. 75.5)', true);
      return;
    }
    const entry: BodyWeightEntry = {
      date: newBwDate,
      weightKg: Math.round(kg * 10) / 10,
      notes: newBwNotes.trim() || undefined
    };
    await saveWeightRecord(entry);
    setNewBwKg('');
    setNewBwNotes('');
    showStatus('Peso corporal guardado correctamente ✓');
  };

  // Guardar nuevo ejercicio
  const handleCreateExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExName.trim()) {
      showStatus('El nombre del ejercicio no puede estar vacío', true);
      return;
    }
    const id = `custom_${Date.now()}`;
    const newEx: ExerciseDefinition = {
      id,
      name: newExName.trim(),
      category: newExCat,
      muscleGroup: newExMuscle.trim() || (newExCat === 'weights' ? 'Brazos / Torso' : 'Cuerpo Completo'),
      usesExternalWeight: newExCat === 'weights',
      difficultyFactor: 1.0,
      order: exercises.length + 1
    };
    await saveExerciseDef(newEx);
    setNewExName('');
    setNewExMuscle('');
    setShowNewExModal(false);
    showStatus(`Ejercicio "${newEx.name}" añadido al catálogo ✓`);
  };

  // Guardar renombrado
  const handleRenameExercise = async (ex: ExerciseDefinition) => {
    if (!editingExName.trim()) return;
    await saveExerciseDef({
      ...ex,
      name: editingExName.trim()
    });
    setEditingExId(null);
    showStatus('Ejercicio renombrado ✓');
  };

  // Exportar JSON
  const handleExportJson = async () => {
    try {
      const json = await exportDataAsJson();
      const blob = new Blob([json], { type: 'application/json' });
      const filename = `entrenamientos-backup-${toLocalDateKey(new Date())}.json`;

      // Intentar compartir con Web Share API si es móvil
      if (navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: 'application/json' })] })) {
        const file = new File([blob], filename, { type: 'application/json' });
        await navigator.share({
          files: [file],
          title: 'Copia de seguridad de Entrenamientos',
          text: 'Backup offline de mis entrenamientos'
        });
        showStatus('Copia compartida con éxito ✓');
        return;
      }

      // Descarga directa habitual
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showStatus('Archivo de copia guardado en Descargas ✓');
    } catch (err) {
      showStatus('Error al exportar los datos', true);
    }
  };

  // Importar JSON
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const res = await importDataFromJson(content);
      if (res.success) {
        await refreshData();
        showStatus(res.message);
      } else {
        showStatus(res.message, true);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  return (
    <div className="main-content">
      {/* Mensaje de estado flotante */}
      {statusMessage && (
        <div
          style={{
            position: 'sticky',
            top: '70px',
            zIndex: 60,
            background: statusMessage.error ? '#f43f5e' : '#10b981',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '0.85rem',
            textAlign: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
          }}
        >
          {statusMessage.text}
        </div>
      )}

      {/* 1. SECCIÓN PESO CORPORAL (1 VEZ AL MES) */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Scale size={20} color="#a855f7" />
            <span>Peso Corporal (Mensual)</span>
          </div>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
          Anótalo una vez al mes si quieres tener la curva de peso y la estimación de fuerza relativa en dominadas.
        </p>

        <form onSubmit={handleSaveWeight} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px' }}>
            <input
              type="date"
              value={newBwDate}
              onChange={e => setNewBwDate(e.target.value)}
              className="input-field"
              style={{ fontSize: '0.85rem' }}
            />
            <input
              type="number"
              step="0.1"
              placeholder="Peso en kg (ej. 75.5)"
              value={newBwKg}
              onChange={e => setNewBwKg(e.target.value)}
              className="input-field"
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Nota opcional (ej. Pesaje mensual)"
              value={newBwNotes}
              onChange={e => setNewBwNotes(e.target.value)}
              className="input-field"
              style={{ flex: 1, fontSize: '0.85rem' }}
            />
            <button type="submit" className="btn btn-primary btn-sm" style={{ padding: '0 16px' }}>
              <Plus size={16} />
              <span>Guardar</span>
            </button>
          </div>
        </form>

        {/* Historial de pesajes */}
        {bodyWeights.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
              Historial de Pesajes
            </div>
            {[...bodyWeights].reverse().map(bw => (
              <div
                key={bw.date}
                style={{
                  background: 'var(--bg-subtle)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#d8b4fe' }}>
                    {formatWeightKg(bw.weightKg)}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '8px' }}>
                    {formatFriendlyDate(bw.date)} ({bw.date})
                  </span>
                  {bw.notes && <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '6px' }}>· {bw.notes}</span>}
                </div>

                <button
                  className="btn btn-ghost btn-icon"
                  style={{ width: 30, height: 30, minHeight: 30 }}
                  onClick={() => deleteWeightRecord(bw.date)}
                  title="Eliminar pesaje"
                >
                  <Trash2 size={13} color="#f43f5e" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. CATÁLOGO DE EJERCICIOS */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <span>Catálogo de Ejercicios</span>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowNewExModal(!showNewExModal)}
          >
            <Plus size={15} />
            <span>Añadir</span>
          </button>
        </div>

        {/* Formulario para añadir ejercicio nuevo */}
        {showNewExModal && (
          <form
            onSubmit={handleCreateExercise}
            style={{
              background: 'var(--bg-subtle)',
              border: '1px solid var(--accent-cyan)',
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#38bdf8' }}>
              Nuevo Ejercicio
            </div>

            <div className="tab-pills">
              <button
                type="button"
                className={`tab-pill ${newExCat === 'calisthenics' ? 'active' : ''}`}
                onClick={() => setNewExCat('calisthenics')}
              >
                Calistenia
              </button>
              <button
                type="button"
                className={`tab-pill ${newExCat === 'weights' ? 'active' : ''}`}
                onClick={() => setNewExCat('weights')}
              >
                Pesas (Mancuerna)
              </button>
            </div>

            <input
              type="text"
              placeholder="Nombre del ejercicio (ej. Dominadas neutras)"
              value={newExName}
              onChange={e => setNewExName(e.target.value)}
              className="input-field"
            />

            <input
              type="text"
              placeholder="Grupo muscular (ej. Espalda / Bíceps)"
              value={newExMuscle}
              onChange={e => setNewExMuscle(e.target.value)}
              className="input-field"
            />

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowNewExModal(false)}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary btn-sm">
                Guardar ejercicio
              </button>
            </div>
          </form>
        )}

        {/* Lista de ejercicios con opción de renombrar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {exercises.map(ex => {
            const isEditing = editingExId === ex.id;
            const isWeight = ex.category === 'weights';

            return (
              <div
                key={ex.id}
                style={{
                  background: 'var(--bg-subtle)',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: '1px solid var(--border-color)'
                }}
              >
                {isEditing ? (
                  <div style={{ display: 'flex', gap: '6px', flex: 1, alignItems: 'center' }}>
                    <input
                      type="text"
                      value={editingExName}
                      onChange={e => setEditingExName(e.target.value)}
                      className="input-field"
                      style={{ minHeight: '34px', padding: '4px 8px', fontSize: '0.85rem', flex: 1 }}
                      autoFocus
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ minHeight: '34px' }}
                      onClick={() => handleRenameExercise(ex)}
                    >
                      OK
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ minHeight: '34px' }}
                      onClick={() => setEditingExId(null)}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: isWeight ? '#f59e0b' : '#34d399' }}>
                        {ex.name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        {isWeight ? 'Pesas (kg)' : 'Calistenia'} · {ex.muscleGroup}
                      </div>
                    </div>

                    <button
                      className="btn btn-ghost btn-icon"
                      style={{ width: 32, height: 32, minHeight: 32 }}
                      onClick={() => {
                        setEditingExId(ex.id);
                        setEditingExName(ex.name);
                      }}
                      title="Renombrar ejercicio"
                    >
                      <Edit2 size={14} color="#94a3b8" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. PREFERENCIAS DE PISCINA */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Piscina por Defecto</div>
        </div>
        <div className="tab-pills">
          <button
            className={`tab-pill ${settings.poolLengthDefault === 25 ? 'active' : ''}`}
            onClick={() => updateSettings({ ...settings, poolLengthDefault: 25 })}
          >
            Piscina Corta (25m)
          </button>
          <button
            className={`tab-pill ${settings.poolLengthDefault === 50 ? 'active' : ''}`}
            onClick={() => updateSettings({ ...settings, poolLengthDefault: 50 })}
          >
            Piscina Olímpica (50m)
          </button>
        </div>
      </div>

      {/* 4. COPIA DE SEGURIDAD LOCAL */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Database size={18} color="#06b6d4" />
            <span>Copia de Seguridad Offline</span>
          </div>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
          Tus datos se guardan exclusivamente en la memoria local de tu teléfono. Haz una copia de seguridad en JSON de vez en cuando para guardarla en tus archivos o transferirla a otro móvil.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          <button className="btn btn-primary" onClick={handleExportJson}>
            <Download size={16} />
            <span>Exportar Copia</span>
          </button>

          <label className="btn btn-secondary" style={{ cursor: 'pointer', textAlign: 'center' }}>
            <Upload size={16} />
            <span>Restaurar Copia</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportFile}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {/* 5. MODO PRUEBA / DATOS DE DEMO */}
      <div className="card" style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
        <div className="card-header">
          <div className="card-title">
            <Smartphone size={18} color="#f59e0b" />
            <span>Datos de Prueba y Verificación</span>
          </div>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
          Puedes rellenar la app con 90 días de entrenamientos realistas (natación, calistenia, pesas y 3 pesajes mensuales) para ver todas las gráficas y el motor matemático en acción al instante.
        </p>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary btn-sm"
            style={{ flex: 1, borderColor: '#f59e0b', color: '#f59e0b' }}
            onClick={async () => {
              await loadDemoAndRefresh();
              showStatus('¡90 días de datos de ejemplo cargados con éxito! Revisa la pestaña Gráficas y Avance ✓');
            }}
          >
            Cargar 90 días de demo
          </button>

          <button
            className="btn btn-ghost btn-sm"
            style={{ color: '#f43f5e' }}
            onClick={async () => {
              if (window.confirm('¿Seguro que quieres borrar todos los entrenamientos y pesajes?')) {
                await clearDataAndRefresh();
                showStatus('Datos vaciados correctamente');
              }
            }}
          >
            Vaciar datos
          </button>
        </div>
      </div>

      {/* 6. GUÍA DE INSTALACIÓN EN MÓVIL */}
      <div className="card" style={{ background: 'var(--bg-subtle)' }}>
        <div className="card-title" style={{ fontSize: '0.9rem' }}>
          <span>¿Cómo instalar en la pantalla de inicio del móvil?</span>
        </div>
        <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.45', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <strong>En Android (Chrome):</strong> Pulsa en los tres puntos ⋮ arriba a la derecha y selecciona <strong>"Instalar aplicación"</strong> o <strong>"Añadir a pantalla de inicio"</strong>.
          </div>
          <div>
            <strong>En iPhone (Safari):</strong> Pulsa el botón de <strong>Compartir</strong> (icono de cuadrado con flecha hacia arriba) y selecciona <strong>"Añadir a pantalla de inicio"</strong>.
          </div>
          <div style={{ color: '#34d399', fontSize: '0.75rem', fontWeight: 600 }}>
            ✓ Una vez instalada, funcionará siempre aunque pongas el teléfono en Modo Avión sin conexión.
          </div>
        </div>
      </div>
    </div>
  );
};
