// src/db/useAppData.tsx
// Proveedor global de estado reactivo sincronizado con IndexedDB, auto-recuperación y respaldos durables

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  DailyWorkoutLog,
  ExerciseDefinition,
  BodyWeightEntry,
  AppSettings,
  SafetySnapshot,
  ScheduleCheckStatus,
  ScheduleDayRecord,
  ScheduleEvent,
  StorageHealthInfo
} from '../types/models';
import {
  getAllLogs,
  saveLog,
  deleteLog,
  getAllExercises,
  saveExercise,
  getAllBodyWeights,
  saveBodyWeight,
  deleteBodyWeight,
  getSettings,
  saveSettings,
  getAllScheduleEvents,
  saveScheduleEvent,
  deleteScheduleEvent,
  getAllScheduleAttendance,
  saveScheduleDayAttendance,
  seedDemoData,
  clearAllData,
  recoverDataIfNeeded,
  flushPendingDurableBackup,
  getAllSafetySnapshots,
  createSafetySnapshot,
  restoreSafetySnapshot,
  getStorageHealthInfo
} from './database';
import { toLocalDateKey } from '../utils/dates';

interface AppDataContextValue {
  selectedDateKey: string;
  setSelectedDateKey: (date: string) => void;
  logs: DailyWorkoutLog[];
  logsMap: Map<string, DailyWorkoutLog>;
  exercises: ExerciseDefinition[];
  bodyWeights: BodyWeightEntry[];
  settings: AppSettings;
  scheduleEvents: ScheduleEvent[];
  scheduleAttendance: ScheduleDayRecord[];
  attendanceMap: Map<string, Record<string, ScheduleCheckStatus>>;
  isLoading: boolean;
  externalReloadToken: number;
  activeLog: DailyWorkoutLog | null;
  recoveryNotice: string | null;
  dismissRecoveryNotice: () => void;
  storageHealth: StorageHealthInfo | null;
  safetySnapshots: SafetySnapshot[];
  saveCurrentLog: (log: DailyWorkoutLog) => Promise<void>;
  deleteCurrentLog: (date: string) => Promise<void>;
  saveExerciseDef: (ex: ExerciseDefinition) => Promise<void>;
  saveWeightRecord: (entry: BodyWeightEntry) => Promise<void>;
  deleteWeightRecord: (date: string) => Promise<void>;
  updateSettings: (newSettings: AppSettings) => Promise<void>;
  saveScheduleEventItem: (event: ScheduleEvent) => Promise<void>;
  deleteScheduleEventItem: (id: string) => Promise<void>;
  setScheduleEventCheck: (dateKey: string, eventId: string, status: ScheduleCheckStatus | null) => Promise<void>;
  setAllScheduleChecksForDate: (dateKey: string, eventIds: string[], status: ScheduleCheckStatus) => Promise<void>;
  loadDemoAndRefresh: () => Promise<void>;
  clearDataAndRefresh: () => Promise<void>;
  createManualSnapshot: (label?: string) => Promise<boolean>;
  restoreFromSnapshot: (snapshot: SafetySnapshot) => Promise<{ success: boolean; message: string }>;
  refreshData: (bumpExternalToken?: boolean) => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedDateKey, setSelectedDateKey] = useState<string>(toLocalDateKey(new Date()));
  const [logs, setLogs] = useState<DailyWorkoutLog[]>([]);
  const [exercises, setExercises] = useState<ExerciseDefinition[]>([]);
  const [bodyWeights, setBodyWeights] = useState<BodyWeightEntry[]>([]);
  const [scheduleEvents, setScheduleEvents] = useState<ScheduleEvent[]>([]);
  const [scheduleAttendance, setScheduleAttendance] = useState<ScheduleDayRecord[]>([]);
  const [settings, setSettingsState] = useState<AppSettings>({
    poolLengthDefault: 25,
    targetDaysWeekly: 4,
    targetSwimMetersWeekly: 2000,
    restTimerDefaultSeconds: 90
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [externalReloadToken, setExternalReloadToken] = useState<number>(0);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);
  const [storageHealth, setStorageHealth] = useState<StorageHealthInfo | null>(null);
  const [safetySnapshots, setSafetySnapshots] = useState<SafetySnapshot[]>([]);

  const refreshSafetyInfo = useCallback(async () => {
    try {
      const [health, snaps] = await Promise.all([
        getStorageHealthInfo(),
        getAllSafetySnapshots()
      ]);
      setStorageHealth(health);
      setSafetySnapshots(snaps);
    } catch {
      // ignorar
    }
  }, []);

  const refreshData = useCallback(async (bumpExternalToken = false) => {
    try {
      const [fetchedLogs, fetchedExercises, fetchedWeights, fetchedSettings, fetchedScheduleEvents, fetchedScheduleAttendance] = await Promise.all([
        getAllLogs(),
        getAllExercises(),
        getAllBodyWeights(),
        getSettings(),
        getAllScheduleEvents(),
        getAllScheduleAttendance()
      ]);
      setLogs(fetchedLogs);
      setExercises(fetchedExercises);
      setBodyWeights(fetchedWeights);
      setScheduleEvents(fetchedScheduleEvents);
      setScheduleAttendance(fetchedScheduleAttendance);
      setSettingsState({
        targetDaysWeekly: 4,
        targetSwimMetersWeekly: 2000,
        restTimerDefaultSeconds: 90,
        ...fetchedSettings
      });
      if (bumpExternalToken) {
        setExternalReloadToken(t => t + 1);
      }
      await refreshSafetyInfo();
    } catch (err) {
      console.error('Error cargando datos de IndexedDB:', err);
    } finally {
      setIsLoading(false);
    }
  }, [refreshSafetyInfo]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const report = await recoverDataIfNeeded();
      if (!mounted) return;
      if (report.recovered) {
        const origin = report.source === 'native' ? 'respaldo nativo del dispositivo' : 'copia espejo local';
        setRecoveryNotice(`Se recuperaron automáticamente ${report.logsRestored || 0} días desde el ${origin}.`);
      }
      await refreshData(true);
    })();

    const handleVisibilityOrHide = () => {
      if (document.visibilityState === 'hidden') {
        void flushPendingDurableBackup();
      }
    };
    const handlePageHide = () => {
      void flushPendingDurableBackup();
    };

    document.addEventListener('visibilitychange', handleVisibilityOrHide);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityOrHide);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [refreshData]);

  const logsMap = React.useMemo(() => {
    const map = new Map<string, DailyWorkoutLog>();
    for (const log of logs) {
      map.set(log.date, log);
    }
    return map;
  }, [logs]);

  const attendanceMap = React.useMemo(() => {
    const map = new Map<string, Record<string, ScheduleCheckStatus>>();
    for (const rec of scheduleAttendance) {
      map.set(rec.date, rec.statuses || {});
    }
    return map;
  }, [scheduleAttendance]);

  const activeLog = logsMap.get(selectedDateKey) || null;

  const saveCurrentLog = async (log: DailyWorkoutLog) => {
    await saveLog(log);
    await refreshData(false);
  };

  const deleteCurrentLog = async (date: string) => {
    await deleteLog(date);
    await refreshData(false);
  };

  const saveExerciseDef = async (ex: ExerciseDefinition) => {
    await saveExercise(ex);
    await refreshData(false);
  };

  const saveWeightRecord = async (entry: BodyWeightEntry) => {
    await saveBodyWeight(entry);
    await refreshData(false);
  };

  const deleteWeightRecord = async (date: string) => {
    await deleteBodyWeight(date);
    await refreshData(false);
  };

  const updateSettings = async (newSettings: AppSettings) => {
    await saveSettings(newSettings);
    setSettingsState(newSettings);
    await refreshSafetyInfo();
  };

  const saveScheduleEventItem = async (event: ScheduleEvent) => {
    await saveScheduleEvent(event);
    await refreshData(false);
  };

  const deleteScheduleEventItem = async (id: string) => {
    await deleteScheduleEvent(id);
    await refreshData(false);
  };

  const setScheduleEventCheck = async (
    dateKey: string,
    eventId: string,
    status: ScheduleCheckStatus | null
  ) => {
    const prevStatuses = { ...(attendanceMap.get(dateKey) || {}) };
    if (status === null) {
      delete prevStatuses[eventId];
    } else {
      prevStatuses[eventId] = status;
    }
    await saveScheduleDayAttendance({
      date: dateKey,
      statuses: prevStatuses,
      updatedAt: Date.now()
    });
    await refreshData(false);
  };

  const setAllScheduleChecksForDate = async (
    dateKey: string,
    eventIds: string[],
    status: ScheduleCheckStatus
  ) => {
    const nextStatuses = { ...(attendanceMap.get(dateKey) || {}) };
    for (const id of eventIds) {
      nextStatuses[id] = status;
    }
    await saveScheduleDayAttendance({
      date: dateKey,
      statuses: nextStatuses,
      updatedAt: Date.now()
    });
    await refreshData(false);
  };

  const loadDemoAndRefresh = async () => {
    setIsLoading(true);
    await seedDemoData();
    await refreshData(true);
  };

  const clearDataAndRefresh = async () => {
    setIsLoading(true);
    await clearAllData();
    await refreshData(true);
  };

  const createManualSnapshot = async (label = 'Punto manual'): Promise<boolean> => {
    const snap = await createSafetySnapshot(label, true);
    await flushPendingDurableBackup();
    await refreshSafetyInfo();
    return snap !== null;
  };

  const restoreFromSnapshot = async (snapshot: SafetySnapshot) => {
    const res = await restoreSafetySnapshot(snapshot);
    if (res.success) {
      await refreshData(true);
    }
    return res;
  };

  return (
    <AppDataContext.Provider
      value={{
        selectedDateKey,
        setSelectedDateKey,
        logs,
        logsMap,
        exercises,
        bodyWeights,
        settings,
        scheduleEvents,
        scheduleAttendance,
        attendanceMap,
        isLoading,
        externalReloadToken,
        activeLog,
        recoveryNotice,
        dismissRecoveryNotice: () => setRecoveryNotice(null),
        storageHealth,
        safetySnapshots,
        saveCurrentLog,
        deleteCurrentLog,
        saveExerciseDef,
        saveWeightRecord,
        deleteWeightRecord,
        updateSettings,
        saveScheduleEventItem,
        deleteScheduleEventItem,
        setScheduleEventCheck,
        setAllScheduleChecksForDate,
        loadDemoAndRefresh,
        clearDataAndRefresh,
        createManualSnapshot,
        restoreFromSnapshot,
        refreshData
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
};

export function useAppData(): AppDataContextValue {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData debe usarse dentro de un AppDataProvider');
  }
  return context;
}
