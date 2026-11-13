// src/db/storageGuard.ts
// Capa de blindaje, validación estricta, checksums de integridad, espejo localStorage y puente nativo Android

import {
  AppSettings,
  BackupPayload,
  BodyWeightEntry,
  DailyWorkoutLog,
  ExerciseDefinition,
  SafetySnapshot,
  StrengthEntry,
  SwimSession
} from '../types/models';
import { INITIAL_EXERCISES } from './seedExercises';

export const SHADOW_BACKUP_KEY = 'entrena_shadow_backup_v1';
export const EMERGENCY_SNAPSHOTS_KEY = 'entrena_emergency_snapshots_v1';
export const INTENTIONAL_CLEAR_KEY = 'entrena_intentional_clear_ts';
export const LAST_BACKUP_TS_KEY = 'entrena_last_backup_ts';

const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

interface EntrenaNativeInterface {
  isAvailable?: () => boolean;
  saveDurableBackup?: (json: string) => boolean;
  loadDurableBackup?: () => string;
  exportBackupToDownloads?: (filename: string, json: string) => string;
  listNativeSnapshots?: () => string;
  loadNativeSnapshot?: (filename: string) => string;
}

function getNativeBridge(): EntrenaNativeInterface | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { EntrenaNative?: EntrenaNativeInterface };
  if (w.EntrenaNative && typeof w.EntrenaNative.isAvailable === 'function') {
    try {
      return w.EntrenaNative.isAvailable() ? w.EntrenaNative : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function isNativeBridgeAvailable(): boolean {
  return getNativeBridge() !== null;
}

export function saveToNativeStore(json: string): boolean {
  const bridge = getNativeBridge();
  if (!bridge || typeof bridge.saveDurableBackup !== 'function') return false;
  try {
    return !!bridge.saveDurableBackup(json);
  } catch {
    return false;
  }
}

export function loadFromNativeStore(): string {
  const bridge = getNativeBridge();
  if (!bridge || typeof bridge.loadDurableBackup !== 'function') return '';
  try {
    return bridge.loadDurableBackup() || '';
  } catch {
    return '';
  }
}

export function exportNativeToDownloads(filename: string, json: string): string {
  const bridge = getNativeBridge();
  if (!bridge || typeof bridge.exportBackupToDownloads !== 'function') return '';
  try {
    return bridge.exportBackupToDownloads(filename, json) || '';
  } catch {
    return '';
  }
}

/**
 * Hash determinista FNV-1a 32-bit x2 (64-bit hex) para verificar integridad sin dependencias externas.
 */
export function computeIntegrityChecksum(payload: Omit<BackupPayload, 'checksum' | 'exportedAt'>): string {
  const canonical = JSON.stringify({
    version: payload.version,
    logs: [...payload.logs].sort((a, b) => a.date.localeCompare(b.date)),
    exercises: [...payload.exercises].sort((a, b) => a.id.localeCompare(b.id)),
    bodyweight: [...payload.bodyweight].sort((a, b) => a.date.localeCompare(b.date)),
    settings: payload.settings
  });

  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5 ^ canonical.length;
  for (let i = 0; i < canonical.length; i++) {
    const c = canonical.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= (c + i) & 0xff;
    h2 = Math.imul(h2, 0x01000193);
  }

  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `fnv-${hex1}${hex2}`;
}

export function buildVerifiedBackupPayload(
  logs: DailyWorkoutLog[],
  exercises: ExerciseDefinition[],
  bodyweight: BodyWeightEntry[],
  settings: AppSettings
): BackupPayload {
  const base = {
    version: 2,
    logs,
    exercises,
    bodyweight,
    settings
  };
  return {
    ...base,
    exportedAt: new Date().toISOString(),
    checksum: computeIntegrityChecksum(base)
  };
}

function sanitizeNumber(val: unknown, fallback = 0): number {
  const n = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function sanitizeSwimSession(raw: unknown): SwimSession | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const s = raw as Record<string, unknown>;
  const crawlMeters = Math.round(sanitizeNumber(s.crawlMeters));
  const backstrokeMeters = Math.round(sanitizeNumber(s.backstrokeMeters));
  const breaststrokeMeters = Math.round(sanitizeNumber(s.breaststrokeMeters));
  const butterflyMeters = Math.round(sanitizeNumber(s.butterflyMeters));
  const strokeSum = crawlMeters + backstrokeMeters + breaststrokeMeters + butterflyMeters;
  const totalMeters = Math.max(strokeSum, Math.round(sanitizeNumber(s.totalMeters)));
  const durationSeconds = Math.round(sanitizeNumber(s.durationSeconds));
  const poolLengthMeters: 25 | 50 = s.poolLengthMeters === 50 ? 50 : 25;

  return {
    crawlMeters,
    backstrokeMeters,
    breaststrokeMeters,
    butterflyMeters,
    totalMeters,
    durationSeconds,
    poolLengthMeters,
    ...(typeof s.notes === 'string' && s.notes.trim() ? { notes: s.notes } : {})
  };
}

function sanitizeStrengthEntry(raw: unknown): StrengthEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const st = raw as Record<string, unknown>;
  if (typeof st.exerciseId !== 'string' || !st.exerciseId.trim()) return null;

  const mode: 'sets' | 'quick' = st.mode === 'quick' ? 'quick' : 'sets';
  const rawSets = Array.isArray(st.sets) ? st.sets : [];
  const sets = rawSets
    .filter(item => item && typeof item === 'object')
    .map(item => {
      const rec = item as Record<string, unknown>;
      return {
        reps: Math.round(sanitizeNumber(rec.reps)),
        weightKg: Math.round(sanitizeNumber(rec.weightKg) * 10) / 10
      };
    });

  const entry: StrengthEntry = {
    exerciseId: st.exerciseId.trim(),
    mode,
    sets
  };

  if (st.quickTotalReps !== undefined) entry.quickTotalReps = Math.round(sanitizeNumber(st.quickTotalReps));
  if (st.quickBestSetReps !== undefined) entry.quickBestSetReps = Math.round(sanitizeNumber(st.quickBestSetReps));
  if (st.quickSetsCount !== undefined) entry.quickSetsCount = Math.max(1, Math.round(sanitizeNumber(st.quickSetsCount, 3)));
  if (st.quickWeightKg !== undefined) entry.quickWeightKg = Math.round(sanitizeNumber(st.quickWeightKg) * 10) / 10;

  return entry;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  payload?: BackupPayload;
  checksumVerified?: boolean;
}

export function validateAndNormalizeBackupJson(jsonStr: string): ValidationResult {
  if (!jsonStr || typeof jsonStr !== 'string') {
    return { valid: false, error: 'El archivo de copia está vacío.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return { valid: false, error: 'El archivo no es un JSON válido.' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, error: 'Estructura raíz inválida en la copia de seguridad.' };
  }

  const raw = parsed as Record<string, unknown>;
  if (!Array.isArray(raw.logs)) {
    return { valid: false, error: 'El JSON no contiene la lista de entrenamientos ("logs").' };
  }

  // Verificar checksum si viene en copias v2+
  let checksumVerified = false;
  if (typeof raw.checksum === 'string' && raw.checksum.startsWith('fnv-')) {
    const candidateBase = {
      version: typeof raw.version === 'number' ? raw.version : 2,
      logs: raw.logs as DailyWorkoutLog[],
      exercises: (Array.isArray(raw.exercises) ? raw.exercises : INITIAL_EXERCISES) as ExerciseDefinition[],
      bodyweight: (Array.isArray(raw.bodyweight) ? raw.bodyweight : []) as BodyWeightEntry[],
      settings: (raw.settings && typeof raw.settings === 'object' ? raw.settings : { poolLengthDefault: 25 }) as AppSettings
    };
    const expected = computeIntegrityChecksum(candidateBase);
    if (expected !== raw.checksum) {
      return {
        valid: false,
        error: 'El checksum de integridad no coincide: el archivo pudo quedar truncado o alterado.'
      };
    }
    checksumVerified = true;
  }

  // Normalizar logs
  const logsMap = new Map<string, DailyWorkoutLog>();
  for (const item of raw.logs) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.date !== 'string' || !DATE_KEY_REGEX.test(rec.date)) continue;

    const swim = sanitizeSwimSession(rec.swim);
    const rawStrength = Array.isArray(rec.strength) ? rec.strength : [];
    const strength = rawStrength
      .map(sanitizeStrengthEntry)
      .filter((x): x is StrengthEntry => x !== null);

    const feelingVal = rec.feeling;
    const feeling =
      feelingVal === 1 || feelingVal === 2 || feelingVal === 3 || feelingVal === 4 || feelingVal === 5
        ? feelingVal
        : undefined;

    logsMap.set(rec.date, {
      date: rec.date,
      ...(swim ? { swim } : {}),
      strength,
      ...(typeof rec.notes === 'string' && rec.notes.length > 0 ? { notes: rec.notes } : {}),
      ...(feeling !== undefined ? { feeling } : {}),
      updatedAt: typeof rec.updatedAt === 'number' && Number.isFinite(rec.updatedAt) ? rec.updatedAt : Date.now()
    });
  }

  // Normalizar ejercicios
  const exMap = new Map<string, ExerciseDefinition>();
  const rawEx = Array.isArray(raw.exercises) && raw.exercises.length > 0 ? raw.exercises : INITIAL_EXERCISES;
  for (let i = 0; i < rawEx.length; i++) {
    const item = rawEx[i] as Record<string, unknown>;
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || typeof item.name !== 'string') continue;
    exMap.set(item.id, {
      id: item.id,
      name: item.name,
      category: item.category === 'weights' ? 'weights' : 'calisthenics',
      muscleGroup: typeof item.muscleGroup === 'string' ? item.muscleGroup : 'General',
      usesExternalWeight: Boolean(item.usesExternalWeight),
      difficultyFactor: typeof item.difficultyFactor === 'number' && item.difficultyFactor > 0 ? item.difficultyFactor : 1.0,
      archived: Boolean(item.archived),
      order: typeof item.order === 'number' ? item.order : i + 1
    });
  }
  const exercises = exMap.size > 0 ? Array.from(exMap.values()).sort((a, b) => a.order - b.order) : INITIAL_EXERCISES;

  // Normalizar peso corporal
  const bwMap = new Map<string, BodyWeightEntry>();
  if (Array.isArray(raw.bodyweight)) {
    for (const item of raw.bodyweight) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      if (typeof rec.date !== 'string' || !DATE_KEY_REGEX.test(rec.date)) continue;
      const kg = sanitizeNumber(rec.weightKg);
      if (kg < 20 || kg > 300) continue;
      bwMap.set(rec.date, {
        date: rec.date,
        weightKg: Math.round(kg * 10) / 10,
        ...(typeof rec.notes === 'string' && rec.notes.trim() ? { notes: rec.notes } : {})
      });
    }
  }

  // Normalizar settings
  const rawSettings = (raw.settings && typeof raw.settings === 'object' ? raw.settings : {}) as Record<string, unknown>;
  const settings: AppSettings = {
    poolLengthDefault: rawSettings.poolLengthDefault === 50 ? 50 : 25,
    ...(typeof rawSettings.userName === 'string' ? { userName: rawSettings.userName } : {}),
    ...(typeof rawSettings.targetDaysWeekly === 'number' ? { targetDaysWeekly: Math.max(1, Math.min(7, rawSettings.targetDaysWeekly)) } : {}),
    ...(typeof rawSettings.targetSwimMetersWeekly === 'number' ? { targetSwimMetersWeekly: Math.max(100, rawSettings.targetSwimMetersWeekly) } : {}),
    ...(typeof rawSettings.restTimerDefaultSeconds === 'number' ? { restTimerDefaultSeconds: Math.max(15, rawSettings.restTimerDefaultSeconds) } : {})
  };

  const normalizedLogs = Array.from(logsMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const normalizedBw = Array.from(bwMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    valid: true,
    checksumVerified,
    payload: {
      version: typeof raw.version === 'number' ? raw.version : 2,
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
      logs: normalizedLogs,
      exercises,
      bodyweight: normalizedBw,
      settings
    }
  };
}

// --- ESPEJO EN LOCALSTORAGE (SOBREVIVE A FALLOS DE INDEXEDDB) ---

export function saveShadowMirror(json: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(SHADOW_BACKUP_KEY, json);
    localStorage.setItem(LAST_BACKUP_TS_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

export function loadShadowMirror(): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    return localStorage.getItem(SHADOW_BACKUP_KEY) || '';
  } catch {
    return '';
  }
}

export function getLastBackupTimestamp(): number | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAST_BACKUP_TS_KEY);
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function markIntentionalClear(cleared: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (cleared) {
      localStorage.setItem(INTENTIONAL_CLEAR_KEY, String(Date.now()));
    } else {
      localStorage.removeItem(INTENTIONAL_CLEAR_KEY);
    }
  } catch {
    // ignorar
  }
}

export function wasIntentionallyCleared(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return Boolean(localStorage.getItem(INTENTIONAL_CLEAR_KEY));
  } catch {
    return false;
  }
}

export function saveEmergencySnapshotLocal(snapshot: SafetySnapshot): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const existingRaw = localStorage.getItem(EMERGENCY_SNAPSHOTS_KEY);
    const existing: SafetySnapshot[] = existingRaw ? JSON.parse(existingRaw) : [];
    const updated = [snapshot, ...existing.filter(s => s.id !== snapshot.id)].slice(0, 5);
    localStorage.setItem(EMERGENCY_SNAPSHOTS_KEY, JSON.stringify(updated));
  } catch {
    // ignorar si localStorage está lleno
  }
}

export function loadEmergencySnapshotsLocal(): SafetySnapshot[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(EMERGENCY_SNAPSHOTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
