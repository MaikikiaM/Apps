// src/components/settings/SettingsView.tsx
// Ajustes generales: Perfil y metas, peso corporal, catálogo, centro de seguridad/respaldo y guía móvil

import React, { useState } from 'react';
import {
  Scale,
  Plus,
  Trash2,
  Download,
  Upload,
  Smartphone,
  Edit2,
  Target,
  Archive,
  RotateCcw,
  ShieldCheck,
  History,
  BookmarkPlus
} from 'lucide-react';
import { useAppData } from '../../db/useAppData';
import { ExerciseDefinition, ExerciseCategory, BodyWeightEntry, SafetySnapshot } from '../../types/models';
import { toLocalDateKey, formatFriendlyDate } from '../../utils/dates';
import { exportDataAsJson, exportBackupToDeviceDownloads, importDataFromJson } from '../../db/database';
import { formatWeightKg } from '../../utils/formatters';

export const SettingsView: React.FC = () => {
  const {
    logs,
    bodyWeights,
    saveWeightRecord,
    deleteWeightRecord,
    exercises,
    saveExerciseDef,
    settings,
    updateSettings,
    loadDemoAndRefresh,
    clearDataAndRefresh,
    storageHealth,
    safetySnapshots,
    createManualSnapshot,
    restoreFromSnapshot,
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
  const [newExExternalWeight, setNewExExternalWeight] = useState<boolean>(false);

  // Estado para editar ejercicio
  const [editingExId, setEditingExId] = useState<string | null>(null);
  const [editingExName, setEditingExName] = useState<string>('');
  const [editingExMuscle, setEditingExMuscle] = useState<string>('');

  // Seguridad / Backup / Confirmaciones en dos toques
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [confirmClearData, setConfirmClearData] = useState<boolean>(false);
  const [confirmDemoLoad, setConfirmDemoLoad] = useState<boolean>(false);
  const [confirmRestoreSnapId, setConfirmRestoreSnapId] = useState<string | null>(null);

  // Estado de mensajes
  const [statusMessage, setStatusMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const showStatus = (text: string, error = false) => {
    setStatusMessage({ text, error });
    setTimeout(() => setStatusMessage(null), 4000);
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
    showStatus('Peso corporal guardado y respaldado ✓');
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
      usesExternalWeight: newExCat === 'weights' ? true : newExExternalWeight,
      difficultyFactor: 1.0,
      order: exercises.length + 1
    };
    await saveExerciseDef(newEx);
    setNewExName('');
    setNewExMuscle('');
    setNewExExternalWeight(false);
    setShowNewExModal(false);
    showStatus(`Ejercicio "${newEx.name}" añadido al catálogo ✓`);
  };

  // Guardar edición de ejercicio
  const handleSaveExerciseEdit = async (ex: ExerciseDefinition) => {
    if (!editingExName.trim()) return;
    await saveExerciseDef({
      ...ex,
      name: editingExName.trim(),
      muscleGroup: editingExMuscle.trim() || ex.muscleGroup
    });
    setEditingExId(null);
    showStatus('Ejercicio actualizado ✓');
  };

  const handleToggleArchiveExercise = async (ex: ExerciseDefinition) => {
    await saveExerciseDef({
      ...ex,
      archived: !ex.archived
    });
    showStatus(ex.archived ? `"${ex.name}" restaurado ✓` : `"${ex.name}" archivado (su historial se mantiene)`);
  };

  // Exportar JSON (nativo Android Downloads o Web Share / Descarga)
  const handleExportJson = async () => {
    try {
      const filename = `entrenamientos-backup-${toLocalDateKey(new Date())}.json`;

      // Si estamos en APK Android nativo, guardar directo en Descargas/EntrenaOffline/
      const nativePath = await exportBackupToDeviceDownloads(filename);
      if (nativePath) {
        showStatus(`Copia guardada en ${nativePath} ✓`);
        return;
      }

      const json = await exportDataAsJson();
      const blob = new Blob([json], { type: 'application/json' });

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

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showStatus('Archivo de copia guardado en Descargas ✓');
    } catch {
      showStatus('Error al exportar los datos', true);
    }
  };

  // Importar JSON (soporta fusionar sin perder datos o reemplazar con respaldo previo)
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const res = await importDataFromJson(content, importMode);
      if (res.success) {
        await refreshData(true);
        showStatus(res.message);
      } else {
        showStatus(res.message, true);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCreateManualSnapshot = async () => {
    const ok = await createManualSnapshot(`Manual (${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })})`);
    if (ok) {
      showStatus('Punto de restauración guardado ✓');
    }
  };

  const handleRestoreSnapshot = async (snap: SafetySnapshot) => {
    if (confirmRestoreSnapId !== snap.id) {
      setConfirmRestoreSnapId(snap.id);
      setTimeout(() => setConfirmRestoreSnapId(null), 4000);
      return;
    }
    setConfirmRestoreSnapId(null);
    const res = await restoreFromSnapshot(snap);
    showStatus(res.message, !res.success);
  };

  const handleDemoClick = async () => {
    if (logs.length > 0 && !confirmDemoLoad) {
      setConfirmDemoLoad(true);
      setTimeout(() => setConfirmDemoLoad(false), 4500);
      return;
    }
    setConfirmDemoLoad(false);
    await loadDemoAndRefresh();
    showStatus('¡90 días de ejemplo cargados! Tu estado previo quedó en Puntos de Restauración ✓');
  };

  const handleClearAllClick = async () => {
    if (!confirmClearData) {
      setConfirmClearData(true);
      setTimeout(() => setConfirmClearData(false), 4500);
      return;
    }
    setConfirmClearData(false);
    await clearDataAndRefresh();
    showStatus('Datos vaciados (se guardó copia de seguridad previa en Puntos de Restauración)');
  };

  const lastBackupText = storageHealth?.lastBackupAt
    ? new Date(storageHealth.lastBackupAt).toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Pendiente';

  return (
    <div className="main-content">
      {/* Mensaje de estado flotante */}
      {statusMessage && (
        <div
          style={{
            position: 'sticky',
            top: '64px',
            zIndex: 60,
            background: statusMessage.error ? '#f43f5e' : '#10b981',
            color: '#fff',
            padding: '10px 14px',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '0.84rem',
            textAlign: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.35)'
          }}
        >
          {statusMessage.text}
        </div>
      )}

      {/* 1. CENTRO DE BLINDAJE Y COPIA DE SEGURIDAD */}
      <div className="card" style={{ borderColor: 'rgba(16, 185, 129, 0.4)' }}>
        <div className="card-header">
          <div className="card-title">
            <ShieldCheck size={20} color="#10b981" />
            <span>Blindaje y Copias de Seguridad</span>
          </div>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              color: '#34d399',
              background: 'rgba(16, 185, 129, 0.14)',
              padding: '2px 8px',
              borderRadius: '9999px'
            }}
          >
            Multi-capa
          </span>
        </div>

        {/* Estado en vivo de las capas de seguridad */}
        <div className="stat-grid">
          <div className="stat-box">
            <span className="stat-box-label">Base Local + Espejo</span>
            <span className="stat-box-value" style={{ fontSize: '0.96rem', color: '#34d399' }}>
              {storageHealth?.totalLogs ?? logs.length} días · {storageHealth?.shadowMirrorActive ? 'Espejo OK' : 'Listo'}
            </span>
            <span className="stat-box-sub">Último respaldo: {lastBackupText}</span>
          </div>

          <div className="stat-box">
            <span className="stat-box-label">Respaldo Dispositivo</span>
            <span className="stat-box-value" style={{ fontSize: '0.96rem', color: storageHealth?.nativeBridgeActive ? '#38bdf8' : '#cbd5e1' }}>
              {storageHealth?.nativeBridgeActive
                ? 'Nativo (.json + .bak)'
                : storageHealth?.browserPersisted
                ? 'Persistente OK'
                : 'Navegador + Snapshots'}
            </span>
            <span className="stat-box-sub">
              {storageHealth?.snapshotsCount ?? safetySnapshots.length} puntos de restauración
            </span>
          </div>
        </div>

        <p style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4 }}>
          Cada cambio se guarda con validación estricta y checksum de integridad en IndexedDB, en el espejo local y, en la app Android, en archivo atómico externo al WebView (`entrena_backup_v1.json` + `.bak`).
        </p>

        {/* Exportar e Importar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
          <button type="button" className="btn btn-primary btn-sm" style={{ minHeight: '42px' }} onClick={handleExportJson}>
            <Download size={15} />
            <span>Exportar JSON</span>
          </button>

          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', minHeight: '42px' }}>
            <Upload size={15} />
            <span>Restaurar JSON</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        {/* Selector de modo de importación */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
            Al restaurar un archivo JSON:
          </span>
          <div className="tab-pills">
            <button
              type="button"
              className={`tab-pill ${importMode === 'merge' ? 'active' : ''}`}
              onClick={() => setImportMode('merge')}
            >
              Fusionar (sin borrar)
            </button>
            <button
              type="button"
              className={`tab-pill ${importMode === 'replace' ? 'active' : ''}`}
              onClick={() => setImportMode('replace')}
            >
              Reemplazar todo
            </button>
          </div>
        </div>

        {/* Puntos de Restauración Automáticos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <History size={14} color="#38bdf8" /> Puntos de Restauración
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ minHeight: '28px', padding: '2px 8px', fontSize: '0.72rem', color: '#38bdf8' }}
              onClick={handleCreateManualSnapshot}
            >
              <BookmarkPlus size={13} /> Guardar punto
            </button>
          </div>

          {safetySnapshots.length === 0 ? (
            <div style={{ fontSize: '0.76rem', color: '#64748b', padding: '6px 0' }}>
              Se crearán puntos automáticos diarios y antes de cualquier cambio masivo.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '210px', overflowY: 'auto' }}>
              {safetySnapshots.slice(0, 6).map(snap => {
                const isConfirming = confirmRestoreSnapId === snap.id;
                const dateLabel = new Date(snap.createdAt).toLocaleString('es-ES', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                });
                return (
                  <div
                    key={snap.id}
                    style={{
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                      padding: '8px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px'
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {snap.label}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                        {dateLabel} · {snap.logsCount} días · {snap.bodyWeightsCount} pesajes
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`btn btn-sm ${isConfirming ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ minHeight: '30px', padding: '3px 10px', fontSize: '0.73rem', flexShrink: 0 }}
                      onClick={() => handleRestoreSnapshot(snap)}
                    >
                      {isConfirming ? '¿Confirmar?' : 'Restaurar'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2. PERFIL, METAS SEMANALES Y PISCINA */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Target size={19} color="#06b6d4" />
            <span>Perfil y Objetivos</span>
          </div>
        </div>

        <div className="input-group">
          <label className="input-label">Tu nombre (opcional)</label>
          <input
            type="text"
            placeholder="Ej. Miguel"
            value={settings.userName || ''}
            onChange={e => updateSettings({ ...settings, userName: e.target.value })}
            className="input-field"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
          <div className="input-group">
            <label className="input-label">Meta Días / Sem</label>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="7"
              value={settings.targetDaysWeekly ?? 4}
              onChange={e =>
                updateSettings({
                  ...settings,
                  targetDaysWeekly: Math.max(1, Math.min(7, parseInt(e.target.value, 10) || 1))
                })
              }
              className="input-field"
            />
          </div>

          <div className="input-group">
            <label className="input-label">Meta Piscina / Sem (m)</label>
            <input
              type="number"
              inputMode="numeric"
              step="100"
              min="100"
              value={settings.targetSwimMetersWeekly ?? 2000}
              onChange={e =>
                updateSettings({
                  ...settings,
                  targetSwimMetersWeekly: Math.max(100, parseInt(e.target.value, 10) || 500)
                })
              }
              className="input-field"
            />
          </div>
        </div>

        <div className="input-group">
          <label className="input-label">Piscina por Defecto</label>
          <div className="tab-pills">
            <button
              type="button"
              className={`tab-pill ${settings.poolLengthDefault === 25 ? 'active' : ''}`}
              onClick={() => updateSettings({ ...settings, poolLengthDefault: 25 })}
            >
              Piscina Corta (25m)
            </button>
            <button
              type="button"
              className={`tab-pill ${settings.poolLengthDefault === 50 ? 'active' : ''}`}
              onClick={() => updateSettings({ ...settings, poolLengthDefault: 50 })}
            >
              Olímpica (50m)
            </button>
          </div>
        </div>

        <div className="input-group">
          <label className="input-label">Descanso por defecto en fuerza</label>
          <div className="tab-pills">
            {[60, 90, 120, 180].map(sec => (
              <button
                key={sec}
                type="button"
                className={`tab-pill ${(settings.restTimerDefaultSeconds || 90) === sec ? 'active' : ''}`}
                onClick={() => updateSettings({ ...settings, restTimerDefaultSeconds: sec })}
              >
                {sec < 120 ? `${sec}s` : `${sec / 60}m`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. SECCIÓN PESO CORPORAL (MENSUAL) */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Scale size={20} color="#a855f7" />
            <span>Peso Corporal (Mensual)</span>
          </div>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
          Anótalo una vez al mes para seguir tu curva de peso y fuerza relativa en dominadas.
        </p>

        <form onSubmit={handleSaveWeight} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
            <input
              type="date"
              value={newBwDate}
              onChange={e => setNewBwDate(e.target.value)}
              className="input-field"
              style={{ fontSize: '0.86rem' }}
            />
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="Peso kg (ej. 75.5)"
              value={newBwKg}
              onChange={e => setNewBwKg(e.target.value)}
              className="input-field"
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Nota opcional (ej. Pesaje mensual)"
              value={newBwNotes}
              onChange={e => setNewBwNotes(e.target.value)}
              className="input-field"
              style={{ flex: '1 1 160px', fontSize: '0.85rem' }}
            />
            <button type="submit" className="btn btn-primary btn-sm" style={{ padding: '0 16px' }}>
              <Plus size={16} />
              <span>Guardar</span>
            </button>
          </div>
        </form>

        {/* Historial de pesajes */}
        {bodyWeights.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
              Historial de Pesajes
            </div>
            {[...bodyWeights].reverse().map(bw => (
              <div
                key={bw.date}
                style={{
                  background: 'var(--bg-subtle)',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.94rem', color: '#d8b4fe' }}>
                      {formatWeightKg(bw.weightKg)}
                    </span>
                    <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                      {formatFriendlyDate(bw.date)} ({bw.date})
                    </span>
                  </div>
                  {bw.notes && (
                    <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                      {bw.notes}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  style={{ width: 32, height: 32, minHeight: 32 }}
                  onClick={() => deleteWeightRecord(bw.date)}
                  title="Eliminar pesaje"
                  aria-label={`Eliminar pesaje ${bw.date}`}
                >
                  <Trash2 size={14} color="#f43f5e" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. CATÁLOGO DE EJERCICIOS */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <span>Catálogo de Ejercicios</span>
          </div>
          <button
            type="button"
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

            {newExCat === 'calisthenics' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#cbd5e1', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={newExExternalWeight}
                  onChange={e => setNewExExternalWeight(e.target.checked)}
                  style={{ accentColor: '#06b6d4', width: 16, height: 16 }}
                />
                <span>Habitualmente con lastre / peso extra</span>
              </label>
            )}

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

        {/* Lista de ejercicios con edición y archivo */}
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
                  padding: '8px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  border: '1px solid var(--border-color)',
                  opacity: ex.archived ? 0.55 : 1
                }}
              >
                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: 0 }}>
                    <input
                      type="text"
                      value={editingExName}
                      onChange={e => setEditingExName(e.target.value)}
                      className="input-field"
                      style={{ minHeight: '36px', padding: '4px 8px', fontSize: '0.86rem' }}
                      placeholder="Nombre"
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={editingExMuscle}
                        onChange={e => setEditingExMuscle(e.target.value)}
                        className="input-field"
                        style={{ minHeight: '34px', padding: '4px 8px', fontSize: '0.8rem', flex: 1 }}
                        placeholder="Grupo muscular"
                      />
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ minHeight: '34px' }}
                        onClick={() => handleSaveExerciseEdit(ex)}
                      >
                        OK
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ minHeight: '34px' }}
                        onClick={() => setEditingExId(null)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: isWeight ? '#f59e0b' : '#34d399' }}>
                        {ex.name} {ex.archived && <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>(Archivado)</span>}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        {isWeight ? 'Pesas (kg)' : 'Calistenia'} · {ex.muscleGroup}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        style={{ width: 32, height: 32, minHeight: 32 }}
                        onClick={() => {
                          setEditingExId(ex.id);
                          setEditingExName(ex.name);
                          setEditingExMuscle(ex.muscleGroup);
                        }}
                        title="Editar ejercicio"
                        aria-label={`Editar ${ex.name}`}
                      >
                        <Edit2 size={14} color="#94a3b8" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        style={{ width: 32, height: 32, minHeight: 32 }}
                        onClick={() => handleToggleArchiveExercise(ex)}
                        title={ex.archived ? 'Restaurar ejercicio' : 'Ocultar del registro'}
                        aria-label={ex.archived ? `Restaurar ${ex.name}` : `Archivar ${ex.name}`}
                      >
                        {ex.archived ? <RotateCcw size={14} color="#34d399" /> : <Archive size={14} color="#64748b" />}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. MODO PRUEBA / DATOS DE DEMO */}
      <div className="card" style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
        <div className="card-header">
          <div className="card-title">
            <Smartphone size={18} color="#f59e0b" />
            <span>Datos de Prueba y Gestión</span>
          </div>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
          Carga 90 días de entrenamientos de prueba. Antes de ejecutar cualquier acción se crea un punto de restauración automático.
        </p>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{
              flex: '1 1 160px',
              borderColor: '#f59e0b',
              color: '#f59e0b',
              minHeight: '40px',
              background: confirmDemoLoad ? 'rgba(245, 158, 11, 0.16)' : undefined
            }}
            onClick={handleDemoClick}
          >
            {confirmDemoLoad ? `¿Sobrescribir ${logs.length} días? Pulsa otra vez` : 'Cargar 90 días demo'}
          </button>

          <button
            type="button"
            className={`btn btn-sm ${confirmClearData ? 'btn-danger-soft' : 'btn-ghost'}`}
            style={{ flex: '1 1 120px', color: '#fb7185', minHeight: '40px' }}
            onClick={handleClearAllClick}
          >
            {confirmClearData ? 'Pulsa de nuevo para borrar' : 'Vaciar datos'}
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
            <strong>En iPhone (Safari):</strong> Pulsa el botón de <strong>Compartir</strong> y selecciona <strong>"Añadir a pantalla de inicio"</strong>.
          </div>
          <div style={{ color: '#34d399', fontSize: '0.75rem', fontWeight: 600 }}>
            ✓ Funciona al 100% incluso con el móvil en Modo Avión.
          </div>
        </div>
      </div>
    </div>
  );
};
