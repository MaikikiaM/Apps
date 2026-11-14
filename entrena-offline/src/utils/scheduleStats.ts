// src/utils/scheduleStats.ts
// Lógica de horario semanal recurrente, checklist diario y cálculo de Accuracy (% de asistencia)

import { ScheduleCategory, ScheduleCheckStatus, ScheduleDayRecord, ScheduleEvent } from '../types/models';
import { addDaysToDateKey, getDateRangeSequence, getSpanishWeekdayIndex, toLocalDateKey } from './dates';

export const SPANISH_WEEKDAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
export const SPANISH_WEEKDAY_NAMES = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo'
] as const;

export const SCHEDULE_CATEGORY_META: Record<
  ScheduleCategory,
  { label: string; color: string; bg: string }
> = {
  university: { label: 'Universidad', color: '#818cf8', bg: 'rgba(99, 102, 241, 0.22)' },
  conservatory: { label: 'Conservatorio', color: '#f472b6', bg: 'rgba(236, 72, 153, 0.22)' },
  study: { label: 'Estudio / Academia', color: '#c084fc', bg: 'rgba(168, 85, 247, 0.20)' },
  languages: { label: 'Idiomas', color: '#2dd4bf', bg: 'rgba(20, 184, 166, 0.20)' },
  work: { label: 'Trabajo / Proyecto', color: '#60a5fa', bg: 'rgba(59, 130, 246, 0.20)' },
  swim: { label: 'Natación', color: '#22d3ee', bg: 'rgba(6, 182, 212, 0.18)' },
  strength: { label: 'Fuerza / Gym', color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.18)' },
  cardio: { label: 'Cardio / Running', color: '#fb7185', bg: 'rgba(244, 63, 94, 0.18)' },
  habit: { label: 'Hábito / Salud', color: '#34d399', bg: 'rgba(16, 185, 129, 0.18)' },
  leisure: { label: 'Ocio / Descanso', color: '#facc15', bg: 'rgba(234, 179, 8, 0.18)' },
  transport: { label: 'Transporte', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.16)' },
  other: { label: 'Otro', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.16)' }
};

export const VALID_SCHEDULE_CATEGORIES = Object.keys(SCHEDULE_CATEGORY_META) as ScheduleCategory[];

export const EVENT_SELECTABLE_CATEGORIES = VALID_SCHEDULE_CATEGORIES.filter(
  cat => cat !== 'transport'
);

export function minutesToHHMM(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatTransportSummary(ev: Pick<ScheduleEvent, 'transportBeforeMinutes' | 'transportAfterMinutes'>): string {
  const before = ev.transportBeforeMinutes && ev.transportBeforeMinutes > 0 ? ev.transportBeforeMinutes : 0;
  const after = ev.transportAfterMinutes && ev.transportAfterMinutes > 0 ? ev.transportAfterMinutes : 0;
  if (before > 0 && after > 0) return `Ida ${before}m · Vuelta ${after}m`;
  if (before > 0) return `Ida ${before}m`;
  if (after > 0) return `Vuelta ${after}m`;
  return '';
}

/** Ordena eventos de una misma jornada por hora (inicio -> fin -> título). */
export function sortScheduleEventsByTime(events: ScheduleEvent[]): ScheduleEvent[] {
  return [...events].sort((a, b) => {
    const startCmp = a.startTime.localeCompare(b.startTime);
    if (startCmp !== 0) return startCmp;
    const endCmp = a.endTime.localeCompare(b.endTime);
    if (endCmp !== 0) return endCmp;
    return a.title.localeCompare(b.title);
  });
}

/** Ordena eventos recurrentes por días de la semana (L-D) y después por intervalo horario. */
export function sortScheduleEvents(events: ScheduleEvent[]): ScheduleEvent[] {
  return [...events].sort((a, b) => {
    const aDays = [...(a.daysOfWeek || [])].sort((x, y) => x - y);
    const bDays = [...(b.daysOfWeek || [])].sort((x, y) => x - y);
    const aFirstDay = aDays.length > 0 ? aDays[0] : 99;
    const bFirstDay = bDays.length > 0 ? bDays[0] : 99;
    if (aFirstDay !== bFirstDay) return aFirstDay - bFirstDay;

    const startCmp = a.startTime.localeCompare(b.startTime);
    if (startCmp !== 0) return startCmp;
    const endCmp = a.endTime.localeCompare(b.endTime);
    if (endCmp !== 0) return endCmp;

    const minLen = Math.min(aDays.length, bDays.length);
    for (let i = 0; i < minLen; i++) {
      if (aDays[i] !== bDays[i]) return aDays[i] - bDays[i];
    }
    if (aDays.length !== bDays.length) return aDays.length - bDays.length;

    return a.title.localeCompare(b.title);
  });
}

export function getScheduledEventsForDate(
  events: ScheduleEvent[],
  dateKey: string,
  statusesOnDate?: Record<string, ScheduleCheckStatus>
): ScheduleEvent[] {
  const weekdayIdx = getSpanishWeekdayIndex(dateKey);
  const matching = events.filter(ev => {
    const hasExplicitStatus = Boolean(statusesOnDate && statusesOnDate[ev.id]);
    if (!ev.active && !hasExplicitStatus) return false;
    return ev.daysOfWeek.includes(weekdayIdx) || hasExplicitStatus;
  });
  return sortScheduleEventsByTime(matching);
}

export interface EventAccuracySummary {
  eventId: string;
  title: string;
  startTime: string;
  endTime: string;
  category: ScheduleCategory;
  active: boolean;
  completed: number;
  missed: number;
  unmarkedPast: number;
  pendingToday: number;
  expected: number;
  accuracyPercent: number | null;
}

export interface DailyAccuracyPoint {
  date: string;
  completed: number;
  expected: number;
  accuracyPercent: number;
}

export interface ScheduleAccuracyReport {
  expected: number;
  completed: number;
  missed: number;
  unmarkedPast: number;
  pendingToday: number;
  accuracyPercent: number | null;       // completed / expected * 100
  markedAccuracyPercent: number | null; // completed / (completed + missed) * 100
  currentDayStreak: number;
  bestDayStreak: number;
  perEvent: EventAccuracySummary[];
  dailySeries: DailyAccuracyPoint[];
}

export function computeScheduleAccuracy(
  events: ScheduleEvent[],
  attendanceRecords: ScheduleDayRecord[],
  options: {
    rangeDays?: number | null;
    todayKey?: string;
    filterEventId?: string | null;
  } = {}
): ScheduleAccuracyReport {
  const todayKey = options.todayKey || toLocalDateKey(new Date());
  const rangeDays = options.rangeDays === undefined ? 30 : options.rangeDays;
  const filterEventId = options.filterEventId || null;

  const trackableEvents = events.filter(ev => ev.category !== 'transport');
  const targetEvents = filterEventId
    ? trackableEvents.filter(ev => ev.id === filterEventId)
    : trackableEvents;

  if (targetEvents.length === 0) {
    return {
      expected: 0,
      completed: 0,
      missed: 0,
      unmarkedPast: 0,
      pendingToday: 0,
      accuracyPercent: null,
      markedAccuracyPercent: null,
      currentDayStreak: 0,
      bestDayStreak: 0,
      perEvent: [],
      dailySeries: []
    };
  }

  const attendanceMap = new Map<string, Record<string, ScheduleCheckStatus>>();
  let earliestRecordKey: string | null = null;
  for (const rec of attendanceRecords) {
    attendanceMap.set(rec.date, rec.statuses || {});
    if (rec.date <= todayKey && (!earliestRecordKey || rec.date < earliestRecordKey)) {
      earliestRecordKey = rec.date;
    }
  }

  let earliestEventStart: string | null = null;
  for (const ev of targetEvents) {
    if (!earliestEventStart || ev.startDateKey < earliestEventStart) {
      earliestEventStart = ev.startDateKey;
    }
  }

  let globalMinKey = todayKey;
  if (earliestEventStart && earliestEventStart < globalMinKey) globalMinKey = earliestEventStart;
  if (earliestRecordKey && earliestRecordKey < globalMinKey) globalMinKey = earliestRecordKey;

  const windowStartKey =
    rangeDays !== null && rangeDays > 0
      ? addDaysToDateKey(todayKey, -(rangeDays - 1))
      : globalMinKey;

  const effectiveStartKey = windowStartKey < globalMinKey ? globalMinKey : windowStartKey;
  const sequence = effectiveStartKey <= todayKey ? getDateRangeSequence(effectiveStartKey, todayKey) : [];

  const eventAccumulators = new Map<
    string,
    {
      event: ScheduleEvent;
      completed: number;
      missed: number;
      unmarkedPast: number;
      pendingToday: number;
      expected: number;
    }
  >();

  for (const ev of sortScheduleEvents(targetEvents)) {
    eventAccumulators.set(ev.id, {
      event: ev,
      completed: 0,
      missed: 0,
      unmarkedPast: 0,
      pendingToday: 0,
      expected: 0
    });
  }

  let totalExpected = 0;
  let totalCompleted = 0;
  let totalMissed = 0;
  let totalUnmarkedPast = 0;
  let totalPendingToday = 0;

  const dailySeries: DailyAccuracyPoint[] = [];

  for (const dateKey of sequence) {
    const weekday = getSpanishWeekdayIndex(dateKey);
    const dayStatuses = attendanceMap.get(dateKey) || {};
    const isToday = dateKey === todayKey;

    let dayExpected = 0;
    let dayCompleted = 0;

    for (const acc of eventAccumulators.values()) {
      const ev = acc.event;
      const status = dayStatuses[ev.id];
      const scheduledNormally = ev.active && ev.daysOfWeek.includes(weekday) && dateKey >= ev.startDateKey;

      if (!scheduledNormally && !status) {
        continue;
      }

      if (isToday && !status) {
        acc.pendingToday += 1;
        totalPendingToday += 1;
        continue;
      }

      acc.expected += 1;
      totalExpected += 1;
      dayExpected += 1;

      if (status === 'completed') {
        acc.completed += 1;
        totalCompleted += 1;
        dayCompleted += 1;
      } else if (status === 'missed') {
        acc.missed += 1;
        totalMissed += 1;
      } else {
        acc.unmarkedPast += 1;
        totalUnmarkedPast += 1;
      }
    }

    if (dayExpected > 0) {
      dailySeries.push({
        date: dateKey,
        completed: dayCompleted,
        expected: dayExpected,
        accuracyPercent: Math.round((dayCompleted / dayExpected) * 1000) / 10
      });
    }
  }

  // Rachas de cumplimiento perfecto (días activos consecutivos al 100%)
  let bestDayStreak = 0;
  let runningStreak = 0;
  for (const point of dailySeries) {
    if (point.completed === point.expected && point.expected > 0) {
      runningStreak += 1;
      if (runningStreak > bestDayStreak) bestDayStreak = runningStreak;
    } else {
      runningStreak = 0;
    }
  }

  let currentDayStreak = 0;
  for (let i = dailySeries.length - 1; i >= 0; i--) {
    const point = dailySeries[i];
    if (point.completed === point.expected && point.expected > 0) {
      currentDayStreak += 1;
    } else {
      break;
    }
  }

  const perEvent: EventAccuracySummary[] = Array.from(eventAccumulators.values()).map(acc => ({
    eventId: acc.event.id,
    title: acc.event.title,
    startTime: acc.event.startTime,
    endTime: acc.event.endTime,
    category: acc.event.category,
    active: acc.event.active,
    completed: acc.completed,
    missed: acc.missed,
    unmarkedPast: acc.unmarkedPast,
    pendingToday: acc.pendingToday,
    expected: acc.expected,
    accuracyPercent:
      acc.expected > 0 ? Math.round((acc.completed / acc.expected) * 1000) / 10 : null
  }));

  const accuracyPercent =
    totalExpected > 0 ? Math.round((totalCompleted / totalExpected) * 1000) / 10 : null;
  const markedTotal = totalCompleted + totalMissed;
  const markedAccuracyPercent =
    markedTotal > 0 ? Math.round((totalCompleted / markedTotal) * 1000) / 10 : null;

  return {
    expected: totalExpected,
    completed: totalCompleted,
    missed: totalMissed,
    unmarkedPast: totalUnmarkedPast,
    pendingToday: totalPendingToday,
    accuracyPercent,
    markedAccuracyPercent,
    currentDayStreak,
    bestDayStreak,
    perEvent,
    dailySeries
  };
}
