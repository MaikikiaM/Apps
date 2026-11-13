// src/utils/stats.ts
// Utilidades de cálculo de rachas, metas semanales, récords personales (PRs) e historial reciente

import { DailyWorkoutLog, ExerciseDefinition, StrengthEntry, SwimSession } from '../types/models';
import { addDaysToDateKey, daysBetween, getWeekDateKeys, toLocalDateKey } from './dates';
import { normalizeStrengthEntry } from '../math/progressionEngine';

export function hasStrengthActivity(strength: StrengthEntry[]): boolean {
  return strength.some(st => normalizeStrengthEntry(st).totalReps > 0);
}

export function hasLogActivity(log?: DailyWorkoutLog | null): boolean {
  if (!log) return false;
  const hasSwim = !!(log.swim && log.swim.totalMeters > 0);
  return hasSwim || hasStrengthActivity(log.strength);
}

export interface StreakAndWeeklySummary {
  currentStreakDays: number;
  bestStreakDays: number;
  weeklyActiveDays: number;
  weeklySwimMeters: number;
  weeklyTonnageKg: number;
  weeklyTotalReps: number;
  totalActiveDays: number;
}

export function computeStreaksAndWeeklySummary(
  logs: DailyWorkoutLog[],
  referenceDateKey: string = toLocalDateKey(new Date())
): StreakAndWeeklySummary {
  const activeDatesSet = new Set<string>();
  const logsMap = new Map<string, DailyWorkoutLog>();

  for (const log of logs) {
    logsMap.set(log.date, log);
    if (hasLogActivity(log)) {
      activeDatesSet.add(log.date);
    }
  }

  const sortedActiveDates = Array.from(activeDatesSet).sort();

  // Racha máxima histórica (días consecutivos)
  let bestStreakDays = 0;
  let runningStreak = 0;
  let prevDate: string | null = null;
  for (const dateKey of sortedActiveDates) {
    if (prevDate && daysBetween(prevDate, dateKey) === 1) {
      runningStreak += 1;
    } else {
      runningStreak = 1;
    }
    if (runningStreak > bestStreakDays) {
      bestStreakDays = runningStreak;
    }
    prevDate = dateKey;
  }

  // Racha activa actual: cuenta hacia atrás desde referenceDateKey (o ayer si hoy aún no has entrenado)
  let currentStreakDays = 0;
  const todayKey = toLocalDateKey(new Date());
  let cursor = activeDatesSet.has(todayKey)
    ? todayKey
    : addDaysToDateKey(todayKey, -1);

  while (activeDatesSet.has(cursor)) {
    currentStreakDays += 1;
    cursor = addDaysToDateKey(cursor, -1);
  }

  // Totales de la semana de referenceDateKey (Lunes a Domingo)
  const weekKeys = getWeekDateKeys(referenceDateKey);
  let weeklyActiveDays = 0;
  let weeklySwimMeters = 0;
  let weeklyTonnageKg = 0;
  let weeklyTotalReps = 0;

  for (const wk of weekKeys) {
    const log = logsMap.get(wk);
    if (!log) continue;
    if (hasLogActivity(log)) weeklyActiveDays += 1;
    if (log.swim && log.swim.totalMeters > 0) {
      weeklySwimMeters += log.swim.totalMeters;
    }
    for (const st of log.strength) {
      const stats = normalizeStrengthEntry(st);
      weeklyTotalReps += stats.totalReps;
      weeklyTonnageKg += stats.tonnageKg;
    }
  }

  return {
    currentStreakDays,
    bestStreakDays,
    weeklyActiveDays,
    weeklySwimMeters: Math.round(weeklySwimMeters),
    weeklyTonnageKg: Math.round(weeklyTonnageKg),
    weeklyTotalReps,
    totalActiveDays: sortedActiveDates.length
  };
}

export interface LastExercisePerformance {
  date: string;
  entry: StrengthEntry;
  totalReps: number;
  maxReps: number;
  workingWeightKg: number;
  setsCount: number;
  estimated1RM: number;
}

export function findLastExercisePerformance(
  logs: DailyWorkoutLog[],
  exerciseId: string,
  beforeDateKey: string
): LastExercisePerformance | null {
  const candidates = logs
    .filter(l => l.date < beforeDateKey)
    .sort((a, b) => b.date.localeCompare(a.date));

  for (const log of candidates) {
    const st = log.strength.find(s => s.exerciseId === exerciseId);
    if (st) {
      const stats = normalizeStrengthEntry(st);
      if (stats.totalReps > 0) {
        return {
          date: log.date,
          entry: st,
          totalReps: stats.totalReps,
          maxReps: stats.maxReps,
          workingWeightKg: stats.workingWeightKg,
          setsCount: stats.setsCount,
          estimated1RM: stats.estimated1RM
        };
      }
    }
  }
  return null;
}

export function findLastSwimSession(
  logs: DailyWorkoutLog[],
  beforeDateKey: string
): { date: string; swim: SwimSession } | null {
  const candidates = logs
    .filter(l => l.date < beforeDateKey && l.swim && l.swim.totalMeters > 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (candidates.length === 0 || !candidates[0].swim) return null;
  return { date: candidates[0].date, swim: candidates[0].swim };
}

export function findLastWorkoutLog(
  logs: DailyWorkoutLog[],
  beforeDateKey: string
): DailyWorkoutLog | null {
  const candidates = logs
    .filter(l => l.date < beforeDateKey && hasLogActivity(l))
    .sort((a, b) => b.date.localeCompare(a.date));
  return candidates[0] || null;
}

export interface ExercisePersonalRecord {
  exerciseId: string;
  name: string;
  category: 'calisthenics' | 'weights';
  bestMaxReps: number;
  bestMaxRepsDate: string;
  bestWeightKg: number;
  bestWeightDate: string;
  bestEstimated1RM: number;
  best1RMDate: string;
}

export interface PersonalRecordsSummary {
  bestSwimMeters: number;
  bestSwimMetersDate: string | null;
  fastestPaceSecPer100m: number | null;
  fastestPaceDate: string | null;
  totalSwimMetersAllTime: number;
  exerciseRecords: Map<string, ExercisePersonalRecord>;
}

export function computePersonalRecords(
  logs: DailyWorkoutLog[],
  exercises: ExerciseDefinition[],
  excludeDateKey?: string
): PersonalRecordsSummary {
  const exMap = new Map(exercises.map(e => [e.id, e]));
  let bestSwimMeters = 0;
  let bestSwimMetersDate: string | null = null;
  let fastestPaceSecPer100m: number | null = null;
  let fastestPaceDate: string | null = null;
  let totalSwimMetersAllTime = 0;

  const exerciseRecords = new Map<string, ExercisePersonalRecord>();

  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  for (const log of sorted) {
    if (excludeDateKey && log.date === excludeDateKey) continue;

    if (log.swim && log.swim.totalMeters > 0) {
      totalSwimMetersAllTime += log.swim.totalMeters;
      if (log.swim.totalMeters > bestSwimMeters) {
        bestSwimMeters = log.swim.totalMeters;
        bestSwimMetersDate = log.date;
      }
      if (log.swim.totalMeters >= 100 && log.swim.durationSeconds > 0) {
        const pace = (log.swim.durationSeconds / log.swim.totalMeters) * 100;
        if (fastestPaceSecPer100m === null || pace < fastestPaceSecPer100m) {
          fastestPaceSecPer100m = pace;
          fastestPaceDate = log.date;
        }
      }
    }

    for (const st of log.strength) {
      const stats = normalizeStrengthEntry(st);
      if (stats.totalReps <= 0) continue;
      const def = exMap.get(st.exerciseId);
      const existing = exerciseRecords.get(st.exerciseId) || {
        exerciseId: st.exerciseId,
        name: def?.name || st.exerciseId,
        category: def?.category || 'calisthenics',
        bestMaxReps: 0,
        bestMaxRepsDate: log.date,
        bestWeightKg: 0,
        bestWeightDate: log.date,
        bestEstimated1RM: 0,
        best1RMDate: log.date
      };

      if (stats.maxReps > existing.bestMaxReps) {
        existing.bestMaxReps = stats.maxReps;
        existing.bestMaxRepsDate = log.date;
      }
      if (stats.workingWeightKg > existing.bestWeightKg) {
        existing.bestWeightKg = stats.workingWeightKg;
        existing.bestWeightDate = log.date;
      }
      if (stats.estimated1RM > existing.bestEstimated1RM) {
        existing.bestEstimated1RM = stats.estimated1RM;
        existing.best1RMDate = log.date;
      }

      exerciseRecords.set(st.exerciseId, existing);
    }
  }

  return {
    bestSwimMeters,
    bestSwimMetersDate,
    fastestPaceSecPer100m,
    fastestPaceDate,
    totalSwimMetersAllTime,
    exerciseRecords
  };
}
