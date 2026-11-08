// src/types/models.ts
// Tipos e interfaces de la aplicación de entrenamientos

export type ExerciseCategory = 'calisthenics' | 'weights';

export interface ExerciseDefinition {
  id: string;
  name: string;
  category: ExerciseCategory;
  muscleGroup: string;
  usesExternalWeight: boolean; // Obligatorio en pesas, opcional (lastre) en calistenia
  difficultyFactor: number;    // Factor alpha para el motor matemático
  archived?: boolean;
  order: number;
}

export interface SwimSession {
  crawlMeters: number;         // Crol
  backstrokeMeters: number;    // Espalda
  breaststrokeMeters: number;  // Braza
  butterflyMeters: number;     // Mariposa
  totalMeters: number;         // Metros totales (>= suma de estilos)
  durationSeconds: number;     // Tiempo total en segundos (ej. 45m 30s = 2730)
  poolLengthMeters: 25 | 50;
  notes?: string;
}

export interface StrengthSet {
  reps: number;
  weightKg: number;            // 0 si solo peso corporal, >0 si mancuerna o lastre
}

export interface StrengthEntry {
  exerciseId: string;
  mode: 'sets' | 'quick';      // 'sets' para desglosado serie por serie, 'quick' para total rápido
  sets: StrengthSet[];         // Cuando mode === 'sets'
  quickTotalReps?: number;     // Cuando mode === 'quick'
  quickBestSetReps?: number;   // Opcional en modo rápido (mejor serie estimada)
  quickSetsCount?: number;     // Número aproximado de series en modo rápido
  quickWeightKg?: number;      // Peso de mancuerna o lastre en modo rápido
}

export interface DailyWorkoutLog {
  date: string;                // Clave primaria local 'YYYY-MM-DD'
  swim?: SwimSession;
  strength: StrengthEntry[];
  notes?: string;
  updatedAt: number;
}

export interface BodyWeightEntry {
  date: string;                // Clave 'YYYY-MM-DD' (habitualmente 1 vez al mes)
  weightKg: number;
  notes?: string;
}

export interface AppSettings {
  poolLengthDefault: 25 | 50;
  userName?: string;
  targetSwimMetersWeekly?: number;
  targetDaysWeekly?: number;
}

// Normalización unificada para cualquier entrada de fuerza
export interface NormalizedStrengthStats {
  exerciseId: string;
  totalReps: number;
  maxReps: number;
  workingWeightKg: number;
  tonnageKg: number;
  setsCount: number;
  estimated1RM: number;
}

// Estadísticas diarias de avance para el motor matemático
export interface DailyMathSnapshot {
  date: string;
  hasSwim: boolean;
  swimScore: number;
  hasStrength: boolean;
  strengthScore: number;
  hasWeights: boolean;
  weightsScore: number;
  dailyLoad: number;           // Impulso de entrenamiento del día
  ctl: number;                 // Fitness / Forma crónica (28 días)
  atl: number;                 // Fatigue / Fatiga aguda (7 días)
  tsb: number;                 // Form / Frescura (CTL - ATL)
  iga: number;                 // Índice Global de Avance base 100
  activeDomainsCount: number;
}

// Estimación y proyección matemática para cada ejercicio / métrica
export interface MetricProjection {
  key: string;
  title: string;
  unit: string;
  currentValue: number;
  projected30d: number;
  projected90d: number;
  monthlyGainRate: number;     // Ritmo de mejora mensual (+X unit/mes)
  confidence: number;          // R2 o calidad de ajuste (0 a 1)
  dataPointsCount: number;
}
