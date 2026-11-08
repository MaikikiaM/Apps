// src/db/database.ts
// Capa IndexedDB 100% offline con idb, persistencia y exportación JSON

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { DailyWorkoutLog, ExerciseDefinition, BodyWeightEntry, AppSettings } from '../types/models';
import { INITIAL_EXERCISES } from './seedExercises';
import { toLocalDateKey, addDaysToDateKey } from '../utils/dates';

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
}

const DB_NAME = 'workout-tracker-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<WorkoutDB>> | null = null;

export async function getDb(): Promise<IDBPDatabase<WorkoutDB>> {
  if (!dbPromise) {
    dbPromise = openDB<WorkoutDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Store de registros diarios
        if (!db.objectStoreNames.contains('logs')) {
          const logStore = db.createObjectStore('logs', { keyPath: 'date' });
          logStore.createIndex('by-date', 'date');
        }
        // Store de ejercicios
        if (!db.objectStoreNames.contains('exercises')) {
          db.createObjectStore('exercises', { keyPath: 'id' });
        }
        // Store de peso corporal (habitual 1 vez al mes)
        if (!db.objectStoreNames.contains('bodyweight')) {
          db.createObjectStore('bodyweight', { keyPath: 'date' });
        }
        // Store de ajustes de la app
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      }
    });

    // Intentar solicitar persistencia offline a nivel del navegador
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(() => {});
    }

    // Inicializar ejercicios por defecto si la tienda está vacía
    const db = await dbPromise;
    const count = await db.count('exercises');
    if (count === 0) {
      const tx = db.transaction('exercises', 'readwrite');
      for (const ex of INITIAL_EXERCISES) {
        await tx.store.put(ex);
      }
      await tx.done;
    }
  }
  return dbPromise;
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
  await db.put('logs', {
    ...log,
    updatedAt: Date.now()
  });
}

export async function deleteLog(date: string): Promise<void> {
  const db = await getDb();
  await db.delete('logs', date);
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
}

// --- CRUD PESO CORPORAL ---

export async function getAllBodyWeights(): Promise<BodyWeightEntry[]> {
  const db = await getDb();
  const weights = await db.getAll('bodyweight');
  return weights.sort((a, b) => a.date.localeCompare(b.date));
}

export async function saveBodyWeight(entry: BodyWeightEntry): Promise<void> {
  const db = await getDb();
  await db.put('bodyweight', entry);
}

export async function deleteBodyWeight(date: string): Promise<void> {
  const db = await getDb();
  await db.delete('bodyweight', date);
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
}

// --- BACKUP Y RESTAURACIÓN JSON ---

export interface BackupPayload {
  version: number;
  exportedAt: string;
  logs: DailyWorkoutLog[];
  exercises: ExerciseDefinition[];
  bodyweight: BodyWeightEntry[];
  settings: AppSettings;
}

export async function exportDataAsJson(): Promise<string> {
  const [logs, exercises, bodyweight, settings] = await Promise.all([
    getAllLogs(),
    getAllExercises(),
    getAllBodyWeights(),
    getSettings()
  ]);

  const payload: BackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    logs,
    exercises,
    bodyweight,
    settings
  };

  return JSON.stringify(payload, null, 2);
}

export async function importDataFromJson(jsonStr: string): Promise<{ success: boolean; message: string }> {
  try {
    const data = JSON.parse(jsonStr) as Partial<BackupPayload>;
    if (!data || !Array.isArray(data.logs)) {
      return { success: false, message: 'El archivo JSON no tiene un formato válido de copia de seguridad.' };
    }

    const db = await getDb();
    const tx = db.transaction(['logs', 'exercises', 'bodyweight', 'settings'], 'readwrite');

    // Limpiar stores actuales
    await tx.objectStore('logs').clear();
    await tx.objectStore('exercises').clear();
    await tx.objectStore('bodyweight').clear();

    // Insertar logs
    for (const log of data.logs) {
      if (log && log.date) {
        await tx.objectStore('logs').put(log);
      }
    }

    // Insertar ejercicios (o fallback a iniciales)
    const exList = Array.isArray(data.exercises) && data.exercises.length > 0 ? data.exercises : INITIAL_EXERCISES;
    for (const ex of exList) {
      await tx.objectStore('exercises').put(ex);
    }

    // Insertar peso corporal
    if (Array.isArray(data.bodyweight)) {
      for (const bw of data.bodyweight) {
        if (bw && bw.date) {
          await tx.objectStore('bodyweight').put(bw);
        }
      }
    }

    // Insertar settings
    if (data.settings) {
      await tx.objectStore('settings').put(data.settings, 'app_settings');
    }

    await tx.done;
    return { success: true, message: `Restaurados con éxito ${data.logs.length} entrenamientos.` };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Error al procesar el JSON: ${errorMsg}` };
  }
}

export async function clearAllData(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['logs', 'exercises', 'bodyweight'], 'readwrite');
  await tx.objectStore('logs').clear();
  await tx.objectStore('exercises').clear();
  await tx.objectStore('bodyweight').clear();
  for (const ex of INITIAL_EXERCISES) {
    await tx.objectStore('exercises').put(ex);
  }
  await tx.done;
}

// --- GENERADOR REALISTA DE DEMO (90 DÍAS) ---

export async function seedDemoData(): Promise<void> {
  const db = await getDb();
  const todayKey = toLocalDateKey(new Date());

  // Generar 3 registros de peso corporal mensual: hace 90 días (78.2 kg), hace 45 días (77.4 kg), hace 5 días (76.6 kg)
  const d90 = addDaysToDateKey(todayKey, -90);
  const d45 = addDaysToDateKey(todayKey, -45);
  const d5 = addDaysToDateKey(todayKey, -5);

  const txBw = db.transaction('bodyweight', 'readwrite');
  await txBw.store.put({ date: d90, weightKg: 78.2, notes: 'Inicio' });
  await txBw.store.put({ date: d45, weightKg: 77.4, notes: 'Control mensual' });
  await txBw.store.put({ date: d5, weightKg: 76.6, notes: 'Pesaje actual' });
  await txBw.done;

  // Generar entrenamientos a lo largo de los últimos 90 días (3 a 4 días por semana)
  const txLogs = db.transaction('logs', 'readwrite');

  for (let i = 88; i >= 1; i -= 2) {
    const dayKey = addDaysToDateKey(todayKey, -i);
    const dayProgressRatio = (90 - i) / 90; // de 0.0 a 1.0

    // Alternar patrones: Natación, Fuerza o Ambos
    const pattern = (i % 6);

    const log: DailyWorkoutLog = {
      date: dayKey,
      strength: [],
      updatedAt: Date.now()
    };

    if (pattern === 0 || pattern === 2 || pattern === 4) {
      // Sesión de natación con progresión
      const crawl = Math.round(500 + dayProgressRatio * 500); // 500m -> 1000m
      const back = Math.round(200 + dayProgressRatio * 200);   // 200m -> 400m
      const breast = Math.round(150 + dayProgressRatio * 150); // 150m -> 300m
      const fly = pattern === 0 ? Math.round(50 + dayProgressRatio * 100) : 0; // 50m -> 150m
      const total = crawl + back + breast + fly;
      // Ritmo progresa de 2:05 /100m (125s) a 1:44 /100m (104s)
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
      // Sesión de fuerza
      // Calistenia
      const pullupReps = Math.round(6 + dayProgressRatio * 6); // 6 -> 12 reps
      const commandoReps = Math.round(5 + dayProgressRatio * 5); // 5 -> 10 reps
      const chinupReps = Math.round(7 + dayProgressRatio * 7); // 7 -> 14 reps
      const pikeReps = Math.round(8 + dayProgressRatio * 7);   // 8 -> 15 reps
      const dipReps = Math.round(8 + dayProgressRatio * 8);    // 8 -> 16 reps

      // Pesas: Curl de bíceps y Tríceps apoyado
      const bicepKg = 10 + Math.floor(dayProgressRatio * 4) * 2; // 10 -> 16 kg
      const bicepReps = Math.round(8 + dayProgressRatio * 4);    // 8 -> 12 reps
      const tricepKg = 8 + Math.floor(dayProgressRatio * 3) * 2; // 8 -> 14 kg
      const tricepReps = Math.round(9 + dayProgressRatio * 4);   // 9 -> 13 reps

      if (pattern % 2 === 1) {
        // Modo series
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
        // Modo rápido o push
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
}
