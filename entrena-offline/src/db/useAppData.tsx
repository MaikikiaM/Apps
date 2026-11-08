// src/db/useAppData.tsx
// Proveedor global de estado reactivo sincronizado con IndexedDB

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  DailyWorkoutLog,
  ExerciseDefinition,
  BodyWeightEntry,
  AppSettings
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
  seedDemoData,
  clearAllData
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
  isLoading: boolean;
  activeLog: DailyWorkoutLog | null;
  saveCurrentLog: (log: DailyWorkoutLog) => Promise<void>;
  deleteCurrentLog: (date: string) => Promise<void>;
  saveExerciseDef: (ex: ExerciseDefinition) => Promise<void>;
  saveWeightRecord: (entry: BodyWeightEntry) => Promise<void>;
  deleteWeightRecord: (date: string) => Promise<void>;
  updateSettings: (newSettings: AppSettings) => Promise<void>;
  loadDemoAndRefresh: () => Promise<void>;
  clearDataAndRefresh: () => Promise<void>;
  refreshData: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedDateKey, setSelectedDateKey] = useState<string>(toLocalDateKey(new Date()));
  const [logs, setLogs] = useState<DailyWorkoutLog[]>([]);
  const [exercises, setExercises] = useState<ExerciseDefinition[]>([]);
  const [bodyWeights, setBodyWeights] = useState<BodyWeightEntry[]>([]);
  const [settings, setSettingsState] = useState<AppSettings>({ poolLengthDefault: 25 });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshData = useCallback(async () => {
    try {
      const [fetchedLogs, fetchedExercises, fetchedWeights, fetchedSettings] = await Promise.all([
        getAllLogs(),
        getAllExercises(),
        getAllBodyWeights(),
        getSettings()
      ]);
      setLogs(fetchedLogs);
      setExercises(fetchedExercises);
      setBodyWeights(fetchedWeights);
      setSettingsState(fetchedSettings);
    } catch (err) {
      console.error('Error cargando datos de IndexedDB:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const logsMap = React.useMemo(() => {
    const map = new Map<string, DailyWorkoutLog>();
    for (const log of logs) {
      map.set(log.date, log);
    }
    return map;
  }, [logs]);

  const activeLog = logsMap.get(selectedDateKey) || null;

  const saveCurrentLog = async (log: DailyWorkoutLog) => {
    await saveLog(log);
    await refreshData();
  };

  const deleteCurrentLog = async (date: string) => {
    await deleteLog(date);
    await refreshData();
  };

  const saveExerciseDef = async (ex: ExerciseDefinition) => {
    await saveExercise(ex);
    await refreshData();
  };

  const saveWeightRecord = async (entry: BodyWeightEntry) => {
    await saveBodyWeight(entry);
    await refreshData();
  };

  const deleteWeightRecord = async (date: string) => {
    await deleteBodyWeight(date);
    await refreshData();
  };

  const updateSettings = async (newSettings: AppSettings) => {
    await saveSettings(newSettings);
    setSettingsState(newSettings);
  };

  const loadDemoAndRefresh = async () => {
    setIsLoading(true);
    await seedDemoData();
    await refreshData();
  };

  const clearDataAndRefresh = async () => {
    setIsLoading(true);
    await clearAllData();
    await refreshData();
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
        isLoading,
        activeLog,
        saveCurrentLog,
        deleteCurrentLog,
        saveExerciseDef,
        saveWeightRecord,
        deleteWeightRecord,
        updateSettings,
        loadDemoAndRefresh,
        clearDataAndRefresh,
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
