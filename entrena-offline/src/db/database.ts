// src/db/database.ts
// Capa IndexedDB 100% offline con transacciones atómicas, snapshots de seguridad, espejo localStorage y respaldo nativo Android

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import {
  DailyWorkoutLog,
  ExerciseDefinition,
  BodyWeightEntry,
  AppSettings,
  SafetySnapshot,
  StorageHealthInfo
} from '../types/models';
import { INITIAL_EXERCISES } from './seedExercises';
import { toLocalDateKey, addDaysToDateKey } from '../utils/dates';
import {
  buildVerifiedBackupPayload,
  exportNativeToDownloads,
  getLastBackupTimestamp,
  isNativeBridgeAvailable,
  loadEmergencySnapshotsLocal,
  loadFromNativeStore,
  loadShadowMirror,
  markIntentionalClear,
  saveEmergencySnapshotLocal,
  saveShadowMirror,
  saveToNativeStore,
  validateAndNormalizeBackupJson,
  wasIntentionallyCleared
} from './storageGuard';

interface WorkoutDB extends DBSchema {
  logs: {
    key: string; // 'YYYY-MM-DD'
    value: DailyWorkoutLog;
    indexes: { 'by-date': string };
  };
  exercises: {
    key: string; // id
    value: ExerciseDefinition;
  };
  bodyweight: {
    key: string; // 'YYYY-MM-DD'
    value: BodyWeightEntry;
  };
  settings: {
    key: string;
    value: AppSettings;
  };
  snapshots: {
    key: string; // id
    value: SafetySnapshot;
  };
}

const DB_NAME = 'workout-tracker-db';
const DB_VERSION = 2;
const MAX_IDB_SNAPSHOTS = 12;

let dbPromise: Promise<IDBPDatabase<WorkoutDB>> | null = null;

export async function getDb(): Promise<IDBPDatabase<WorkoutDB>> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await openDB<WorkoutDB>(DB_NAME, DB_VERSION, {
        upgrade(upgradeDb) {
          if (!upgradeDb.objectStoreNames.contains('logs')) {
            const logStore = upgradeDb.createObjectStore('logs', { keyPath: 'date' });
            logStore.createIndex('by-date', 'date');
          }
          if (!upgradeDb.objectStoreNames.contains('exercises')) {
            upgradeDb.createObjectStore('exercises', { keyPath: 'id' });
          }
          if (!upgradeDb.objectStoreNames.contains('bodyweight')) {
            upgradeDb.createObjectStore('bodyweight', { keyPath: 'date' });
          }
          if (!upgradeDb.objectStoreNames.contains('settings')) {
            upgradeDb.createObjectStore('settings');
          }
          if (!upgradeDb.objectStoreNames.contains('snapshots')) {
            upgradeDb.createObjectStore('snapshots', { keyPath: 'id' });
          }
        },
        blocked() {
          // Si otra pestaña bloquea el upgrade, continuamos cuando se libere
        },
        terminated() {
          dbPromise = null;
        }
      });

      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };

      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().catch(() => {});
      }

      const count = await db.count('exercises');
      if (count === 0) {
        const tx = db.transaction('exercises', 'readwrite');
        for (const ex of INITIAL_EXERCISES) {
          await tx.store.put(ex);
        }
        await tx.done;
      }

      return db;
    })();
  }
  return dbPromise;
}

// --- SINCRONIZACIÓN DURABLE MULTI-CAPA ---

let syncTimer: number | null = null;
let syncInFlight: Promise<void> | null = null;

export async function syncDurableBackupNow(): Promise<boolean> {
  const task = (async () => {
    try {
      const json = await exportDataAsJson();
      const shadowOk = saveShadowMirror(json);
      const nativeOk = saveToNativeStore(json);

      // Guardar también punto diario automático si hay datos y aún no existe hoy
      const db = await getDb();
      const logsCount = await db.count('logs');
      const bwCount = await db.count('bodyweight');
      if (logsCount > 0 || bwCount > 0) {
        const todaySnapshotId = `daily_${toLocalDateKey(new Date())}`;
        const existingToday = await db.get('snapshots', todaySnapshotId);
        if (!existingToday) {
          const snap: SafetySnapshot = {
            id: todaySnapshotId,
            label: `Auto-guardado diario (${toLocalDateKey(new Date())})`,
            createdAt: Date.now(),
            logsCount,
            bodyWeightsCount: bwCount,
            payloadJson: json
          };
          await putSnapshotWithPruning(db, snap);
        }
      }
      return shadowOk || nativeOk;
    } catch {
      return false;
    }
  })();

  syncInFlight = task.then(() => undefined);
  return task;
}

export function scheduleDurableBackupSync(): void {
  if (typeof window === 'undefined') return;
  if (syncTimer !== null) {
    window.clearTimeout(syncTimer);
  }
  syncTimer = window.setTimeout(() => {
    syncTimer = null;
    void syncDurableBackupNow();
  }, 250);
}

export async function flushPendingDurableBackup(): Promise<void> {
  if (typeof window !== 'undefined' && syncTimer !== null) {
    window.clearTimeout(syncTimer);
    syncTimer = null;
  }
  await syncDurableBackupNow();
  if (syncInFlight) {
    await syncInFlight;
  }
}

async function putSnapshotWithPruning(db: IDBPDatabase<WorkoutDB>, snap: SafetySnapshot): Promise<void> {
  saveEmergencySnapshotLocal(snap);
  const tx = db.transaction('snapshots', 'readwrite');
  await tx.store.put(snap);
  const all = await tx.store.getAll();
  if (all.length > MAX_IDB_SNAPSHOTS) {
    const sorted = all.sort((a, b) => b.createdAt - a.createdAt);
    for (let i = MAX_IDB_SNAPSHOTS; i < sorted.length; i++) {
      await tx.store.delete(sorted[i].id);
    }
  }
  await tx.done;
}

export async function createSafetySnapshot(label: string, force = false): Promise<SafetySnapshot | null> {
  const db = await getDb();
  const [logs, exercises, bodyweight, settings] = await Promise.all([
    getAllLogs(),
    getAllExercises(),
    getAllBodyWeights(),
    getSettings()
  ]);

  if (!force && logs.length === 0 && bodyweight.length === 0) {
    return null;
  }

  const payload = buildVerifiedBackupPayload(logs, exercises, bodyweight, settings);
  const json = JSON.stringify(payload, null, 2);

  const snap: SafetySnapshot = {
    id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    label,
    createdAt: Date.now(),
    logsCount: logs.length,
    bodyWeightsCount: bodyweight.length,
    payloadJson: json
  };

  await putSnapshotWithPruning(db, snap);
  return snap;
}

export async function getAllSafetySnapshots(): Promise<SafetySnapshot[]> {
  try {
    const db = await getDb();
    const idbSnaps = await db.getAll('snapshots');
    const localSnaps = loadEmergencySnapshotsLocal();
    const merged = new Map<string, SafetySnapshot>();
    for (const s of localSnaps) merged.set(s.id, s);
    for (const s of idbSnaps) merged.set(s.id, s);
    return Array.from(merged.values()).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return loadEmergencySnapshotsLocal().sort((a, b) => b.createdAt - a.createdAt);
  }
}

export async function restoreSafetySnapshot(snapshot: SafetySnapshot): Promise<{ success: boolean; message: string }> {
  return importDataFromJson(snapshot.payloadJson, 'replace');
}

export interface RecoveryReport {
  recovered: boolean;
  source?: 'native' | 'shadow';
  logsRestored?: number;
}

/**
 * Si IndexedDB aparece vacío inesperadamente (p. ej. WebView limpió almacenamiento),
 * restaura automáticamente desde el respaldo atómico nativo o desde el espejo localStorage.
 */
export async function recoverDataIfNeeded(): Promise<RecoveryReport> {
  try {
    const db = await getDb();
    const logsCount = await db.count('logs');
    const bwCount = await db.count('bodyweight');

    if (logsCount > 0 || bwCount > 0) {
      // Hay datos vivos en IndexedDB: asegurar que los espejos estén sincronizados
      if (!loadShadowMirror() || (isNativeBridgeAvailable() && !loadFromNativeStore())) {
        void syncDurableBackupNow();
      }
      return { recovered: false };
    }

    if (wasIntentionallyCleared()) {
      return { recovered: false };
    }

    const candidates: { source: 'native' | 'shadow'; raw: string }[] = [];
    const nativeJson = loadFromNativeStore();
    if (nativeJson) candidates.push({ source: 'native', raw: nativeJson });
    const shadowJson = loadShadowMirror();
    if (shadowJson) candidates.push({ source: 'shadow', raw: shadowJson });

    for (const candidate of candidates) {
      const validation = validateAndNormalizeBackupJson(candidate.raw);
      if (
        validation.valid &&
        validation.payload &&
        (validation.payload.logs.length > 0 || validation.payload.bodyweight.length > 0)
      ) {
        const res = await applyValidatedBackup(validation.payload, 'replace', false);
        if (res.success) {
          return {
            recovered: true,
            source: candidate.source,
            logsRestored: validation.payload.logs.length
          };
        }
      }
    }

    return { recovered: false };
  } catch {
    return { recovered: false };
  }
}

// --- CRUD LOGS ---

export async function getAllLogs(): Promise<DailyWorkoutLog[]> {
  const db = await getDb();
  const logs = await db.getAll('logs');
  return logs.sort((a, b) => a.date.localeCompare(b.date));
}

export async function getLogByDate(date: string): Promise<DailyWorkoutLog | undefined> {
  const db = await getDb();
  return db.get('logs', date);
}

export async function saveLog(log: DailyWorkoutLog): Promise<void> {
  const db = await getDb();
  markIntentionalClear(false);
  await db.put('logs', {
    ...log,
    updatedAt: Date.now()
  });
  scheduleDurableBackupSync();
}

export async function deleteLog(date: string): Promise<void> {
  const db = await getDb();
  await db.delete('logs', date);
  scheduleDurableBackupSync();
}

// --- CRUD EJERCICIOS ---

export async function getAllExercises(): Promise<ExerciseDefinition[]> {
  const db = await getDb();
  const list = await db.getAll('exercises');
  return list.sort((a, b) => a.order - b.order);
}

export async function saveExercise(exercise: ExerciseDefinition): Promise<void> {
  const db = await getDb();
  await db.put('exercises', exercise);
  scheduleDurableBackupSync();
}

// --- CRUD PESO CORPORAL ---

export async function getAllBodyWeights(): Promise<BodyWeightEntry[]> {
  const db = await getDb();
  const weights = await db.getAll('bodyweight');
  return weights.sort((a, b) => a.date.localeCompare(b.date));
}

export async function saveBodyWeight(entry: BodyWeightEntry): Promise<void> {
  const db = await getDb();
  markIntentionalClear(false);
  await db.put('bodyweight', entry);
  scheduleDurableBackupSync();
}

export async function deleteBodyWeight(date: string): Promise<void> {
  const db = await getDb();
  await db.delete('bodyweight', date);
  scheduleDurableBackupSync();
}

// --- AJUSTES ---

export async function getSettings(): Promise<AppSettings> {
  const db = await getDb();
  const settings = await db.get('settings', 'app_settings');
  return settings || { poolLengthDefault: 25 };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDb();
  await db.put('settings', settings, 'app_settings');
  scheduleDurableBackupSync();
}

// --- ESTADO DE PROTECCIÓN DE DATOS ---

export async function getStorageHealthInfo(): Promise<StorageHealthInfo> {
  let browserPersisted: boolean | null = null;
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted) {
      browserPersisted = await navigator.storage.persisted();
    }
  } catch {
    browserPersisted = null;
  }

  let totalLogs = 0;
  let totalBodyWeights = 0;
  let snapshotsCount = 0;
  try {
    const db = await getDb();
    [totalLogs, totalBodyWeights] = await Promise.all([
      db.count('logs'),
      db.count('bodyweight')
    ]);
    snapshotsCount = (await getAllSafetySnapshots()).length;
  } catch {
    // ignorar
  }

  return {
    nativeBridgeActive: isNativeBridgeAvailable(),
    browserPersisted,
    shadowMirrorActive: loadShadowMirror().length > 0,
    lastBackupAt: getLastBackupTimestamp(),
    snapshotsCount,
    totalLogs,
    totalBodyWeights
  };
}

// --- BACKUP Y RESTAURACIÓN JSON ---

export async function exportDataAsJson(): Promise<string> {
  const [logs, exercises, bodyweight, settings] = await Promise.all([
    getAllLogs(),
    getAllExercises(),
    getAllBodyWeights(),
    getSettings()
  ]);

  const payload = buildVerifiedBackupPayload(logs, exercises, bodyweight, settings);
  return JSON.stringify(payload, null, 2);
}

export async function exportBackupToDeviceDownloads(filename: string): Promise<string> {
  const json = await exportDataAsJson();
  return exportNativeToDownloads(filename, json);
}

async function applyValidatedBackup(
  payload: ReturnType<typeof validateAndNormalizeBackupJson>['payload'] & {},
  mode: 'replace' | 'merge',
  savePreImportSnapshot = true
): Promise<{ success: boolean; message: string }> {
  const db = await getDb();

  if (savePreImportSnapshot) {
    await createSafetySnapshot(`Antes de ${mode === 'merge' ? 'fusionar' : 'restaurar'} copia`);
  }

  if (mode === 'merge') {
    const [existingLogs, existingEx, existingBw] = await Promise.all([
      getAllLogs(),
      getAllExercises(),
      getAllBodyWeights()
    ]);

    const mergedLogs = new Map(existingLogs.map(l => [l.date, l]));
    let addedOrUpdated = 0;
    for (const incoming of payload.logs) {
      const prev = mergedLogs.get(incoming.date);
      if (!prev || incoming.updatedAt >= prev.updatedAt) {
        mergedLogs.set(incoming.date, incoming);
        addedOrUpdated++;
      }
    }

    const mergedEx = new Map(existingEx.map(e => [e.id, e]));
    for (const ex of payload.exercises) {
      if (!mergedEx.has(ex.id)) {
        mergedEx.set(ex.id, ex);
      }
    }

    const mergedBw = new Map(existingBw.map(b => [b.date, b]));
    for (const bw of payload.bodyweight) {
      if (!mergedBw.has(bw.date)) {
        mergedBw.set(bw.date, bw);
      }
    }

    const tx = db.transaction(['logs', 'exercises', 'bodyweight'], 'readwrite');
    for (const log of mergedLogs.values()) {
      await tx.objectStore('logs').put(log);
    }
    for (const ex of mergedEx.values()) {
      await tx.objectStore('exercises').put(ex);
    }
    for (const bw of mergedBw.values()) {
      await tx.objectStore('bodyweight').put(bw);
    }
    await tx.done;

    markIntentionalClear(false);
    await syncDurableBackupNow();
    return {
      success: true,
      message: `Fusión completada: ${addedOrUpdated} días incorporados (${mergedLogs.size} totales) ✓`
    };
  }

  // Modo 'replace' atómico
  const tx = db.transaction(['logs', 'exercises', 'bodyweight', 'settings'], 'readwrite');
  await tx.objectStore('logs').clear();
  await tx.objectStore('exercises').clear();
  await tx.objectStore('bodyweight').clear();

  for (const log of payload.logs) {
    await tx.objectStore('logs').put(log);
  }
  for (const ex of payload.exercises) {
    await tx.objectStore('exercises').put(ex);
  }
  for (const bw of payload.bodyweight) {
    await tx.objectStore('bodyweight').put(bw);
  }
  if (payload.settings) {
    await tx.objectStore('settings').put(payload.settings, 'app_settings');
  }
  await tx.done;

  markIntentionalClear(false);
  await syncDurableBackupNow();
  return {
    success: true,
    message: `Restaurados con éxito ${payload.logs.length} entrenamientos y ${payload.bodyweight.length} pesajes ✓`
  };
}

export async function importDataFromJson(
  jsonStr: string,
  mode: 'replace' | 'merge' = 'replace'
): Promise<{ success: boolean; message: string }> {
  const validation = validateAndNormalizeBackupJson(jsonStr);
  if (!validation.valid || !validation.payload) {
    return {
      success: false,
      message: validation.error || 'El archivo JSON no tiene un formato válido de copia de seguridad.'
    };
  }

  try {
    return await applyValidatedBackup(validation.payload, mode, true);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Error al guardar en base de datos: ${errorMsg}` };
  }
}

export async function clearAllData(): Promise<void> {
  await createSafetySnapshot('Antes de vaciar datos');
  const db = await getDb();
  const tx = db.transaction(['logs', 'exercises', 'bodyweight'], 'readwrite');
  await tx.objectStore('logs').clear();
  await tx.objectStore('exercises').clear();
  await tx.objectStore('bodyweight').clear();
  for (const ex of INITIAL_EXERCISES) {
    await tx.objectStore('exercises').put(ex);
  }
  await tx.done;

  markIntentionalClear(true);
  await syncDurableBackupNow();
}

// --- GENERADOR REALISTA DE DEMO (90 DÍAS) ---

export async function seedDemoData(): Promise<void> {
  await createSafetySnapshot('Antes de cargar demo');
  const db = await getDb();
  const todayKey = toLocalDateKey(new Date());

  const d90 = addDaysToDateKey(todayKey, -90);
  const d45 = addDaysToDateKey(todayKey, -45);
  const d5 = addDaysToDateKey(todayKey, -5);

  const txBw = db.transaction('bodyweight', 'readwrite');
  await txBw.store.put({ date: d90, weightKg: 78.2, notes: 'Inicio' });
  await txBw.store.put({ date: d45, weightKg: 77.4, notes: 'Control mensual' });
  await txBw.store.put({ date: d5, weightKg: 76.6, notes: 'Pesaje actual' });
  await txBw.done;

  const txLogs = db.transaction('logs', 'readwrite');

  for (let i = 88; i >= 1; i -= 2) {
    const dayKey = addDaysToDateKey(todayKey, -i);
    const dayProgressRatio = (90 - i) / 90;
    const pattern = i % 6;

    const log: DailyWorkoutLog = {
      date: dayKey,
      strength: [],
      updatedAt: Date.now()
    };

    if (pattern === 0 || pattern === 2 || pattern === 4) {
      const crawl = Math.round(500 + dayProgressRatio * 500);
      const back = Math.round(200 + dayProgressRatio * 200);
      const breast = Math.round(150 + dayProgressRatio * 150);
      const fly = pattern === 0 ? Math.round(50 + dayProgressRatio * 100) : 0;
      const total = crawl + back + breast + fly;
      const pacePer100 = 125 - dayProgressRatio * 21;
      const durationSeconds = Math.round((total / 100) * pacePer100);

      log.swim = {
        crawlMeters: crawl,
        backstrokeMeters: back,
        breaststrokeMeters: breast,
        butterflyMeters: fly,
        totalMeters: total,
        durationSeconds,
        poolLengthMeters: 25
      };
    }

    if (pattern === 1 || pattern === 2 || pattern === 3 || pattern === 5) {
      const pullupReps = Math.round(6 + dayProgressRatio * 6);
      const commandoReps = Math.round(5 + dayProgressRatio * 5);
      const chinupReps = Math.round(7 + dayProgressRatio * 7);
      const pikeReps = Math.round(8 + dayProgressRatio * 7);
      const dipReps = Math.round(8 + dayProgressRatio * 8);

      const bicepKg = 10 + Math.floor(dayProgressRatio * 4) * 2;
      const bicepReps = Math.round(8 + dayProgressRatio * 4);
      const tricepKg = 8 + Math.floor(dayProgressRatio * 3) * 2;
      const tricepReps = Math.round(9 + dayProgressRatio * 4);

      if (pattern % 2 === 1) {
        log.strength.push({
          exerciseId: 'pullups',
          mode: 'sets',
          sets: [
            { reps: pullupReps, weightKg: 0 },
            { reps: Math.max(1, pullupReps - 1), weightKg: 0 },
            { reps: Math.max(1, pullupReps - 2), weightKg: 0 }
          ]
        });
        log.strength.push({
          exerciseId: 'chinups',
          mode: 'sets',
          sets: [
            { reps: chinupReps, weightKg: 0 },
            { reps: Math.max(1, chinupReps - 1), weightKg: 0 }
          ]
        });
        log.strength.push({
          exerciseId: 'bicep_curl',
          mode: 'sets',
          sets: [
            { reps: bicepReps, weightKg: bicepKg },
            { reps: bicepReps, weightKg: bicepKg },
            { reps: Math.max(1, bicepReps - 2), weightKg: bicepKg }
          ]
        });
      } else {
        log.strength.push({
          exerciseId: 'commando_pullups',
          mode: 'quick',
          sets: [],
          quickTotalReps: commandoReps * 3,
          quickBestSetReps: commandoReps,
          quickSetsCount: 3,
          quickWeightKg: 0
        });
        log.strength.push({
          exerciseId: 'elevated_pike_pushups',
          mode: 'sets',
          sets: [
            { reps: pikeReps, weightKg: 0 },
            { reps: Math.max(1, pikeReps - 1), weightKg: 0 },
            { reps: Math.max(1, pikeReps - 2), weightKg: 0 }
          ]
        });
        log.strength.push({
          exerciseId: 'dips',
          mode: 'sets',
          sets: [
            { reps: dipReps, weightKg: 0 },
            { reps: dipReps, weightKg: 0 },
            { reps: Math.max(1, dipReps - 2), weightKg: 0 }
          ]
        });
        log.strength.push({
          exerciseId: 'supported_tricep_db',
          mode: 'sets',
          sets: [
            { reps: tricepReps, weightKg: tricepKg },
            { reps: tricepReps, weightKg: tricepKg },
            { reps: Math.max(1, tricepReps - 1), weightKg: tricepKg }
          ]
        });
      }
    }

    await txLogs.store.put(log);
  }

  await txLogs.done;
  markIntentionalClear(false);
  await syncDurableBackupNow();
}
