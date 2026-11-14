// src/utils/scheduleStats.test.ts
import { describe, expect, it } from 'vitest';
import {
  formatChartSpanishDate,
  formatSpanishDateShortYear,
  formatSpanishDateSlash,
  getSpanishWeekdayIndex
} from './dates';
import {
  computeGroupedEventHours,
  computeScheduleAccuracy,
  formatHoursMinutesShort,
  formatTransportSummary,
  getEventDurationMinutes,
  getScheduledEventsForDate,
  minutesToHHMM,
  normalizeEventGroupKey,
  sortScheduleEvents
} from './scheduleStats';
import { ScheduleDayRecord, ScheduleEvent } from '../types/models';

describe('Fechas estilo español y Horario / Accuracy', () => {
  it('formatea fechas ISO locales en estilo español DD/MM, DD/MM/AA y DD/MM/AAAA', () => {
    expect(formatChartSpanishDate('2026-11-04')).toBe('04/11');
    expect(formatSpanishDateSlash('2026-11-04')).toBe('04/11/2026');
    expect(formatSpanishDateShortYear('2026-11-04')).toBe('04/11/26');
    // 2026-11-14 es Sábado -> índice 5 en semana española (0=Lun .. 6=Dom)
    expect(getSpanishWeekdayIndex('2026-11-14')).toBe(5);
  });

  it('ordena los eventos recurrentes por días (L-D) y entonces horas, manteniendo orden horario dentro de cada fecha', () => {
    const events: ScheduleEvent[] = [
      {
        id: 'tuesday_early',
        title: 'Pilates',
        startTime: '07:15',
        endTime: '08:00',
        daysOfWeek: [1], // Martes (M)
        category: 'habit',
        startDateKey: '2026-11-09',
        active: true,
        createdAt: 100
      },
      {
        id: 'late',
        title: 'Natación',
        startTime: '19:00',
        endTime: '20:00',
        daysOfWeek: [0, 2, 4], // L, X, V
        category: 'swim',
        startDateKey: '2026-11-09',
        active: true,
        createdAt: 100
      },
      {
        id: 'early',
        title: 'Inglés',
        startTime: '08:30',
        endTime: '09:30',
        daysOfWeek: [0, 1, 2, 3, 4], // L-V
        category: 'study',
        startDateKey: '2026-11-09',
        active: true,
        createdAt: 100
      },
      {
        id: 'paused',
        title: 'Pausado',
        startTime: '07:00',
        endTime: '07:30',
        daysOfWeek: [0], // Lunes
        category: 'habit',
        startDateKey: '2026-11-09',
        active: false,
        createdAt: 100
      }
    ];

    // Primero por día (L=0 antes que M=1) y dentro del mismo día por hora
    const sorted = sortScheduleEvents(events);
    expect(sorted.map(e => e.id)).toEqual(['paused', 'early', 'late', 'tuesday_early']);

    // 2026-11-09 es Lunes (weekday 0): early + late (paused ignorado salvo registro explícito)
    const mondayEvents = getScheduledEventsForDate(events, '2026-11-09');
    expect(mondayEvents.map(e => e.id)).toEqual(['early', 'late']);

    // 2026-11-10 es Martes (weekday 1): orden estricto del día por horas (07:15 antes que 08:30)
    const tuesdayEvents = getScheduledEventsForDate(events, '2026-11-10');
    expect(tuesdayEvents.map(e => e.id)).toEqual(['tuesday_early', 'early']);
  });

  it('calcula accuracy global, por evento, unmarkedPast y rachas sin penalizar eventos futuros de hoy sin marcar', () => {
    const events: ScheduleEvent[] = [
      {
        id: 'ev_swim',
        title: 'Natación',
        startTime: '19:00',
        endTime: '20:00',
        daysOfWeek: [0, 2, 4], // Lun(09), Mié(11), Vie(13)
        category: 'swim',
        startDateKey: '2026-11-09',
        active: true,
        createdAt: 100
      },
      {
        id: 'ev_read',
        title: 'Lectura',
        startTime: '22:00',
        endTime: '22:30',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // Todos del 09 al 14
        category: 'habit',
        startDateKey: '2026-11-09',
        active: true,
        createdAt: 100
      }
    ];

    // Simulamos hoy = Sábado 2026-11-14
    // ev_swim esperados pasados: Lun 09, Mié 11, Vie 13 => 3
    // ev_read esperados pasados: 09, 10, 11, 12, 13 => 5 (hoy 14 sin marcar no penaliza)
    const attendance: ScheduleDayRecord[] = [
      { date: '2026-11-09', statuses: { ev_swim: 'completed', ev_read: 'completed' }, updatedAt: 1 },
      { date: '2026-11-10', statuses: { ev_read: 'completed' }, updatedAt: 2 },
      { date: '2026-11-11', statuses: { ev_swim: 'missed', ev_read: 'completed' }, updatedAt: 3 },
      { date: '2026-11-12', statuses: { ev_read: 'completed' }, updatedAt: 4 },
      { date: '2026-11-13', statuses: { ev_swim: 'completed' }, updatedAt: 5 } // ev_read sin marcar ayer
    ];

    const report = computeScheduleAccuracy(events, attendance, {
      rangeDays: 30,
      todayKey: '2026-11-14'
    });

    // Esperados = 8 (3 swim + 5 read), Cumplidos = 6 (2 swim + 4 read), Missed = 1, UnmarkedPast = 1, PendingToday = 1
    expect(report.expected).toBe(8);
    expect(report.completed).toBe(6);
    expect(report.missed).toBe(1);
    expect(report.unmarkedPast).toBe(1);
    expect(report.pendingToday).toBe(1);
    expect(report.accuracyPercent).toBe(75);
    expect(report.markedAccuracyPercent).toBe(85.7); // 6/7
    expect(report.bestDayStreak).toBe(2); // Lun 09 y Mar 10 al 100%
    expect(report.currentDayStreak).toBe(0); // Vie 13 no al 100%

    const swimItem = report.perEvent.find(e => e.eventId === 'ev_swim');
    expect(swimItem?.completed).toBe(2);
    expect(swimItem?.expected).toBe(3);
    expect(swimItem?.accuracyPercent).toBe(66.7);
  });

  it('formatea bloques de transporte ida/vuelta y los excluye del cálculo de accuracy', () => {
    expect(minutesToHHMM(16 * 60 + 30)).toBe('16:30');
    expect(minutesToHHMM(-15)).toBe('00:00');
    expect(minutesToHHMM(25 * 60)).toBe('23:59');

    const baseEvent: ScheduleEvent = {
      id: 'ev_uni',
      title: 'Álgebra Lineal',
      startTime: '09:00',
      endTime: '11:00',
      daysOfWeek: [0, 2, 4],
      category: 'university',
      transportBeforeMinutes: 30,
      transportAfterMinutes: 20,
      startDateKey: '2026-11-09',
      active: true,
      createdAt: 1
    };

    expect(formatTransportSummary(baseEvent)).toBe('Ida 30m · Vuelta 20m');
    expect(formatTransportSummary({ ...baseEvent, transportBeforeMinutes: 0, transportAfterMinutes: 15 })).toBe(
      'Vuelta 15m'
    );
    expect(formatTransportSummary({ ...baseEvent, transportBeforeMinutes: 25, transportAfterMinutes: 0 })).toBe(
      'Ida 25m'
    );
    expect(formatTransportSummary({ ...baseEvent, transportBeforeMinutes: 0, transportAfterMinutes: 0 })).toBe('');

    // Incluso si existiera un evento heredado con categoría 'transport', nunca debe computar accuracy
    const legacyTransportEvent: ScheduleEvent = {
      id: 'ev_tr',
      title: 'Bus campus',
      startTime: '08:30',
      endTime: '09:00',
      daysOfWeek: [0, 1, 2, 3, 4],
      category: 'transport',
      startDateKey: '2026-11-09',
      active: true,
      createdAt: 2
    };

    const attendance: ScheduleDayRecord[] = [
      { date: '2026-11-09', statuses: { ev_uni: 'completed', ev_tr: 'missed' }, updatedAt: 1 },
      { date: '2026-11-11', statuses: { ev_uni: 'completed' }, updatedAt: 2 },
      { date: '2026-11-13', statuses: { ev_uni: 'missed' }, updatedAt: 3 }
    ];

    const report = computeScheduleAccuracy([baseEvent, legacyTransportEvent], attendance, {
      rangeDays: 30,
      todayKey: '2026-11-14'
    });

    // Solo computan los 3 días de ev_uni (L, X, V); ni transportBefore/After ni ev_tr afectan
    expect(report.expected).toBe(3);
    expect(report.completed).toBe(2);
    expect(report.missed).toBe(1);
    expect(report.accuracyPercent).toBe(66.7);
    expect(report.perEvent).toHaveLength(1);
    expect(report.perEvent[0].eventId).toBe('ev_uni');
  });

  it('conecta eventos con el mismo nombre normalizado y acumula horas semanal, mensual, anual e histórica', () => {
    expect(normalizeEventGroupKey('  Cálculo   II ')).toBe('calculo ii');
    expect(normalizeEventGroupKey('calculo ii')).toBe('calculo ii');
    expect(formatHoursMinutesShort(0)).toBe('0h');
    expect(formatHoursMinutesShort(45)).toBe('45m');
    expect(formatHoursMinutesShort(120)).toBe('2h');
    expect(formatHoursMinutesShort(90)).toBe('1h 30m');

    const evCalcMon: ScheduleEvent = {
      id: 'ev_calc_l',
      title: 'calculo ii',
      startTime: '09:00',
      endTime: '11:00', // 120m
      daysOfWeek: [0], // L
      category: 'university',
      startDateKey: '2025-10-01',
      active: true,
      createdAt: 1
    };
    const evCalcWed: ScheduleEvent = {
      id: 'ev_calc_x',
      title: 'Cálculo II',
      startTime: '12:00',
      endTime: '13:30', // 90m
      daysOfWeek: [2], // X
      category: 'university',
      startDateKey: '2025-10-01',
      active: true,
      createdAt: 2
    };
    const evSwim: ScheduleEvent = {
      id: 'ev_swim',
      title: 'Natación',
      startTime: '19:00',
      endTime: '19:45', // 45m
      daysOfWeek: [4], // V
      category: 'swim',
      startDateKey: '2026-11-01',
      active: true,
      createdAt: 3
    };

    expect(getEventDurationMinutes(evCalcMon)).toBe(120);
    expect(getEventDurationMinutes(evCalcWed)).toBe(90);

    // Hoy = Domingo 2026-11-15 -> semana actual L 2026-11-09 .. D 2026-11-15
    const attendance: ScheduleDayRecord[] = [
      // Año pasado (2025-12-10): solo cuenta en histórico (+120m)
      { date: '2025-12-10', statuses: { ev_calc_l: 'completed' }, updatedAt: 1 },
      // Este año, otro mes (2026-05-06): cuenta en año e histórico (+90m)
      { date: '2026-05-06', statuses: { ev_calc_x: 'completed' }, updatedAt: 2 },
      // Este mes, semana anterior (2026-11-04): cuenta en mes, año e histórico (+120m)
      { date: '2026-11-04', statuses: { ev_calc_l: 'completed' }, updatedAt: 3 },
      // Esta semana (2026-11-09 L y 2026-11-11 X): +120m +90m en los 4 periodos; missed no suma horas
      { date: '2026-11-09', statuses: { ev_calc_l: 'completed' }, updatedAt: 4 },
      { date: '2026-11-11', statuses: { ev_calc_x: 'completed' }, updatedAt: 5 },
      { date: '2026-11-13', statuses: { ev_swim: 'completed', ev_calc_l: 'missed' }, updatedAt: 6 }
    ];

    const grouped = computeGroupedEventHours([evCalcMon, evCalcWed, evSwim], attendance, '2026-11-15');
    expect(grouped.groups).toHaveLength(2);
    expect(grouped.totals.connectedActivitiesCount).toBe(1);

    const calcGroup = grouped.groups.find(g => g.groupKey === 'calculo ii');
    expect(calcGroup).toBeDefined();
    expect(calcGroup?.displayTitle).toBe('Cálculo II'); // prefirió variante acentuada
    expect(calcGroup?.slotsCount).toBe(2);
    expect(calcGroup?.plannedMinutesPerWeek).toBe(210); // 120 + 90
    expect(calcGroup?.weeklyMinutes).toBe(210);         // 120 + 90
    expect(calcGroup?.weeklySessions).toBe(2);
    expect(calcGroup?.monthlyMinutes).toBe(330);        // 210 + 120
    expect(calcGroup?.monthlySessions).toBe(3);
    expect(calcGroup?.yearlyMinutes).toBe(420);         // 330 + 90
    expect(calcGroup?.yearlySessions).toBe(4);
    expect(calcGroup?.historicalMinutes).toBe(540);     // 420 + 120
    expect(calcGroup?.historicalSessions).toBe(5);

    expect(grouped.totals.weeklyMinutes).toBe(255);     // 210 + 45 swim
    expect(grouped.totals.historicalMinutes).toBe(585); // 540 + 45 swim

    // Verificar filtro combinado de accuracy por array de IDs del grupo
    const groupAcc = computeScheduleAccuracy([evCalcMon, evCalcWed, evSwim], attendance, {
      rangeDays: 14,
      todayKey: '2026-11-15',
      filterEventIds: calcGroup?.eventIds
    });
    expect(groupAcc.perEvent).toHaveLength(2);
    expect(groupAcc.completed).toBe(3); // 04/11, 09/11, 11/11
  });
});
