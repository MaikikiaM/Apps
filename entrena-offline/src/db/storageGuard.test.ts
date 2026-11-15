// src/db/storageGuard.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildVerifiedBackupPayload,
  computeIntegrityChecksum,
  loadEmergencySnapshotsLocal,
  loadShadowMirror,
  markIntentionalClear,
  saveEmergencySnapshotLocal,
  saveShadowMirror,
  validateAndNormalizeBackupJson,
  wasIntentionallyCleared
} from './storageGuard';
import { AppSettings, BodyWeightEntry, DailyWorkoutLog, ExerciseDefinition, SafetySnapshot } from '../types/models';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    }
  };
}

const sampleLogs: DailyWorkoutLog[] = [
  {
    date: '2026-11-10',
    swim: {
      crawlMeters: 1000,
      backstrokeMeters: 200,
      breaststrokeMeters: 100,
      butterflyMeters: 0,
      totalMeters: 1300,
      durationSeconds: 1800,
      poolLengthMeters: 25
    },
    strength: [
      {
        exerciseId: 'pullups',
        mode: 'sets',
        sets: [
          { reps: 10, weightKg: 0 },
          { reps: 8, weightKg: 5 }
        ]
      }
    ],
    feeling: 4,
    updatedAt: 1700000000000
  }
];

const sampleExercises: ExerciseDefinition[] = [
  {
    id: 'pullups',
    name: 'Dominadas',
    category: 'calisthenics',
    muscleGroup: 'Espalda',
    usesExternalWeight: true,
    difficultyFactor: 1.2,
    archived: false,
    order: 1
  }
];

const sampleBodyweight: BodyWeightEntry[] = [{ date: '2026-11-10', weightKg: 74.5 }];

const sampleSettings: AppSettings = {
  poolLengthDefault: 25,
  userName: 'Miguel',
  targetDaysWeekly: 4,
  targetSwimMetersWeekly: 4000
};

describe('storageGuard - Validación, checksums y espejo local', () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: ReturnType<typeof createMemoryStorage> }).localStorage =
      createMemoryStorage();
  });

  it('genera un payload verificado y valida ida y vuelta con checksumVerified=true', () => {
    const payload = buildVerifiedBackupPayload(sampleLogs, sampleExercises, sampleBodyweight, sampleSettings);
    expect(payload.checksum).toMatch(/^fnv-[0-9a-f]{16}$/);

    const result = validateAndNormalizeBackupJson(JSON.stringify(payload));
    expect(result.valid).toBe(true);
    expect(result.checksumVerified).toBe(true);
    expect(result.payload?.logs).toHaveLength(1);
    expect(result.payload?.logs[0].swim?.totalMeters).toBe(1300);
    expect(result.payload?.settings.userName).toBe('Miguel');
  });

  it('rechaza un archivo cuyo contenido fue manipulado respecto a su checksum', () => {
    const payload = buildVerifiedBackupPayload(sampleLogs, sampleExercises, sampleBodyweight, sampleSettings);
    payload.logs[0].swim!.crawlMeters = 9999;

    const result = validateAndNormalizeBackupJson(JSON.stringify(payload));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('checksum');
  });

  it('acepta copias v1 antiguas sin checksum y sanea fechas inválidas o valores negativos', () => {
    const legacyV1 = {
      version: 1,
      exportedAt: '2026-10-01T10:00:00.000Z',
      logs: [
        {
          date: 'fecha-mala',
          strength: []
        },
        {
          date: '2026-10-01',
          swim: {
            crawlMeters: -50,
            backstrokeMeters: 200,
            breaststrokeMeters: 0,
            butterflyMeters: 0,
            totalMeters: 100,
            durationSeconds: -20,
            poolLengthMeters: 25
          },
          strength: []
        }
      ]
    };

    const result = validateAndNormalizeBackupJson(JSON.stringify(legacyV1));
    expect(result.valid).toBe(true);
    expect(result.checksumVerified).toBe(false);
    expect(result.payload?.logs).toHaveLength(1);
    expect(result.payload?.logs[0].swim?.crawlMeters).toBe(0);
    expect(result.payload?.logs[0].swim?.totalMeters).toBe(200);
    expect(result.payload?.logs[0].swim?.durationSeconds).toBe(0);
  });

  it('rechaza JSON malformado o sin array logs', () => {
    expect(validateAndNormalizeBackupJson('{corrupt').valid).toBe(false);
    expect(validateAndNormalizeBackupJson('{"version":2}').valid).toBe(false);
    expect(validateAndNormalizeBackupJson('').valid).toBe(false);
  });

  it('calcula checksum determinista independiente del orden de entrada', () => {
    const c1 = computeIntegrityChecksum({
      version: 2,
      logs: sampleLogs,
      exercises: sampleExercises,
      bodyweight: sampleBodyweight,
      settings: sampleSettings
    });
    const c2 = computeIntegrityChecksum({
      version: 2,
      logs: [...sampleLogs],
      exercises: [...sampleExercises],
      bodyweight: [...sampleBodyweight],
      settings: { ...sampleSettings }
    });
    expect(c1).toBe(c2);
  });

  it('persiste espejo en localStorage, marca de borrado intencional y snapshots de emergencia', () => {
    const json = JSON.stringify(buildVerifiedBackupPayload(sampleLogs, sampleExercises, sampleBodyweight, sampleSettings));
    expect(saveShadowMirror(json)).toBe(true);
    expect(loadShadowMirror()).toBe(json);

    expect(wasIntentionallyCleared()).toBe(false);
    markIntentionalClear(true);
    expect(wasIntentionallyCleared()).toBe(true);
    markIntentionalClear(false);
    expect(wasIntentionallyCleared()).toBe(false);

    for (let i = 0; i < 7; i++) {
      const snap: SafetySnapshot = {
        id: `snap-${i}`,
        createdAt: 1700000000000 + i,
        label: `Snapshot ${i}`,
        logsCount: 1,
        bodyWeightsCount: 1,
        payloadJson: json
      };
      saveEmergencySnapshotLocal(snap);
    }
    const stored = loadEmergencySnapshotsLocal();
    expect(stored).toHaveLength(5);
    expect(stored[0].id).toBe('snap-6');
  });

  it('valida copias v3 con horario y asistencia y mantiene compatibilidad con checksums v2', () => {
    const v3Payload = buildVerifiedBackupPayload(
      sampleLogs,
      sampleExercises,
      sampleBodyweight,
      sampleSettings,
      [
        {
          id: 'ev_1',
          title: 'Natación',
          startTime: '19:00',
          endTime: '20:00',
          daysOfWeek: [0, 2, 4],
          category: 'swim',
          startDateKey: '2026-11-10',
          active: true,
          createdAt: 1700000000000
        },
        {
          id: 'ev_2',
          title: 'Armonía',
          startTime: '17:00',
          endTime: '18:00',
          daysOfWeek: [1, 3],
          category: 'conservatory',
          startDateKey: '2026-11-10',
          active: true,
          createdAt: 1700000000000
        },
        {
          id: 'ev_3',
          title: 'Cálculo II',
          startTime: '09:00',
          endTime: '11:00',
          daysOfWeek: [0, 2],
          category: 'university',
          transportBeforeMinutes: 25,
          transportAfterMinutes: 20,
          startDateKey: '2026-11-10',
          active: true,
          createdAt: 1700000000000
        }
      ],
      [{
        date: '2026-11-10',
        statuses: { ev_1: 'completed', ev_2: 'missed' },
        reasons: { ev_1: 'motivo huérfano ignorado', ev_2: '  Falta de tiempo  ' },
        updatedAt: 1700000000000
      }]
    );

    const v3Result = validateAndNormalizeBackupJson(JSON.stringify(v3Payload));
    expect(v3Result.valid).toBe(true);
    expect(v3Result.checksumVerified).toBe(true);
    expect(v3Result.payload?.scheduleEvents).toHaveLength(3);
    expect(v3Result.payload?.scheduleEvents?.find(e => e.id === 'ev_2')?.category).toBe('conservatory');
    expect(v3Result.payload?.scheduleEvents?.find(e => e.id === 'ev_3')?.category).toBe('university');
    expect(v3Result.payload?.scheduleEvents?.find(e => e.id === 'ev_3')?.transportBeforeMinutes).toBe(25);
    expect(v3Result.payload?.scheduleEvents?.find(e => e.id === 'ev_3')?.transportAfterMinutes).toBe(20);
    expect(v3Result.payload?.scheduleAttendance?.[0].statuses.ev_1).toBe('completed');
    expect(v3Result.payload?.scheduleAttendance?.[0].reasons?.ev_2).toBe('Falta de tiempo');
    expect(v3Result.payload?.scheduleAttendance?.[0].reasons?.ev_1).toBeUndefined();

    // Retrocompatibilidad v2 sin scheduleEvents/scheduleAttendance
    const v2Base = {
      version: 2,
      logs: sampleLogs,
      exercises: sampleExercises,
      bodyweight: sampleBodyweight,
      settings: sampleSettings
    };
    const v2Json = JSON.stringify({
      ...v2Base,
      exportedAt: '2026-11-13T10:00:00.000Z',
      checksum: computeIntegrityChecksum(v2Base)
    });
    const v2Result = validateAndNormalizeBackupJson(v2Json);
    expect(v2Result.valid).toBe(true);
    expect(v2Result.checksumVerified).toBe(true);
    expect(v2Result.payload?.scheduleEvents).toEqual([]);
  });
});
