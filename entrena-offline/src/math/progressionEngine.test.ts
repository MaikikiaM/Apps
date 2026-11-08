// src/math/progressionEngine.test.ts
import { describe, it, expect } from 'vitest';
import {
  calculateEpley1RM,
  normalizeStrengthEntry,
  getInterpolatedBodyWeight,
  calculateSwimRawScore,
  computeWeightedLinearRegression,
  projectDampedValue,
  computeDailyProgressionSeries
} from './progressionEngine';
import { INITIAL_EXERCISES } from '../db/seedExercises';
import { DailyWorkoutLog, BodyWeightEntry } from '../types/models';

describe('progressionEngine', () => {
  it('maneja 0 registros sin fallos ni NaN', () => {
    const result = computeDailyProgressionSeries([], INITIAL_EXERCISES, []);
    expect(result.snapshots).toEqual([]);
    expect(result.overallIga).toBe(100);
    expect(result.overallIgaChangePercent).toBe(0);
    expect(result.projections).toEqual([]);
  });

  it('calcula 1RM de Epley de forma continua y amortiguada en reps > 12', () => {
    // Para reps = 1
    expect(calculateEpley1RM(20, 1)).toBe(20);

    // En reps = 12: 20 * (1 + 12/30) = 20 * 1.4 = 28
    const r12 = calculateEpley1RM(20, 12);
    expect(r12).toBeCloseTo(28, 2);

    // En reps = 13: 20 * (1.4 + 0.015 * 1) = 20 * 1.415 = 28.3
    const r13 = calculateEpley1RM(20, 13);
    expect(r13).toBeGreaterThan(r12);
    expect(r13).toBeLessThan(30);

    // No debe dar valores infinitos ni negativos
    expect(calculateEpley1RM(0, 10)).toBe(0);
    expect(calculateEpley1RM(20, 0)).toBe(0);
  });

  it('normaliza consistentemente Modo Series vs Modo Rápido', () => {
    const entrySets = normalizeStrengthEntry({
      exerciseId: 'bicep_curl',
      mode: 'sets',
      sets: [
        { reps: 10, weightKg: 12 },
        { reps: 10, weightKg: 12 },
        { reps: 10, weightKg: 12 }
      ]
    });

    const entryQuick = normalizeStrengthEntry({
      exerciseId: 'bicep_curl',
      mode: 'quick',
      sets: [],
      quickTotalReps: 30,
      quickBestSetReps: 10,
      quickSetsCount: 3,
      quickWeightKg: 12
    });

    expect(entrySets.totalReps).toBe(30);
    expect(entryQuick.totalReps).toBe(30);
    expect(entrySets.maxReps).toBe(10);
    expect(entryQuick.maxReps).toBe(10);
    expect(entrySets.tonnageKg).toBe(360);
    expect(entryQuick.tonnageKg).toBe(360);
    expect(entrySets.estimated1RM).toBeCloseTo(entryQuick.estimated1RM, 1);
  });

  it('interpola el peso corporal mensual entre dos fechas', () => {
    const weights: BodyWeightEntry[] = [
      { date: '2026-01-01', weightKg: 80.0 },
      { date: '2026-01-31', weightKg: 78.0 }
    ];

    // Antes de la primera fecha
    expect(getInterpolatedBodyWeight('2025-12-15', weights)).toBe(80.0);
    // Después de la última fecha
    expect(getInterpolatedBodyWeight('2026-02-15', weights)).toBe(78.0);
    // En el punto medio (16 de enero)
    const midWeight = getInterpolatedBodyWeight('2026-01-16', weights);
    expect(midWeight).toBeCloseTo(79.0, 0.5);
  });

  it('calcula la puntuación de natación considerando estilos o solo metros totales', () => {
    // Sesión desglosada
    const swimBroken = calculateSwimRawScore({
      crawlMeters: 500,
      backstrokeMeters: 200,
      breaststrokeMeters: 200,
      butterflyMeters: 100,
      totalMeters: 1000,
      durationSeconds: 1200,
      poolLengthMeters: 25
    });

    // Sesión con solo metros totales
    const swimTotalOnly = calculateSwimRawScore({
      crawlMeters: 0,
      backstrokeMeters: 0,
      breaststrokeMeters: 0,
      butterflyMeters: 0,
      totalMeters: 1000,
      durationSeconds: 1200,
      poolLengthMeters: 25
    });

    // Como mariposa, braza y espalda tienen coeficientes mayores a 1.0, swimBroken debe ser mayor
    expect(swimBroken).toBeGreaterThan(swimTotalOnly);
    expect(swimTotalOnly).toBe(1000);
  });

  it('calcula regresión y proyección amortiguada', () => {
    const points = [
      { dayIndex: 0, value: 10 },
      { dayIndex: 10, value: 12 },
      { dayIndex: 20, value: 14 }
    ];

    const reg = computeWeightedLinearRegression(points);
    expect(reg).not.toBeNull();
    expect(reg!.slope).toBeGreaterThan(0);

    const proj30 = projectDampedValue(14, reg!.slope, 30);
    const proj90 = projectDampedValue(14, reg!.slope, 90);

    // Debe progresar con respecto al valor actual
    expect(proj30).toBeGreaterThan(14);
    expect(proj90).toBeGreaterThan(proj30);

    // La ganancia en los primeros 30 días debe ser superior a la ganancia marginal entre 30 y 60 días
    const gainFirst30 = proj30 - 14;
    const gainNext30 = (projectDampedValue(14, reg!.slope, 60) - proj30);
    expect(gainFirst30).toBeGreaterThan(gainNext30);
  });

  it('genera una serie diaria continua con días de descanso y cálculo de CTL/ATL', () => {
    const logs: DailyWorkoutLog[] = [
      {
        date: '2026-03-01',
        swim: {
          crawlMeters: 1000,
          backstrokeMeters: 0,
          breaststrokeMeters: 0,
          butterflyMeters: 0,
          totalMeters: 1000,
          durationSeconds: 1200,
          poolLengthMeters: 25
        },
        strength: [
          {
            exerciseId: 'pullups',
            mode: 'sets',
            sets: [{ reps: 10, weightKg: 0 }, { reps: 8, weightKg: 0 }]
          }
        ],
        updatedAt: 1
      },
      {
        date: '2026-03-03', // Hay un día de descanso intermedio (2026-03-02)
        strength: [
          {
            exerciseId: 'bicep_curl',
            mode: 'sets',
            sets: [{ reps: 10, weightKg: 14 }, { reps: 10, weightKg: 14 }]
          }
        ],
        updatedAt: 2
      }
    ];

    const result = computeDailyProgressionSeries(logs, INITIAL_EXERCISES, [], '2026-03-03');

    // Debe contener exactamente 3 días (01, 02, 03)
    expect(result.snapshots.length).toBe(3);
    expect(result.snapshots[0].date).toBe('2026-03-01');
    expect(result.snapshots[1].date).toBe('2026-03-02');
    expect(result.snapshots[2].date).toBe('2026-03-03');

    // El día 02 es descanso: dailyLoad debe ser 0
    expect(result.snapshots[1].dailyLoad).toBe(0);
    // CTL y ATL deben decaer suavemente en el día de descanso
    expect(result.snapshots[1].atl).toBeLessThan(result.snapshots[0].atl);
  });
});
