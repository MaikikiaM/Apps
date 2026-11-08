// src/db/seedExercises.ts
// Catálogo inicial con los 7 ejercicios exactos requeridos por el usuario

import { ExerciseDefinition } from '../types/models';

export const INITIAL_EXERCISES: ExerciseDefinition[] = [
  {
    id: 'pullups',
    name: 'Dominadas',
    category: 'calisthenics',
    muscleGroup: 'Espalda / Tirón',
    usesExternalWeight: false,
    difficultyFactor: 1.20,
    order: 1
  },
  {
    id: 'commando_pullups',
    name: 'Dominadas Comando',
    category: 'calisthenics',
    muscleGroup: 'Espalda / Core / Bíceps',
    usesExternalWeight: false,
    difficultyFactor: 1.25,
    order: 2
  },
  {
    id: 'chinups',
    name: 'Chin-ups (Supinas)',
    category: 'calisthenics',
    muscleGroup: 'Bíceps / Espalda',
    usesExternalWeight: false,
    difficultyFactor: 1.15,
    order: 3
  },
  {
    id: 'elevated_pike_pushups',
    name: 'Flexiones en Pica Elevadas',
    category: 'calisthenics',
    muscleGroup: 'Hombro / Empuje vertical',
    usesExternalWeight: false,
    difficultyFactor: 1.18,
    order: 4
  },
  {
    id: 'dips',
    name: 'Fondos',
    category: 'calisthenics',
    muscleGroup: 'Pecho / Tríceps',
    usesExternalWeight: false,
    difficultyFactor: 1.05,
    order: 5
  },
  {
    id: 'bicep_curl',
    name: 'Curl de Bíceps (Mancuerna)',
    category: 'weights',
    muscleGroup: 'Bíceps',
    usesExternalWeight: true,
    difficultyFactor: 1.00,
    order: 6
  },
  {
    id: 'supported_tricep_db',
    name: 'Tríceps Apoyado con Mancuerna',
    category: 'weights',
    muscleGroup: 'Tríceps',
    usesExternalWeight: true,
    difficultyFactor: 1.00,
    order: 7
  }
];
