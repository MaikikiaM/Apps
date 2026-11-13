// src/utils/stats.test.ts
import { describe, it, expect } from 'vitest';
import {
  computeStreaksAndWeeklySummary,
  findLastExercisePerformance,
  findLastSwimSession,
  computePersonalRecords,
  hasLogActivity
} from './stats';
import { getWeekDateKeys } from './dates';
import { formatDurationHuman, formatMeters } from './formatters';
import { INITIAL_EXERCISES } from '../db/seedExercises';
import { DailyWorkoutLog } from '../types/models';

const sampleLogs: DailyWorkoutLog[] = [
  {
    date: '2026-11-09', // Lunes
    swim: {
      crawlMeters: 600,
      backstrokeMeters: 200,
      breaststrokeMeters: 200,
      butterflyMeters: 0,
      totalMeters: 1000,
      durationSeconds: 1200, // 2:00 /100m
      poolLengthMeters: 25
    },
    strength: [
      {
        exerciseId: 'pullups',
        mode: 'sets',
        sets: [
          { reps: 10, weightKg: 0 },
          { reps: 8, weightKg: 0 }
        ]
      }
    ],
    updatedAt: 1
  },
  {
    date: '2026-11-10', // Martes
    strength: [
      {
        exerciseId: 'bicep_curl',
        mode: 'sets',
        sets: [
          { reps: 10, weightKg: 14 },
          { reps: 10, weightKg: 14 }
        ]
      }
    ],
    updatedAt: 2
  },
  {
    date: '2026-11-12', // Jueves
    swim: {
      crawlMeters: 800,
      backstrokeMeters: 200,
      breaststrokeMeters: 200,
      butterflyMeters: 100,
      totalMeters: 1300,
      durationSeconds: 1430, // 1:50 /100m
      poolLengthMeters: 25
    },
    strength: [
      {
        exerciseId: 'pullups',
        mode: 'sets',
        sets: [
          { reps: 12, weightKg: 0 },
          { reps: 10, weightKg: 0 }
        ]
      }
    ],
    updatedAt: 3
  }
];

describe('utils/stats & dates & formatters', () => {
  it('calcula semana L-D correctamente', () => {
    const week = getWeekDateKeys('2026-11-12'); // Jueves 12 nov 2026
    expect(week).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15'
    ]);
  });

  it('calcula totales semanales y racha histórica correctamente', () => {
    const summary = computeStreaksAndWeeklySummary(sampleLogs, '2026-11-12');
    expect(summary.weeklyActiveDays).toBe(3);
    expect(summary.weeklySwimMeters).toBe(2300);
    expect(summary.weeklyTotalReps).toBe(60); // 18 + 20 + 22
    expect(summary.weeklyTonnageKg).toBe(280); // 20 * 14
    expect(summary.bestStreakDays).toBe(2); // 09 y 10 consecutivos
    expect(summary.totalActiveDays).toBe(3);
  });

  it('encuentra última marca por ejercicio y última sesión de natación', () => {
    const lastPullups = findLastExercisePerformance(sampleLogs, 'pullups', '2026-11-13');
    expect(lastPullups).not.toBeNull();
    expect(lastPullups!.date).toBe('2026-11-12');
    expect(lastPullups!.maxReps).toBe(12);

    const lastSwim = findLastSwimSession(sampleLogs, '2026-11-12');
    expect(lastSwim).not.toBeNull();
    expect(lastSwim!.date).toBe('2026-11-09');
    expect(lastSwim!.swim.totalMeters).toBe(1000);
  });

  it('calcula récords personales (PRs) de natación y fuerza', () => {
    const prs = computePersonalRecords(sampleLogs, INITIAL_EXERCISES);
    expect(prs.bestSwimMeters).toBe(1300);
    expect(prs.bestSwimMetersDate).toBe('2026-11-12');
    expect(prs.fastestPaceSecPer100m).toBeCloseTo(110, 1);
    expect(prs.totalSwimMetersAllTime).toBe(2300);

    const pullupsPr = prs.exerciseRecords.get('pullups');
    expect(pullupsPr?.bestMaxReps).toBe(12);
    expect(pullupsPr?.bestMaxRepsDate).toBe('2026-11-12');

    const curlPr = prs.exerciseRecords.get('bicep_curl');
    expect(curlPr?.bestWeightKg).toBe(14);
    expect(curlPr?.bestEstimated1RM).toBeCloseTo(18.67, 1);
  });

  it('detecta actividad real y formatea duraciones >= 1h y metros', () => {
    expect(hasLogActivity({ date: '2026-11-13', strength: [], notes: 'Solo nota', updatedAt: 1 })).toBe(false);
    expect(hasLogActivity(sampleLogs[0])).toBe(true);
    expect(formatDurationHuman(3900)).toBe('1h 5m');
    expect(formatDurationHuman(90)).toBe('1m 30s');
    expect(formatMeters(1250)).toContain('250 m');
  });
});
