// src/math/progressionEngine.ts
// Motor matemático diario de rendimiento, 1RM amortiguado, modelo CTL/ATL/TSB y proyecciones

import {
  DailyWorkoutLog,
  ExerciseDefinition,
  BodyWeightEntry,
  NormalizedStrengthStats,
  DailyMathSnapshot,
  MetricProjection,
  StrengthEntry
} from '../types/models';
import { toLocalDateKey, parseLocalDateKey, getDateRangeSequence } from '../utils/dates';

// Normaliza cualquier entrada de fuerza (Modo Series vs Modo Rápido)
export function normalizeStrengthEntry(entry: StrengthEntry): NormalizedStrengthStats {
  if (entry.mode === 'sets') {
    const validSets = (entry.sets || []).filter(s => s.reps > 0);
    const totalReps = validSets.reduce((acc, s) => acc + s.reps, 0);
    const maxReps = validSets.length > 0 ? Math.max(...validSets.map(s => s.reps)) : 0;
    const workingWeightKg = validSets.length > 0 ? Math.max(...validSets.map(s => s.weightKg || 0)) : 0;
    const tonnageKg = validSets.reduce((acc, s) => acc + (s.reps * (s.weightKg || 0)), 0);
    
    // 1RM estimado: mejor 1RM entre todas las series
    let best1RM = 0;
    for (const s of validSets) {
      const e1rm = calculateEpley1RM(s.weightKg || 0, s.reps);
      if (e1rm > best1RM) best1RM = e1rm;
    }

    return {
      exerciseId: entry.exerciseId,
      totalReps,
      maxReps,
      workingWeightKg,
      tonnageKg,
      setsCount: validSets.length,
      estimated1RM: best1RM
    };
  } else {
    // Modo Rápido
    const totalReps = entry.quickTotalReps || 0;
    const setsCount = entry.quickSetsCount || 3;
    const maxReps = entry.quickBestSetReps || Math.round(totalReps / Math.max(1, setsCount));
    const workingWeightKg = entry.quickWeightKg || 0;
    const tonnageKg = totalReps * workingWeightKg;
    const estimated1RM = calculateEpley1RM(workingWeightKg, maxReps);

    return {
      exerciseId: entry.exerciseId,
      totalReps,
      maxReps,
      workingWeightKg,
      tonnageKg,
      setsCount,
      estimated1RM
    };
  }
}

// Fórmula de 1RM continua de Epley amortiguada en reps > 12
export function calculateEpley1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  if (reps <= 12) {
    return weightKg * (1 + reps / 30);
  }
  // Amortiguada para series altas de bíceps / tríceps
  return weightKg * (1.4 + 0.015 * (reps - 12));
}

// Interpolación continua de peso corporal entre fechas registradas
export function getInterpolatedBodyWeight(
  dateKey: string,
  bodyWeights: BodyWeightEntry[],
  defaultWeight: number = 75.0
): number {
  if (!bodyWeights || bodyWeights.length === 0) return defaultWeight;
  const sorted = [...bodyWeights].sort((a, b) => a.date.localeCompare(b.date));

  // Si la fecha es anterior al primer pesaje
  if (dateKey <= sorted[0].date) return sorted[0].weightKg;
  // Si la fecha es posterior al último pesaje
  if (dateKey >= sorted[sorted.length - 1].date) return sorted[sorted.length - 1].weightKg;

  // Buscar el intervalo entre dos pesajes
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (dateKey >= a.date && dateKey <= b.date) {
      if (a.date === b.date) return a.weightKg;
      const tA = parseLocalDateKey(a.date).getTime();
      const tB = parseLocalDateKey(b.date).getTime();
      const tKey = parseLocalDateKey(dateKey).getTime();
      const fraction = (tKey - tA) / (tB - tA);
      return a.weightKg + fraction * (b.weightKg - a.weightKg);
    }
  }

  return defaultWeight;
}

// Puntuación fisiológica de sesión de natación
export function calculateSwimRawScore(
  swim: DailyWorkoutLog['swim'],
  baselineSpeedMPerSec?: number
): number {
  if (!swim || swim.totalMeters <= 0) return 0;

  const crawl = swim.crawlMeters || 0;
  const back = swim.backstrokeMeters || 0;
  const breast = swim.breaststrokeMeters || 0;
  const fly = swim.butterflyMeters || 0;
  const strokeSum = crawl + back + breast + fly;
  const unassigned = Math.max(0, swim.totalMeters - strokeSum);

  const effectiveMeters =
    1.00 * crawl +
    1.08 * back +
    1.15 * breast +
    1.35 * fly +
    1.00 * unassigned;

  // Factor de ritmo si hay tiempo registrado
  let velocityFactor = 1.0;
  if (swim.durationSeconds > 0 && baselineSpeedMPerSec && baselineSpeedMPerSec > 0) {
    const currentSpeed = swim.totalMeters / swim.durationSeconds;
    const ratio = currentSpeed / baselineSpeedMPerSec;
    // Acotar entre 0.75 y 1.50
    velocityFactor = Math.min(1.50, Math.max(0.75, Math.pow(ratio, 1.5)));
  }

  return effectiveMeters * velocityFactor;
}

// Puntuación fisiológica de ejercicio de calistenia
export function calculateCalisthenicsRawScore(
  stats: NormalizedStrengthStats,
  exDef: ExerciseDefinition,
  bodyWeightKg: number,
  baselineBodyWeight: number = 75.0
): number {
  if (stats.totalReps <= 0) return 0;
  const alpha = exDef.difficultyFactor || 1.1;
  const weightRatio = (bodyWeightKg + stats.workingWeightKg) / baselineBodyWeight;
  const repScore = 0.60 * stats.maxReps + 0.40 * Math.sqrt(stats.totalReps * stats.maxReps);
  return alpha * weightRatio * repScore;
}

// Puntuación fisiológica de ejercicio de pesas (mancuernas)
export function calculateWeightsRawScore(stats: NormalizedStrengthStats): number {
  if (stats.totalReps <= 0 || stats.workingWeightKg <= 0) return 0;
  return 0.70 * stats.estimated1RM + 0.30 * (stats.tonnageKg / 25);
}

// Regresión lineal ponderada por recencia
export interface LinearRegressionResult {
  slope: number;       // pendiente diaria m
  intercept: number;   // ordenada en el origen
  r2: number;          // coeficiente de determinación (calidad del ajuste)
  lastValue: number;
}

export function computeWeightedLinearRegression(
  points: { dayIndex: number; value: number }[]
): LinearRegressionResult | null {
  if (points.length < 2) return null;

  const n = points.length;
  const maxDay = points[points.length - 1].dayIndex;

  let sumW = 0;
  let sumWX = 0;
  let sumWY = 0;
  let sumWXX = 0;
  let sumWXY = 0;

  for (let i = 0; i < n; i++) {
    const p = points[i];
    // Ponderación por recencia: mayor peso a los últimos 60 días
    const ageDays = Math.max(0, maxDay - p.dayIndex);
    const weight = Math.exp(-ageDays / 60);

    sumW += weight;
    sumWX += weight * p.dayIndex;
    sumWY += weight * p.value;
    sumWXX += weight * p.dayIndex * p.dayIndex;
    sumWXY += weight * p.dayIndex * p.value;
  }

  const denom = sumW * sumWXX - sumWX * sumWX;
  if (Math.abs(denom) < 1e-9) {
    return {
      slope: 0,
      intercept: points[points.length - 1].value,
      r2: 0,
      lastValue: points[points.length - 1].value
    };
  }

  const slope = (sumW * sumWXY - sumWX * sumWY) / denom;
  const intercept = (sumWY - slope * sumWX) / sumW;

  // Calcular R2
  const meanY = sumWY / sumW;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const ageDays = Math.max(0, maxDay - p.dayIndex);
    const weight = Math.exp(-ageDays / 60);
    const predicted = intercept + slope * p.dayIndex;
    ssTot += weight * Math.pow(p.value - meanY, 2);
    ssRes += weight * Math.pow(p.value - predicted, 2);
  }

  const r2 = ssTot > 1e-9 ? Math.max(0, 1 - (ssRes / ssTot)) : 1;

  return {
    slope,
    intercept,
    r2,
    lastValue: points[points.length - 1].value
  };
}

// Proyección amortiguada con rendimientos decrecientes
export function projectDampedValue(
  currentValue: number,
  slope: number,
  deltaDays: number
): number {
  if (deltaDays <= 0) return currentValue;
  // Amortiguación fisiológica: 1 / sqrt(1 + delta / 45)
  const damping = 1 / Math.sqrt(1 + deltaDays / 45);
  const gain = slope * deltaDays * damping;
  return Math.max(0, currentValue + gain);
}

// ========================================================================
// MOTOR MATEMÁTICO COMPLETO: SERIE DIARIA CONTINUA + SNAPSHOTS
// ========================================================================

export interface FullEngineResult {
  snapshots: DailyMathSnapshot[];
  snapshotsByDate: Map<string, DailyMathSnapshot>;
  todaySnapshot: DailyMathSnapshot | null;
  overallIga: number;
  overallIgaChangePercent: number;
  projections: MetricProjection[];
  exerciseStatsMap: Map<string, NormalizedStrengthStats[]>;
}

export function computeDailyProgressionSeries(
  logs: DailyWorkoutLog[],
  exercises: ExerciseDefinition[],
  bodyWeights: BodyWeightEntry[],
  asOfDateKey: string = toLocalDateKey(new Date())
): FullEngineResult {
  const sortedLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const exMap = new Map(exercises.map(e => [e.id, e]));

  if (sortedLogs.length === 0) {
    return {
      snapshots: [],
      snapshotsByDate: new Map(),
      todaySnapshot: null,
      overallIga: 100,
      overallIgaChangePercent: 0,
      projections: [],
      exerciseStatsMap: new Map()
    };
  }

  const firstDateKey = sortedLogs[0].date;
  const endDateKey = asOfDateKey > sortedLogs[sortedLogs.length - 1].date
    ? asOfDateKey
    : sortedLogs[sortedLogs.length - 1].date;

  const dateSequence = getDateRangeSequence(firstDateKey, endDateKey);
  const logMap = new Map(sortedLogs.map(l => [l.date, l]));

  // 1. Calcular velocidades base y líneas base para cada componente
  // Natación: velocidad base de las primeras 3 sesiones con tiempo
  const timedSwimLogs = sortedLogs.filter(l => l.swim && l.swim.totalMeters > 0 && l.swim.durationSeconds > 0);
  const baseTimedLogs = timedSwimLogs.slice(0, 3);
  let baseSwimSpeedMPerSec: number | undefined = undefined;
  if (baseTimedLogs.length > 0) {
    const totalM = baseTimedLogs.reduce((acc, l) => acc + (l.swim?.totalMeters || 0), 0);
    const totalS = baseTimedLogs.reduce((acc, l) => acc + (l.swim?.durationSeconds || 0), 0);
    if (totalS > 0) baseSwimSpeedMPerSec = totalM / totalS;
  }

  // Base raw scores de los primeros 3 entrenamientos de cada componente
  const swimRawScores: number[] = [];
  const exerciseStatsMap = new Map<string, NormalizedStrengthStats[]>();
  const exerciseRawScoreHistory = new Map<string, number[]>();

  for (const l of sortedLogs) {
    if (l.swim && l.swim.totalMeters > 0) {
      swimRawScores.push(calculateSwimRawScore(l.swim, baseSwimSpeedMPerSec));
    }
    for (const st of l.strength) {
      const stats = normalizeStrengthEntry(st);
      if (stats.totalReps > 0) {
        if (!exerciseStatsMap.has(st.exerciseId)) {
          exerciseStatsMap.set(st.exerciseId, []);
          exerciseRawScoreHistory.set(st.exerciseId, []);
        }
        exerciseStatsMap.get(st.exerciseId)!.push(stats);

        const exDef = exMap.get(st.exerciseId);
        const bw = getInterpolatedBodyWeight(l.date, bodyWeights);
        const rawScore = exDef?.category === 'calisthenics'
          ? calculateCalisthenicsRawScore(stats, exDef, bw)
          : calculateWeightsRawScore(stats);
        exerciseRawScoreHistory.get(st.exerciseId)!.push(rawScore);
      }
    }
  }

  const baseSwimScore = swimRawScores.length > 0
    ? (swimRawScores.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, swimRawScores.length))
    : 1000;

  const exerciseBases = new Map<string, number>();
  for (const [exId, rawList] of exerciseRawScoreHistory.entries()) {
    const base = rawList.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, rawList.length);
    exerciseBases.set(exId, Math.max(1, base));
  }

  // 2. Simulación día a día continua de estados E_k(d), CTL, ATL, TSB e IGA
  const snapshots: DailyMathSnapshot[] = [];
  const snapshotsByDate = new Map<string, DailyMathSnapshot>();

  let prevSwimE: number | null = null;
  let lastSwimDayIndex: number = -999;

  const prevExE = new Map<string, number>();
  const lastExDayIndex = new Map<string, number>();

  let ctl = 0;
  let atl = 0;

  for (let dIdx = 0; dIdx < dateSequence.length; dIdx++) {
    const dateKey = dateSequence[dIdx];
    const log = logMap.get(dateKey);

    let dailySwimLoad = 0;
    let dailyCaliLoad = 0;
    let dailyWeightsLoad = 0;

    let hasSwim = false;
    let swimScore = 0;
    let hasStrength = false;
    let strengthScore = 0;
    let hasWeights = false;
    let weightsScore = 0;

    // Actualización de estado de Natación
    if (log?.swim && log.swim.totalMeters > 0) {
      hasSwim = true;
      const raw = calculateSwimRawScore(log.swim, baseSwimSpeedMPerSec);
      const sessionIndex = Math.min(250, (raw / Math.max(1, baseSwimScore)) * 100);
      dailySwimLoad = sessionIndex;

      if (prevSwimE === null) {
        prevSwimE = sessionIndex;
      } else {
        prevSwimE = 0.35 * sessionIndex + 0.65 * prevSwimE;
      }
      lastSwimDayIndex = dIdx;
      swimScore = prevSwimE;
    } else if (prevSwimE !== null) {
      const restDays = dIdx - lastSwimDayIndex;
      if (restDays > 5) {
        prevSwimE = 50 + (prevSwimE - 50) * Math.exp(-1 / 45);
      }
      swimScore = prevSwimE;
    }

    // Actualización de Fuerza (Calistenia y Pesas)
    const activeExThisDay = new Set<string>();
    if (log && log.strength.length > 0) {
      for (const st of log.strength) {
        const stats = normalizeStrengthEntry(st);
        if (stats.totalReps > 0) {
          activeExThisDay.add(st.exerciseId);
          const exDef = exMap.get(st.exerciseId);
          const bw = getInterpolatedBodyWeight(dateKey, bodyWeights);
          const raw = exDef?.category === 'calisthenics'
            ? calculateCalisthenicsRawScore(stats, exDef, bw)
            : calculateWeightsRawScore(stats);

          const base = exerciseBases.get(st.exerciseId) || 10;
          const sessionIndex = Math.min(250, (raw / base) * 100);

          if (exDef?.category === 'calisthenics') {
            hasStrength = true;
            dailyCaliLoad += sessionIndex;
          } else {
            hasWeights = true;
            dailyWeightsLoad += sessionIndex;
          }

          const prevE = prevExE.get(st.exerciseId);
          if (prevE === undefined) {
            prevExE.set(st.exerciseId, sessionIndex);
          } else {
            prevExE.set(st.exerciseId, 0.35 * sessionIndex + 0.65 * prevE);
          }
          lastExDayIndex.set(st.exerciseId, dIdx);
        }
      }
    }

    // Desentrenamiento suave en ejercicios no hechos hoy
    for (const [exId, prevE] of prevExE.entries()) {
      if (!activeExThisDay.has(exId)) {
        const lastDay = lastExDayIndex.get(exId) ?? dIdx;
        const restDays = dIdx - lastDay;
        if (restDays > 5) {
          prevExE.set(exId, 50 + (prevE - 50) * Math.exp(-1 / 45));
        }
      }
    }

    // Puntuaciones compuestas de calistenia y pesas para el día
    let caliSum = 0;
    let caliCount = 0;
    let weightsSum = 0;
    let weightsCount = 0;

    for (const [exId, currentE] of prevExE.entries()) {
      const def = exMap.get(exId);
      if (def?.category === 'calisthenics') {
        caliSum += currentE;
        caliCount++;
      } else {
        weightsSum += currentE;
        weightsCount++;
      }
    }

    if (caliCount > 0) strengthScore = caliSum / caliCount;
    if (weightsCount > 0) weightsScore = weightsSum / weightsCount;

    // Impulso de entrenamiento del día (Daily Load)
    const dailyLoad = (dailySwimLoad * 0.45) + (dailyCaliLoad * 0.30) + (dailyWeightsLoad * 0.25);

    // Banister CTL / ATL / TSB
    ctl = ctl + (dailyLoad - ctl) / 28;
    atl = atl + (dailyLoad - atl) / 7;
    const tsb = ctl - atl;

    // Índice Global de Avance (IGA): promedio ponderado de dominios que han tenido actividad
    const activeDomains: number[] = [];
    if (prevSwimE !== null) activeDomains.push(swimScore);
    if (caliCount > 0) activeDomains.push(strengthScore);
    if (weightsCount > 0) activeDomains.push(weightsScore);

    const baseDomainMean = activeDomains.length > 0
      ? (activeDomains.reduce((a, b) => a + b, 0) / activeDomains.length)
      : 100;

    // Factor de consistencia en ventana móvil de 28 días
    const windowStartIdx = Math.max(0, dIdx - 27);
    let sessionsInLast28Days = 0;
    for (let k = windowStartIdx; k <= dIdx; k++) {
      const kLog = logMap.get(dateSequence[k]);
      if (kLog && ((kLog.swim && kLog.swim.totalMeters > 0) || kLog.strength.length > 0)) {
        sessionsInLast28Days++;
      }
    }
    const consistencyBonus = 5 * Math.min(1, sessionsInLast28Days / 14);
    const iga = Math.round((baseDomainMean + consistencyBonus) * 10) / 10;

    const snapshot: DailyMathSnapshot = {
      date: dateKey,
      hasSwim,
      swimScore: Math.round(swimScore * 10) / 10,
      hasStrength,
      strengthScore: Math.round(strengthScore * 10) / 10,
      hasWeights,
      weightsScore: Math.round(weightsScore * 10) / 10,
      dailyLoad: Math.round(dailyLoad),
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round(tsb * 10) / 10,
      iga,
      activeDomainsCount: activeDomains.length
    };

    snapshots.push(snapshot);
    snapshotsByDate.set(dateKey, snapshot);
  }

  const todaySnapshot = snapshotsByDate.get(asOfDateKey) || snapshots[snapshots.length - 1];
  const firstIga = snapshots.length > 0 ? snapshots[0].iga : 100;
  const currentIga = todaySnapshot ? todaySnapshot.iga : 100;
  const overallIgaChangePercent = firstIga > 0
    ? Math.round(((currentIga - firstIga) / firstIga) * 1000) / 10
    : 0;

  // 3. Proyecciones a 30 y 90 días para cada métrica principal
  const projections: MetricProjection[] = [];

  // Proyección de IGA
  const igaPoints = snapshots.map((s, idx) => ({ dayIndex: idx, value: s.iga }));
  const igaReg = computeWeightedLinearRegression(igaPoints);
  if (igaReg) {
    const cur = igaPoints[igaPoints.length - 1].value;
    projections.push({
      key: 'iga',
      title: 'Índice Global de Rendimiento',
      unit: 'pts',
      currentValue: cur,
      projected30d: Math.round(projectDampedValue(cur, igaReg.slope, 30) * 10) / 10,
      projected90d: Math.round(projectDampedValue(cur, igaReg.slope, 90) * 10) / 10,
      monthlyGainRate: Math.round(igaReg.slope * 30 * 10) / 10,
      confidence: Math.round(igaReg.r2 * 100) / 100,
      dataPointsCount: igaPoints.length
    });
  }

  // Proyección de Metros de Natación
  const swimMetersPoints: { dayIndex: number; value: number }[] = [];
  for (let i = 0; i < sortedLogs.length; i++) {
    const l = sortedLogs[i];
    if (l.swim && l.swim.totalMeters > 0) {
      const dayOffset = (parseLocalDateKey(l.date).getTime() - parseLocalDateKey(firstDateKey).getTime()) / (1000 * 60 * 60 * 24);
      swimMetersPoints.push({ dayIndex: dayOffset, value: l.swim.totalMeters });
    }
  }
  if (swimMetersPoints.length >= 3) {
    const reg = computeWeightedLinearRegression(swimMetersPoints);
    if (reg) {
      const cur = swimMetersPoints[swimMetersPoints.length - 1].value;
      projections.push({
        key: 'swim_meters',
        title: 'Natación — Volumen por Sesión',
        unit: 'm',
        currentValue: cur,
        projected30d: Math.round(projectDampedValue(cur, reg.slope, 30)),
        projected90d: Math.round(projectDampedValue(cur, reg.slope, 90)),
        monthlyGainRate: Math.round(reg.slope * 30),
        confidence: Math.round(reg.r2 * 100) / 100,
        dataPointsCount: swimMetersPoints.length
      });
    }
  }

  // Proyecciones para cada ejercicio
  for (const ex of exercises) {
    const history = exerciseStatsMap.get(ex.id) || [];
    if (history.length >= 3) {
      const metricValues: { dayIndex: number; value: number }[] = [];
      let metricUnit = 'reps';
      let metricTitle = `${ex.name} — Reps Máx`;

      for (let i = 0; i < sortedLogs.length; i++) {
        const l = sortedLogs[i];
        const st = l.strength.find(s => s.exerciseId === ex.id);
        if (st) {
          const stats = normalizeStrengthEntry(st);
          const dayOffset = (parseLocalDateKey(l.date).getTime() - parseLocalDateKey(firstDateKey).getTime()) / (1000 * 60 * 60 * 24);
          if (ex.category === 'weights') {
            metricUnit = 'kg';
            metricTitle = `${ex.name} — 1RM Estimado`;
            metricValues.push({ dayIndex: dayOffset, value: stats.estimated1RM });
          } else {
            metricValues.push({ dayIndex: dayOffset, value: stats.maxReps });
          }
        }
      }

      if (metricValues.length >= 3) {
        const reg = computeWeightedLinearRegression(metricValues);
        if (reg) {
          const cur = metricValues[metricValues.length - 1].value;
          projections.push({
            key: ex.id,
            title: metricTitle,
            unit: metricUnit,
            currentValue: Math.round(cur * 10) / 10,
            projected30d: Math.round(projectDampedValue(cur, reg.slope, 30) * 10) / 10,
            projected90d: Math.round(projectDampedValue(cur, reg.slope, 90) * 10) / 10,
            monthlyGainRate: Math.round(reg.slope * 30 * 10) / 10,
            confidence: Math.round(reg.r2 * 100) / 100,
            dataPointsCount: metricValues.length
          });
        }
      }
    }
  }

  return {
    snapshots,
    snapshotsByDate,
    todaySnapshot,
    overallIga: currentIga,
    overallIgaChangePercent,
    projections,
    exerciseStatsMap
  };
}
