// src/utils/scheduleStats.test.ts
import { describe, expect, it } from 'vitest';
import {
  formatChartSpanishDate,
  formatSpanishDateShortYear,
  formatSpanishDateSlash,
  getSpanishWeekdayIndex
} from './dates';
import {
  computeScheduleAccuracy,
  getScheduledEventsForDate,
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

  it('ordena y filtra los eventos recurrentes por intervalo horario y día de la semana', () => {
    const events: ScheduleEvent[] = [
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
        daysOfWeek: [0],
        category: 'habit',
        startDateKey: '2026-11-09',
        active: false,
        createdAt: 100
      }
    ];

    const sorted = sortScheduleEvents(events);
    expect(sorted[0].id).toBe('paused');
    expect(sorted[1].id).toBe('early');
    expect(sorted[2].id).toBe('late');

    // 2026-11-09 es Lunes (weekday 0): early + late (paused ignorado salvo registro explícito)
    const mondayEvents = getScheduledEventsForDate(events, '2026-11-09');
    expect(mondayEvents.map(e => e.id)).toEqual(['early', 'late']);

    // 2026-11-10 es Martes (weekday 1): solo early
    const tuesdayEvents = getScheduledEventsForDate(events, '2026-11-10');
    expect(tuesdayEvents.map(e => e.id)).toEqual(['early']);
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
});
