// src/utils/scheduleStats.ts
// Lógica de horario semanal recurrente, checklist diario y cálculo de Accuracy (% de asistencia)

import { ScheduleCategory, ScheduleCheckStatus, ScheduleDayRecord, ScheduleEvent } from '../types/models';
import {
  addDaysToDateKey,
  getDateRangeSequence,
  getSpanishWeekdayIndex,
  getWeekDateKeys,
  toLocalDateKey
} from './dates';

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

/** Normaliza el nombre de un evento para agrupar variantes con distinto intervalo horario. */
export function normalizeEventGroupKey(title: string): string {
  return title
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const REASON_STOPWORDS = new Set([
  'a', 'al', 'algo', 'ante', 'bajo', 'con', 'contra', 'cual', 'cuando', 'de', 'del', 'desde',
  'donde', 'durante', 'e', 'el', 'ella', 'ellas', 'ellos', 'en', 'entre', 'era', 'es', 'esa',
  'ese', 'eso', 'esta', 'este', 'esto', 'estoy', 'fue', 'fui', 'ha', 'hacia', 'hasta', 'hay',
  'hoy', 'la', 'las', 'le', 'les', 'lo', 'los', 'mas', 'me', 'mi', 'mis', 'mucho', 'muy',
  'nada', 'ni', 'no', 'nos', 'o', 'otra', 'otro', 'para', 'pero', 'poco', 'por', 'porque',
  'que', 'quien', 'se', 'sin', 'sobre', 'solo', 'su', 'sus', 'te', 'tenia', 'todo', 'tu',
  'tus', 'un', 'una', 'uno', 'unos', 'unas', 'y', 'ya'
]);

/** Normaliza una razón de incumplimiento ignorando mayúsculas, tildes y espacios múltiples. */
export function normalizeReasonGroupKey(reason: string): string {
  return normalizeEventGroupKey(reason);
}

/** Extrae palabras clave normalizadas (>= 3 letras y sin conectores) de una razón de incumplimiento. */
export function extractReasonKeywords(reason: string): string[] {
  const norm = normalizeReasonGroupKey(reason);
  if (!norm) return [];
  const rawTokens = norm.split(/[^a-z0-9]+/).filter(Boolean);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const token of rawTokens) {
    if (token.length < 3) continue;
    if (/^\d+$/.test(token)) continue;
    if (REASON_STOPWORDS.has(token)) continue;
    if (!seen.has(token)) {
      seen.add(token);
      result.push(token);
    }
  }
  return result;
}

/** Duración del bloque horario en minutos (sin contar desplazamiento). */
export function getEventDurationMinutes(ev: Pick<ScheduleEvent, 'startTime' | 'endTime'>): number {
  const [sh, sm] = ev.startTime.split(':').map(n => parseInt(n, 10));
  const [eh, em] = ev.endTime.split(':').map(n => parseInt(n, 10));
  if ([sh, sm, eh, em].some(Number.isNaN)) return 0;
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

/** Formatea una cantidad de minutos como duración compacta en español (p. ej. "2h 30m", "45m", "12h"). */
export function formatHoursMinutesShort(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  if (safe === 0) return '0h';
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

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

export interface CategoryAccuracySummary {
  category: ScheduleCategory;
  eventsCount: number;
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
  perCategory: CategoryAccuracySummary[];
  dailySeries: DailyAccuracyPoint[];
}

export interface ScheduleQueryOptions {
  rangeDays?: number | null;
  todayKey?: string;
  filterEventId?: string | null;
  filterEventIds?: string[] | null;
}

export function computeScheduleAccuracy(
  events: ScheduleEvent[],
  attendanceRecords: ScheduleDayRecord[],
  options: ScheduleQueryOptions = {}
): ScheduleAccuracyReport {
  const todayKey = options.todayKey || toLocalDateKey(new Date());
  const rangeDays = options.rangeDays === undefined ? 30 : options.rangeDays;
  const filterEventId = options.filterEventId || null;
  const filterEventIds =
    options.filterEventIds && options.filterEventIds.length > 0 ? options.filterEventIds : null;

  const trackableEvents = events.filter(ev => ev.category !== 'transport');
  const targetEvents = filterEventIds
    ? trackableEvents.filter(ev => filterEventIds.includes(ev.id))
    : filterEventId
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
      perCategory: [],
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

  const categoryAccMap = new Map<
    ScheduleCategory,
    {
      eventsCount: number;
      completed: number;
      missed: number;
      unmarkedPast: number;
      pendingToday: number;
      expected: number;
    }
  >();
  for (const item of perEvent) {
    const prev = categoryAccMap.get(item.category) || {
      eventsCount: 0,
      completed: 0,
      missed: 0,
      unmarkedPast: 0,
      pendingToday: 0,
      expected: 0
    };
    prev.eventsCount += 1;
    prev.completed += item.completed;
    prev.missed += item.missed;
    prev.unmarkedPast += item.unmarkedPast;
    prev.pendingToday += item.pendingToday;
    prev.expected += item.expected;
    categoryAccMap.set(item.category, prev);
  }

  const perCategory: CategoryAccuracySummary[] = VALID_SCHEDULE_CATEGORIES
    .filter(cat => cat !== 'transport' && categoryAccMap.has(cat))
    .map(cat => {
      const stats = categoryAccMap.get(cat)!;
      return {
        category: cat,
        eventsCount: stats.eventsCount,
        completed: stats.completed,
        missed: stats.missed,
        unmarkedPast: stats.unmarkedPast,
        pendingToday: stats.pendingToday,
        expected: stats.expected,
        accuracyPercent:
          stats.expected > 0 ? Math.round((stats.completed / stats.expected) * 1000) / 10 : null
      };
    });

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
    perCategory,
    dailySeries
  };
}

export interface GroupedEventSlotInfo {
  id: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  durationMinutes: number;
  active: boolean;
}

export interface GroupedEventHoursSummary {
  groupKey: string;
  displayTitle: string;
  category: ScheduleCategory;
  eventIds: string[];
  slotsCount: number;
  slots: GroupedEventSlotInfo[];
  plannedMinutesPerWeek: number;
  weeklyMinutes: number;
  weeklySessions: number;
  monthlyMinutes: number;
  monthlySessions: number;
  yearlyMinutes: number;
  yearlySessions: number;
  historicalMinutes: number;
  historicalSessions: number;
}

export interface GroupedEventHoursReport {
  groups: GroupedEventHoursSummary[];
  totals: {
    weeklyMinutes: number;
    monthlyMinutes: number;
    yearlyMinutes: number;
    historicalMinutes: number;
    connectedActivitiesCount: number;
  };
}

/**
 * Agrupa eventos por nombre normalizado (insensible a mayúsculas/tildes/espacios)
 * y suma las horas realizadas de forma semanal (semana actual L-D), mensual, anual e histórica.
 */
export function computeGroupedEventHours(
  events: ScheduleEvent[],
  attendanceRecords: ScheduleDayRecord[],
  todayKeyInput?: string
): GroupedEventHoursReport {
  const todayKey = todayKeyInput || toLocalDateKey(new Date());
  const weekKeys = getWeekDateKeys(todayKey);
  const weekStartKey = weekKeys[0];
  const weekEndKey = weekKeys[6];
  const monthPrefix = todayKey.slice(0, 7); // 'YYYY-MM'
  const yearPrefix = todayKey.slice(0, 4);  // 'YYYY'

  const trackableEvents = sortScheduleEvents(events.filter(ev => ev.category !== 'transport'));
  const groupsMap = new Map<string, GroupedEventHoursSummary>();
  const eventLookup = new Map<string, { durationMinutes: number; group: GroupedEventHoursSummary }>();

  for (const ev of trackableEvents) {
    const cleanTitle = ev.title.trim().replace(/\s+/g, ' ');
    const key = normalizeEventGroupKey(cleanTitle) || ev.id;
    const durationMinutes = getEventDurationMinutes(ev);

    let group = groupsMap.get(key);
    if (!group) {
      group = {
        groupKey: key,
        displayTitle: cleanTitle || ev.title,
        category: ev.category,
        eventIds: [],
        slotsCount: 0,
        slots: [],
        plannedMinutesPerWeek: 0,
        weeklyMinutes: 0,
        weeklySessions: 0,
        monthlyMinutes: 0,
        monthlySessions: 0,
        yearlyMinutes: 0,
        yearlySessions: 0,
        historicalMinutes: 0,
        historicalSessions: 0
      };
      groupsMap.set(key, group);
    } else if (/[^\u0000-\u007f]/.test(cleanTitle) && !/[^\u0000-\u007f]/.test(group.displayTitle)) {
      // Preferir variante con tildes/eñe si existe
      group.displayTitle = cleanTitle;
    }

    const sortedDays = [...(ev.daysOfWeek || [])].sort((a, b) => a - b);
    group.eventIds.push(ev.id);
    group.slotsCount += 1;
    group.slots.push({
      id: ev.id,
      daysOfWeek: sortedDays,
      startTime: ev.startTime,
      endTime: ev.endTime,
      durationMinutes,
      active: ev.active
    });
    if (ev.active) {
      group.plannedMinutesPerWeek += durationMinutes * sortedDays.length;
    }

    eventLookup.set(ev.id, { durationMinutes, group });
  }

  for (const rec of attendanceRecords) {
    if (!rec.date || rec.date > todayKey) continue;
    const statuses = rec.statuses || {};
    const inWeek = rec.date >= weekStartKey && rec.date <= weekEndKey;
    const inMonth = rec.date.slice(0, 7) === monthPrefix;
    const inYear = rec.date.slice(0, 4) === yearPrefix;

    for (const [eventId, status] of Object.entries(statuses)) {
      if (status !== 'completed') continue;
      const entry = eventLookup.get(eventId);
      if (!entry) continue;

      const { durationMinutes, group } = entry;
      group.historicalSessions += 1;
      group.historicalMinutes += durationMinutes;

      if (inYear) {
        group.yearlySessions += 1;
        group.yearlyMinutes += durationMinutes;
      }
      if (inMonth) {
        group.monthlySessions += 1;
        group.monthlyMinutes += durationMinutes;
      }
      if (inWeek) {
        group.weeklySessions += 1;
        group.weeklyMinutes += durationMinutes;
      }
    }
  }

  const groups = Array.from(groupsMap.values());
  const totals = {
    weeklyMinutes: 0,
    monthlyMinutes: 0,
    yearlyMinutes: 0,
    historicalMinutes: 0,
    connectedActivitiesCount: 0
  };

  for (const g of groups) {
    totals.weeklyMinutes += g.weeklyMinutes;
    totals.monthlyMinutes += g.monthlyMinutes;
    totals.yearlyMinutes += g.yearlyMinutes;
    totals.historicalMinutes += g.historicalMinutes;
    if (g.slotsCount > 1) totals.connectedActivitiesCount += 1;
  }

  return { groups, totals };
}

export interface MissedReasonEntry {
  dateKey: string;
  eventId: string;
  eventTitle: string;
  category: ScheduleCategory;
  startTime: string;
  endTime: string;
  reason: string;
  groupKey: string;
  keywords: string[];
}

export interface MissedReasonGroup {
  groupKey: string;
  displayLabel: string;
  count: number;
  percentage: number;
  variants: string[];
  entries: MissedReasonEntry[];
}

export interface MissedReasonKeyword {
  keyword: string;
  displayWord: string;
  count: number;
}

export interface MissedReasonsReport {
  totalMissed: number;
  missedWithReason: number;
  missedWithoutReason: number;
  groups: MissedReasonGroup[];
  keywordCounts: MissedReasonKeyword[];
  entries: MissedReasonEntry[];
}

/**
 * Recopila y clasifica los motivos de incumplimiento ('missed') agrupando por texto
 * normalizado equivalente (igual que los eventos) y por palabras clave compartidas.
 */
export function computeMissedReasonsReport(
  events: ScheduleEvent[],
  attendanceRecords: ScheduleDayRecord[],
  options: ScheduleQueryOptions = {}
): MissedReasonsReport {
  const todayKey = options.todayKey || toLocalDateKey(new Date());
  const rangeDays = options.rangeDays === undefined ? null : options.rangeDays;
  const filterEventId = options.filterEventId || null;
  const filterEventIdSet =
    options.filterEventIds && options.filterEventIds.length > 0
      ? new Set(options.filterEventIds)
      : null;

  const trackableEvents = events.filter(ev => {
    if (ev.category === 'transport') return false;
    if (filterEventId && ev.id !== filterEventId) return false;
    if (filterEventIdSet && !filterEventIdSet.has(ev.id)) return false;
    return true;
  });
  const eventMap = new Map<string, ScheduleEvent>();
  for (const ev of trackableEvents) {
    eventMap.set(ev.id, ev);
  }

  const windowStartKey =
    rangeDays !== null && rangeDays > 0
      ? addDaysToDateKey(todayKey, -(rangeDays - 1))
      : null;

  let totalMissed = 0;
  let missedWithReason = 0;
  const entries: MissedReasonEntry[] = [];
  const groupsMap = new Map<
    string,
    {
      groupKey: string;
      displayLabel: string;
      variantsSet: Set<string>;
      entries: MissedReasonEntry[];
    }
  >();
  const keywordsMap = new Map<string, { displayWord: string; count: number }>();

  for (const rec of attendanceRecords) {
    if (!rec.date || rec.date > todayKey) continue;
    if (windowStartKey && rec.date < windowStartKey) continue;

    const statuses = rec.statuses || {};
    const reasons = rec.reasons || {};

    for (const [eventId, status] of Object.entries(statuses)) {
      if (status !== 'missed') continue;
      const ev = eventMap.get(eventId);
      if (!ev) continue;

      totalMissed += 1;
      const rawReason = typeof reasons[eventId] === 'string' ? reasons[eventId].trim().replace(/\s+/g, ' ') : '';
      const groupKey = normalizeReasonGroupKey(rawReason);
      if (!groupKey) continue;

      missedWithReason += 1;
      const keywords = extractReasonKeywords(rawReason);
      const entry: MissedReasonEntry = {
        dateKey: rec.date,
        eventId: ev.id,
        eventTitle: ev.title,
        category: ev.category,
        startTime: ev.startTime,
        endTime: ev.endTime,
        reason: rawReason,
        groupKey,
        keywords
      };
      entries.push(entry);

      let grp = groupsMap.get(groupKey);
      if (!grp) {
        grp = {
          groupKey,
          displayLabel: rawReason,
          variantsSet: new Set([rawReason]),
          entries: [entry]
        };
        groupsMap.set(groupKey, grp);
      } else {
        grp.variantsSet.add(rawReason);
        grp.entries.push(entry);
        // Preferir variante con mayúscula inicial o tildes para mostrar como etiqueta principal
        if (/[^\u0000-\u007f]/.test(rawReason) && !/[^\u0000-\u007f]/.test(grp.displayLabel)) {
          grp.displayLabel = rawReason;
        }
      }

      // Contar palabras clave originales preservando alguna variante legible
      const rawWordTokens = rawReason.split(/[^A-Za-zÀ-ÿ0-9]+/).filter(Boolean);
      const rawByNorm = new Map<string, string>();
      for (const rw of rawWordTokens) {
        const nk = normalizeReasonGroupKey(rw);
        if (nk && !rawByNorm.has(nk)) rawByNorm.set(nk, rw.toLocaleLowerCase('es'));
      }

      for (const kw of keywords) {
        const candidateWord = rawByNorm.get(kw) || kw;
        const prev = keywordsMap.get(kw);
        if (!prev) {
          keywordsMap.set(kw, { displayWord: candidateWord, count: 1 });
        } else {
          prev.count += 1;
          if (/[^\u0000-\u007f]/.test(candidateWord) && !/[^\u0000-\u007f]/.test(prev.displayWord)) {
            prev.displayWord = candidateWord;
          }
        }
      }
    }
  }

  entries.sort((a, b) => b.dateKey.localeCompare(a.dateKey) || a.startTime.localeCompare(b.startTime));

  const groups: MissedReasonGroup[] = Array.from(groupsMap.values())
    .map(g => {
      const sortedEntries = [...g.entries].sort(
        (a, b) => b.dateKey.localeCompare(a.dateKey) || a.startTime.localeCompare(b.startTime)
      );
      return {
        groupKey: g.groupKey,
        displayLabel: g.displayLabel,
        count: g.entries.length,
        percentage: missedWithReason > 0 ? Math.round((g.entries.length / missedWithReason) * 100) : 0,
        variants: Array.from(g.variantsSet),
        entries: sortedEntries
      };
    })
    .sort((a, b) => b.count - a.count || a.displayLabel.localeCompare(b.displayLabel));

  const keywordCounts: MissedReasonKeyword[] = Array.from(keywordsMap.entries())
    .map(([keyword, data]) => ({
      keyword,
      displayWord: data.displayWord,
      count: data.count
    }))
    .sort((a, b) => b.count - a.count || a.displayWord.localeCompare(b.displayWord));

  return {
    totalMissed,
    missedWithReason,
    missedWithoutReason: Math.max(0, totalMissed - missedWithReason),
    groups,
    keywordCounts,
    entries
  };
}
