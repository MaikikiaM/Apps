// src/components/schedule/ScheduleView.tsx
// Horario recurrente semanal, checklist diario de cumplimiento y estadísticas de Accuracy (% de asistencia)

import React, { useMemo, useState } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Edit2,
  Trash2,
  PauseCircle,
  PlayCircle,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Target,
  Flame,
  CheckCheck,
  Link2
} from 'lucide-react';
import { ChartConfiguration } from 'chart.js';
import { useAppData } from '../../db/useAppData';
import { ChartCanvas } from '../common/ChartCanvas';
import { WeeklyCalendarGrid } from './WeeklyCalendarGrid';
import { ScheduleCategory, ScheduleEvent } from '../../types/models';
import {
  addDaysToDateKey,
  formatChartSpanishDate,
  formatFriendlyDate,
  formatSpanishDateSlash,
  getWeekDateKeys,
  toLocalDateKey
} from '../../utils/dates';
import {
  computeGroupedEventHours,
  computeScheduleAccuracy,
  EVENT_SELECTABLE_CATEGORIES,
  formatHoursMinutesShort,
  formatTransportSummary,
  getScheduledEventsForDate,
  normalizeEventGroupKey,
  SCHEDULE_CATEGORY_META,
  SPANISH_WEEKDAY_SHORT,
  sortScheduleEvents
} from '../../utils/scheduleStats';

type ScheduleSubTab = 'daily' | 'weekly' | 'accuracy' | 'manage';
type AccuracyRange = 7 | 30 | 90 | null;

const ACCURACY_RANGES: { label: string; value: AccuracyRange }[] = [
  { label: '7 días', value: 7 },
  { label: '30 días', value: 30 },
  { label: '90 días', value: 90 },
  { label: 'Todo', value: null }
];

function getAccuracyColor(pct: number | null): string {
  if (pct === null) return '#94a3b8';
  if (pct >= 80) return '#34d399';
  if (pct >= 60) return '#fbbf24';
  return '#fb7185';
}

export const ScheduleView: React.FC = () => {
  const {
    selectedDateKey,
    setSelectedDateKey,
    scheduleEvents,
    scheduleAttendance,
    attendanceMap,
    saveScheduleEventItem,
    deleteScheduleEventItem,
    setScheduleEventCheck,
    setAllScheduleChecksForDate
  } = useAppData();

  const [subTab, setSubTab] = useState<ScheduleSubTab>('daily');
  const [rangeDays, setRangeDays] = useState<AccuracyRange>(30);
  const [filterEventId, setFilterEventId] = useState<string>('all');

  // Estado formulario crear / editar evento recurrente
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formStartTime, setFormStartTime] = useState<string>('18:00');
  const [formEndTime, setFormEndTime] = useState<string>('19:00');
  const [formDays, setFormDays] = useState<number[]>([0, 2, 4]);
  const [formCategory, setFormCategory] = useState<ScheduleCategory>('swim');
  const [formStartDateKey, setFormStartDateKey] = useState<string>(toLocalDateKey(new Date()));
  const [formTransportBefore, setFormTransportBefore] = useState<number>(0);
  const [formTransportAfter, setFormTransportAfter] = useState<number>(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const dateInputRef = React.useRef<HTMLInputElement>(null);

  const todayKey = toLocalDateKey(new Date());
  const isToday = selectedDateKey === todayKey;
  const weekKeys = useMemo(() => getWeekDateKeys(selectedDateKey), [selectedDateKey]);

  const sortedScheduleEvents = useMemo(
    () => sortScheduleEvents(scheduleEvents),
    [scheduleEvents]
  );

  const statusesOnSelected = attendanceMap.get(selectedDateKey) || {};
  const dayEvents = useMemo(
    () => getScheduledEventsForDate(sortedScheduleEvents, selectedDateKey, statusesOnSelected),
    [sortedScheduleEvents, selectedDateKey, statusesOnSelected]
  );

  // Resumen del día seleccionado
  const daySummary = useMemo(() => {
    let completed = 0;
    let missed = 0;
    for (const ev of dayEvents) {
      const st = statusesOnSelected[ev.id];
      if (st === 'completed') completed += 1;
      else if (st === 'missed') missed += 1;
    }
    const total = dayEvents.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : null;
    return { completed, missed, pending: Math.max(0, total - completed - missed), total, pct };
  }, [dayEvents, statusesOnSelected]);

  // Agrupación automática por nombre de evento y cálculo de horas (Semana / Mes / Año / Histórico)
  const groupedHoursReport = useMemo(
    () => computeGroupedEventHours(scheduleEvents, scheduleAttendance, todayKey),
    [scheduleEvents, scheduleAttendance, todayKey]
  );

  const groupByKeyMap = useMemo(() => {
    const map = new Map<string, (typeof groupedHoursReport.groups)[number]>();
    for (const g of groupedHoursReport.groups) {
      map.set(g.groupKey, g);
    }
    return map;
  }, [groupedHoursReport]);

  const connectedGroups = useMemo(
    () => groupedHoursReport.groups.filter(g => g.slotsCount > 1),
    [groupedHoursReport]
  );

  const activeFilterGroup = filterEventId.startsWith('group:')
    ? groupByKeyMap.get(filterEventId.slice(6)) || null
    : null;

  const activeFilterCategory = filterEventId.startsWith('cat:')
    ? (filterEventId.slice(4) as ScheduleCategory)
    : null;

  const availableCategories = useMemo(() => {
    const present = new Set<ScheduleCategory>();
    for (const ev of sortedScheduleEvents) {
      if (ev.category !== 'transport') present.add(ev.category);
    }
    return EVENT_SELECTABLE_CATEGORIES.filter(cat => present.has(cat));
  }, [sortedScheduleEvents]);

  const activeCategoryEventIds = useMemo(() => {
    if (!activeFilterCategory) return null;
    return sortedScheduleEvents.filter(ev => ev.category === activeFilterCategory).map(ev => ev.id);
  }, [activeFilterCategory, sortedScheduleEvents]);

  const displayedHourGroups = useMemo(() => {
    if (activeFilterGroup) return [activeFilterGroup];
    if (activeFilterCategory) {
      return groupedHoursReport.groups.filter(g => g.category === activeFilterCategory);
    }
    if (filterEventId !== 'all') {
      return groupedHoursReport.groups.filter(g => g.eventIds.includes(filterEventId));
    }
    return groupedHoursReport.groups;
  }, [groupedHoursReport, activeFilterGroup, activeFilterCategory, filterEventId]);

  const displayedHourTotals = useMemo(() => {
    return displayedHourGroups.reduce(
      (acc, g) => ({
        weeklyMinutes: acc.weeklyMinutes + g.weeklyMinutes,
        monthlyMinutes: acc.monthlyMinutes + g.monthlyMinutes,
        yearlyMinutes: acc.yearlyMinutes + g.yearlyMinutes,
        historicalMinutes: acc.historicalMinutes + g.historicalMinutes
      }),
      { weeklyMinutes: 0, monthlyMinutes: 0, yearlyMinutes: 0, historicalMinutes: 0 }
    );
  }, [displayedHourGroups]);

  const matchingExistingGroup = useMemo(() => {
    const key = normalizeEventGroupKey(formTitle);
    if (!key) return null;
    const found = groupByKeyMap.get(key);
    if (!found) return null;
    if (editingId && found.eventIds.every(id => id === editingId)) return null;
    return found;
  }, [formTitle, groupByKeyMap, editingId]);

  // Informe de Accuracy (individual, por categoría o agrupado por actividad)
  const accuracyReport = useMemo(
    () =>
      computeScheduleAccuracy(scheduleEvents, scheduleAttendance, {
        rangeDays,
        todayKey,
        filterEventId: filterEventId === 'all' || activeFilterGroup || activeFilterCategory ? null : filterEventId,
        filterEventIds: activeFilterGroup
          ? activeFilterGroup.eventIds
          : activeCategoryEventIds
      }),
    [scheduleEvents, scheduleAttendance, rangeDays, todayKey, filterEventId, activeFilterGroup, activeFilterCategory, activeCategoryEventIds]
  );

  // Gráfica de evolución Accuracy con fechas DD/MM
  const accuracyChartConfig: ChartConfiguration = useMemo(() => {
    const pts = accuracyReport.dailySeries;
    return {
      type: 'line',
      data: {
        labels: pts.map(p => formatChartSpanishDate(p.date)),
        datasets: [
          {
            label: 'Asistencia (%)',
            data: pts.map(p => p.accuracyPercent),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.16)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.25,
            pointRadius: 3.5,
            pointBackgroundColor: pts.map(p =>
              p.accuracyPercent >= 80 ? '#10b981' : p.accuracyPercent >= 60 ? '#f59e0b' : '#f43f5e'
            )
          }
        ]
      },
      options: {
        scales: {
          y: {
            min: 0,
            max: 100,
            grid: { color: '#1e293b' },
            ticks: { color: '#94a3b8', callback: val => `${val}%` }
          },
          x: {
            grid: { color: '#1e293b' },
            ticks: { color: '#94a3b8', maxTicksLimit: 7 }
          }
        }
      }
    };
  }, [accuracyReport.dailySeries]);

  const openNewEventForm = () => {
    setEditingId(null);
    setFormTitle('');
    setFormStartTime('18:00');
    setFormEndTime('19:00');
    setFormDays([0, 2, 4]);
    setFormCategory('swim');
    setFormStartDateKey(todayKey);
    setFormTransportBefore(0);
    setFormTransportAfter(0);
    setFormError(null);
    setShowForm(true);
    setSubTab('manage');
  };

  const openEditEventForm = (ev: ScheduleEvent) => {
    setEditingId(ev.id);
    setFormTitle(ev.title);
    setFormStartTime(ev.startTime);
    setFormEndTime(ev.endTime);
    setFormDays(ev.daysOfWeek);
    setFormCategory(ev.category === 'transport' ? 'other' : ev.category);
    setFormStartDateKey(ev.startDateKey || todayKey);
    setFormTransportBefore(ev.transportBeforeMinutes || 0);
    setFormTransportAfter(ev.transportAfterMinutes || 0);
    setFormError(null);
    setShowForm(true);
    setSubTab('manage');
  };

  const toggleFormDay = (dayIdx: number) => {
    setFormDays(prev =>
      prev.includes(dayIdx) ? prev.filter(d => d !== dayIdx) : [...prev, dayIdx].sort((a, b) => a - b)
    );
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = formTitle.trim();
    if (!trimmed) {
      setFormError('Escribe un nombre para el evento.');
      return;
    }
    if (formDays.length === 0) {
      setFormError('Selecciona al menos un día de la semana.');
      return;
    }
    if (formEndTime <= formStartTime) {
      setFormError('La hora de fin debe ser posterior a la de inicio.');
      return;
    }

    const cleanBefore = Math.min(240, Math.max(0, Math.round(formTransportBefore || 0)));
    const cleanAfter = Math.min(240, Math.max(0, Math.round(formTransportAfter || 0)));

    const existing = editingId ? scheduleEvents.find(ev => ev.id === editingId) : undefined;
    const item: ScheduleEvent = {
      id: existing?.id || `sch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: trimmed,
      startTime: formStartTime,
      endTime: formEndTime,
      daysOfWeek: [...formDays].sort((a, b) => a - b),
      category: formCategory,
      startDateKey: formStartDateKey || todayKey,
      ...(cleanBefore > 0 ? { transportBeforeMinutes: cleanBefore } : {}),
      ...(cleanAfter > 0 ? { transportAfterMinutes: cleanAfter } : {}),
      active: existing ? existing.active : true,
      createdAt: existing?.createdAt || Date.now()
    };

    await saveScheduleEventItem(item);
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
  };

  const handleTogglePause = async (ev: ScheduleEvent) => {
    await saveScheduleEventItem({ ...ev, active: !ev.active });
  };

  const handleDeleteEvent = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    await deleteScheduleEventItem(id);
    setConfirmDeleteId(null);
    if (filterEventId === id) setFilterEventId('all');
  };

  return (
    <main className="main-content">
      {/* Sub-navegación superior de Horario */}
      <div className="tab-pills">
        <button
          type="button"
          className={`tab-pill ${subTab === 'daily' ? 'active' : ''}`}
          onClick={() => setSubTab('daily')}
        >
          Check
        </button>
        <button
          type="button"
          className={`tab-pill ${subTab === 'weekly' ? 'active' : ''}`}
          onClick={() => setSubTab('weekly')}
        >
          Semana
        </button>
        <button
          type="button"
          className={`tab-pill ${subTab === 'accuracy' ? 'active' : ''}`}
          onClick={() => setSubTab('accuracy')}
        >
          Accuracy {accuracyReport.accuracyPercent !== null ? `${Math.round(accuracyReport.accuracyPercent)}%` : ''}
        </button>
        <button
          type="button"
          className={`tab-pill ${subTab === 'manage' ? 'active' : ''}`}
          onClick={() => setSubTab('manage')}
        >
          Eventos ({sortedScheduleEvents.filter(e => e.active).length})
        </button>
      </div>

      {/* ================== VISTA SEMANAL TIPO GOOGLE CALENDAR ================== */}
      {subTab === 'weekly' && (
        <WeeklyCalendarGrid
          selectedDateKey={selectedDateKey}
          onSelectDateKey={setSelectedDateKey}
          events={sortedScheduleEvents}
          attendanceMap={attendanceMap}
          attendanceRecords={scheduleAttendance}
          onSetCheck={setScheduleEventCheck}
          onEditEvent={openEditEventForm}
          onCreateEvent={openNewEventForm}
        />
      )}

      {/* ================== PESTAÑA 1: CHECK DIARIO ================== */}
      {subTab === 'daily' && (
        <>
          {/* Navegador de fecha + tira semanal */}
          <div className="card" style={{ padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                style={{ width: 38, height: 38, minHeight: 38 }}
                onClick={() => setSelectedDateKey(addDaysToDateKey(selectedDateKey, -1))}
                title="Día anterior"
                aria-label="Día anterior"
              >
                <ChevronLeft size={20} />
              </button>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minWidth: 0,
                  flex: 1,
                  textAlign: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-main)',
                      fontWeight: 800,
                      fontSize: '1.05rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      cursor: 'pointer',
                      padding: '2px 4px'
                    }}
                  >
                    <CalendarDays size={15} color="#06b6d4" />
                    <span>{formatFriendlyDate(selectedDateKey)}</span>
                  </button>
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={selectedDateKey}
                    onChange={e => e.target.value && setSelectedDateKey(e.target.value)}
                    style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
                    aria-label="Elegir fecha horario"
                  />
                  {!isToday && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '2px 8px', minHeight: '24px', fontSize: '0.72rem', color: '#06b6d4' }}
                      onClick={() => setSelectedDateKey(todayKey)}
                    >
                      Hoy
                    </button>
                  )}
                </div>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                  {formatSpanishDateSlash(selectedDateKey)}
                </span>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-icon"
                style={{ width: 38, height: 38, minHeight: 38 }}
                onClick={() => setSelectedDateKey(addDaysToDateKey(selectedDateKey, 1))}
                title="Día siguiente"
                aria-label="Día siguiente"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Tira semanal con estado de asistencia */}
            <div className="week-strip" style={{ marginTop: '10px' }}>
              {weekKeys.map((wk, idx) => {
                const isSel = wk === selectedDateKey;
                const isWkToday = wk === todayKey;
                const wkStatuses = attendanceMap.get(wk) || {};
                const wkEvents = getScheduledEventsForDate(scheduleEvents, wk, wkStatuses);
                const wkDone = wkEvents.filter(ev => wkStatuses[ev.id] === 'completed').length;
                const wkMiss = wkEvents.filter(ev => wkStatuses[ev.id] === 'missed').length;

                let dotColor: string | null = null;
                if (wkEvents.length > 0) {
                  if (wkDone === wkEvents.length) dotColor = '#10b981';
                  else if (wkDone > 0) dotColor = '#f59e0b';
                  else if (wkMiss > 0) dotColor = '#f43f5e';
                }

                return (
                  <button
                    key={wk}
                    type="button"
                    onClick={() => setSelectedDateKey(wk)}
                    className={`week-day-pill ${isSel ? 'selected' : ''} ${isWkToday && !isSel ? 'today' : ''}`}
                  >
                    <span className="week-day-name">{SPANISH_WEEKDAY_SHORT[idx]}</span>
                    <span className="week-day-num">{parseInt(wk.split('-')[2], 10)}</span>
                    <span
                      className="week-day-dot"
                      style={{ backgroundColor: dotColor || 'transparent' }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resumen rápido del día + Accuracy global */}
          <div className="stat-grid">
            <div className="stat-box">
              <span className="stat-label">Cumplimiento del día</span>
              <span className="stat-value" style={{ color: getAccuracyColor(daySummary.pct) }}>
                {daySummary.total > 0 ? `${daySummary.completed}/${daySummary.total}` : '—'}
              </span>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                {daySummary.pct !== null ? `${daySummary.pct}% completado` : 'Sin bloques este día'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSubTab('accuracy')}
              className="stat-box"
              style={{
                cursor: 'pointer',
                textAlign: 'left',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                background: 'rgba(16, 185, 129, 0.08)'
              }}
            >
              <span className="stat-label">Accuracy ({rangeDays ? `${rangeDays}d` : 'Total'})</span>
              <span className="stat-value" style={{ color: getAccuracyColor(accuracyReport.accuracyPercent) }}>
                {accuracyReport.accuracyPercent !== null ? `${accuracyReport.accuracyPercent}%` : '—'}
              </span>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                {accuracyReport.expected > 0
                  ? `${accuracyReport.completed}/${accuracyReport.expected} bloques · Ver detalle →`
                  : 'Pulsa para ver analítica'}
              </span>
            </button>
          </div>

          {/* Lista de eventos del día */}
          {scheduleEvents.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
              <Clock size={34} color="#06b6d4" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '6px' }}>
                Aún no has creado tu horario recurrente
              </div>
              <p className="text-muted" style={{ fontSize: '0.84rem', marginBottom: '14px' }}>
                Añade bloques que se repiten (p. ej. Natación L-X-V de 19:00 a 20:00) para ir marcando si los cumples cada día y medir tu accuracy.
              </p>
              <button type="button" className="btn btn-primary" onClick={openNewEventForm}>
                <Plus size={18} />
                Crear primer evento
              </button>
            </div>
          ) : dayEvents.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '22px 16px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.96rem', marginBottom: '6px' }}>
                Día libre en tu horario
              </div>
              <p className="text-muted" style={{ fontSize: '0.82rem', marginBottom: '12px' }}>
                No tienes eventos programados para el {formatFriendlyDate(selectedDateKey).toLowerCase()}.
              </p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={openNewEventForm}>
                <Plus size={15} />
                Añadir evento a este horario
              </button>
            </div>
          ) : (
            <div className="card">
              <div className="card-header" style={{ marginBottom: '10px' }}>
                <div className="card-title">
                  <Clock size={18} color="#06b6d4" />
                  <span>Bloques del día ({dayEvents.length})</span>
                </div>
                {daySummary.completed < dayEvents.length && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ minHeight: '30px', padding: '4px 9px', fontSize: '0.74rem' }}
                    onClick={() =>
                      setAllScheduleChecksForDate(
                        selectedDateKey,
                        dayEvents.map(ev => ev.id),
                        'completed'
                      )
                    }
                  >
                    <CheckCheck size={14} color="#34d399" />
                    Todos ✓
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {dayEvents.map(ev => {
                  const status = statusesOnSelected[ev.id];
                  const meta = SCHEDULE_CATEGORY_META[ev.category] || SCHEDULE_CATEGORY_META.other;
                  const borderColor =
                    status === 'completed'
                      ? 'rgba(16, 185, 129, 0.5)'
                      : status === 'missed'
                      ? 'rgba(244, 63, 94, 0.45)'
                      : 'var(--border-color)';
                  const bgColor =
                    status === 'completed'
                      ? 'rgba(16, 185, 129, 0.09)'
                      : status === 'missed'
                      ? 'rgba(244, 63, 94, 0.08)'
                      : 'var(--bg-subtle)';

                  return (
                    <div
                      key={ev.id}
                      style={{
                        borderRadius: '12px',
                        padding: '12px',
                        border: `1px solid ${borderColor}`,
                        background: bgColor,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                color: meta.color,
                                background: meta.bg,
                                padding: '2px 7px',
                                borderRadius: '9999px'
                              }}
                            >
                              {ev.startTime} – {ev.endTime}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                              {meta.label}
                            </span>
                          </div>
                          <div style={{ fontWeight: 700, fontSize: '0.96rem', marginTop: '5px', color: 'var(--text-main)' }}>
                            {ev.title}
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '9999px',
                            flexShrink: 0,
                            background:
                              status === 'completed'
                                ? 'rgba(16, 185, 129, 0.18)'
                                : status === 'missed'
                                ? 'rgba(244, 63, 94, 0.18)'
                                : 'rgba(148, 163, 184, 0.14)',
                            color:
                              status === 'completed'
                                ? '#34d399'
                                : status === 'missed'
                                ? '#fb7185'
                                : '#94a3b8'
                          }}
                        >
                          {status === 'completed' ? 'Cumplido' : status === 'missed' ? 'No cumplido' : 'Sin marcar'}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() =>
                            setScheduleEventCheck(
                              selectedDateKey,
                              ev.id,
                              status === 'completed' ? null : 'completed'
                            )
                          }
                          style={{
                            minHeight: '40px',
                            borderRadius: '10px',
                            border: `1px solid ${status === 'completed' ? '#10b981' : 'var(--border-color)'}`,
                            background:
                              status === 'completed'
                                ? 'rgba(16, 185, 129, 0.25)'
                                : 'var(--bg-input)',
                            color: status === 'completed' ? '#6ee7b7' : 'var(--text-main)',
                            fontWeight: 700,
                            fontSize: '0.84rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          <CheckCircle2 size={16} />
                          Cumplido
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setScheduleEventCheck(
                              selectedDateKey,
                              ev.id,
                              status === 'missed' ? null : 'missed'
                            )
                          }
                          style={{
                            minHeight: '40px',
                            borderRadius: '10px',
                            border: `1px solid ${status === 'missed' ? '#f43f5e' : 'var(--border-color)'}`,
                            background:
                              status === 'missed'
                                ? 'rgba(244, 63, 94, 0.25)'
                                : 'var(--bg-input)',
                            color: status === 'missed' ? '#fda4af' : 'var(--text-muted)',
                            fontWeight: 700,
                            fontSize: '0.84rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          <XCircle size={16} />
                          No cumplido
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ================== PESTAÑA 2: ACCURACY (% DE ASISTENCIA) ================== */}
      {subTab === 'accuracy' && (
        <>
          {/* Filtros temporales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '6px' }}>
            {ACCURACY_RANGES.map(r => (
              <button
                key={r.label}
                type="button"
                onClick={() => setRangeDays(r.value)}
                className={`btn btn-sm ${rangeDays === r.value ? 'btn-primary' : 'btn-secondary'}`}
                style={{ minHeight: '34px', fontSize: '0.78rem' }}
              >
                {r.label}
              </button>
            ))}
          </div>

          {sortedScheduleEvents.length > 0 && (
            <div className="input-group">
              <label className="input-label">Filtrar por evento, categoría o actividad</label>
              <select
                className="input-field"
                value={filterEventId}
                onChange={e => setFilterEventId(e.target.value)}
              >
                <option value="all">Todos los eventos del horario</option>
                {availableCategories.length > 0 && (
                  <optgroup label="Por categoría">
                    {availableCategories.map(cat => (
                      <option key={`cat:${cat}`} value={`cat:${cat}`}>
                        🏷️ Categoría: {SCHEDULE_CATEGORY_META[cat].label}
                      </option>
                    ))}
                  </optgroup>
                )}
                {connectedGroups.length > 0 && (
                  <optgroup label="Actividades agrupadas (mismo nombre)">
                    {connectedGroups.map(g => (
                      <option key={`group:${g.groupKey}`} value={`group:${g.groupKey}`}>
                        🔗 {g.displayTitle} (todos · {g.slotsCount} horarios)
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Horarios individuales">
                  {sortedScheduleEvents.map(ev => {
                    const daysLabel = [...ev.daysOfWeek]
                      .sort((a, b) => a - b)
                      .map(d => SPANISH_WEEKDAY_SHORT[d])
                      .join('·');
                    return (
                      <option key={ev.id} value={ev.id}>
                        {daysLabel} · {ev.startTime}–{ev.endTime} · {ev.title}
                      </option>
                    );
                  })}
                </optgroup>
              </select>
            </div>
          )}

          {/* Tarjeta principal de Accuracy */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Target size={19} color="#10b981" />
                <span>Accuracy de Asistencia</span>
              </div>
              <span className="pill-badge">
                {rangeDays ? `Últimos ${rangeDays} días` : 'Histórico completo'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '2.3rem',
                  fontWeight: 800,
                  lineHeight: 1.05,
                  color: getAccuracyColor(accuracyReport.accuracyPercent)
                }}
              >
                {accuracyReport.accuracyPercent !== null ? `${accuracyReport.accuracyPercent}%` : '—'}
              </span>
              <span style={{ fontSize: '0.84rem', color: '#94a3b8' }}>
                {accuracyReport.expected > 0
                  ? `${accuracyReport.completed} de ${accuracyReport.expected} sesiones cumplidas`
                  : 'Marca al menos un bloque o espera sesiones pasadas'}
              </span>
            </div>

            {/* Barra de progreso visual */}
            <div
              style={{
                width: '100%',
                height: '10px',
                borderRadius: '9999px',
                background: 'var(--bg-subtle)',
                overflow: 'hidden',
                border: '1px solid var(--border-color)',
                marginBottom: '12px'
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, accuracyReport.accuracyPercent ?? 0))}%`,
                  height: '100%',
                  background: getAccuracyColor(accuracyReport.accuracyPercent),
                  transition: 'width 0.3s ease'
                }}
              />
            </div>

            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <div className="stat-box">
                <span className="stat-label">Cumplidos / Fallados</span>
                <span className="stat-value" style={{ fontSize: '1.1rem' }}>
                  <span style={{ color: '#34d399' }}>{accuracyReport.completed} ✓</span>
                  {' · '}
                  <span style={{ color: '#fb7185' }}>{accuracyReport.missed} ✕</span>
                </span>
                {accuracyReport.unmarkedPast > 0 && (
                  <span style={{ fontSize: '0.7rem', color: '#fbbf24' }}>
                    {accuracyReport.unmarkedPast} pasados sin marcar
                  </span>
                )}
              </div>

              <div className="stat-box">
                <span className="stat-label">Racha 100% (días)</span>
                <span className="stat-value" style={{ fontSize: '1.1rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Flame size={16} />
                  {accuracyReport.currentDayStreak}d
                </span>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                  Mejor racha: {accuracyReport.bestDayStreak}d
                </span>
              </div>
            </div>

            {accuracyReport.unmarkedPast > 0 && accuracyReport.markedAccuracyPercent !== null && (
              <div style={{ marginTop: '10px', fontSize: '0.76rem', color: '#94a3b8' }}>
                Sobre días ya evaluados (sin contar sin marcar):{' '}
                <strong style={{ color: '#e2e8f0' }}>{accuracyReport.markedAccuracyPercent}%</strong>
              </div>
            )}
          </div>

          {/* Gráfica diaria de asistencia */}
          {accuracyReport.dailySeries.length >= 2 && (
            <div className="card">
              <div className="card-header" style={{ marginBottom: '6px' }}>
                <div className="card-title">
                  <span>Evolución Diaria de Accuracy</span>
                </div>
                <span className="text-muted" style={{ fontSize: '0.72rem' }}>DD/MM</span>
              </div>
              <ChartCanvas config={accuracyChartConfig} height={210} />
            </div>
          )}

          {/* Horas realizadas agrupadas por nombre de actividad */}
          {displayedHourGroups.length > 0 && (
            <div className="card">
              <div className="card-header" style={{ marginBottom: '10px' }}>
                <div className="card-title">
                  <Clock size={18} color="#38bdf8" />
                  <span>Horas por Actividad</span>
                </div>
                {groupedHoursReport.totals.connectedActivitiesCount > 0 && (
                  <span
                    className="pill-badge"
                    style={{ background: 'rgba(56, 189, 248, 0.16)', color: '#67e8f9', borderColor: 'rgba(56, 189, 248, 0.35)' }}
                  >
                    🔗 {groupedHoursReport.totals.connectedActivitiesCount}{' '}
                    {groupedHoursReport.totals.connectedActivitiesCount === 1 ? 'conectada' : 'conectadas'}
                  </span>
                )}
              </div>

              {/* Resumen global Semana / Mes / Año / Histórico */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  gap: '6px',
                  marginBottom: '12px'
                }}
              >
                {[
                  { label: 'Semana', mins: displayedHourTotals.weeklyMinutes, color: '#38bdf8' },
                  { label: 'Mes', mins: displayedHourTotals.monthlyMinutes, color: '#34d399' },
                  { label: 'Año', mins: displayedHourTotals.yearlyMinutes, color: '#c084fc' },
                  { label: 'Histórico', mins: displayedHourTotals.historicalMinutes, color: '#fbbf24' }
                ].map(cell => (
                  <div
                    key={cell.label}
                    style={{
                      background: '#0b1120',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                      padding: '8px 6px',
                      textAlign: 'center',
                      minWidth: 0
                    }}
                  >
                    <div style={{ fontSize: '0.66rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                      {cell.label}
                    </div>
                    <div style={{ fontSize: '0.94rem', fontWeight: 800, color: cell.color, marginTop: '2px' }}>
                      {formatHoursMinutesShort(cell.mins)}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {displayedHourGroups.map(group => {
                  const meta = SCHEDULE_CATEGORY_META[group.category] || SCHEDULE_CATEGORY_META.other;
                  const isConnected = group.slotsCount > 1;
                  const isGroupFiltered = filterEventId === `group:${group.groupKey}`;
                  const slotsText = group.slots
                    .map(slot => {
                      const d = slot.daysOfWeek.map(idx => SPANISH_WEEKDAY_SHORT[idx]).join('·');
                      return `${d} ${slot.startTime}–${slot.endTime}`;
                    })
                    .join(' · ');

                  return (
                    <div
                      key={group.groupKey}
                      style={{
                        background: 'var(--bg-subtle)',
                        borderRadius: '12px',
                        padding: '10px 11px',
                        border: isGroupFiltered ? '1px solid #38bdf8' : '1px solid var(--border-color)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                              {group.displayTitle}
                            </span>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                color: meta.color,
                                background: meta.bg,
                                padding: '2px 7px',
                                borderRadius: '9999px'
                              }}
                            >
                              {meta.label}
                            </span>
                            {isConnected && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  color: '#67e8f9',
                                  background: 'rgba(6, 182, 212, 0.16)',
                                  padding: '2px 7px',
                                  borderRadius: '9999px'
                                }}
                              >
                                <Link2 size={10} />
                                {group.slotsCount} horarios
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '3px', wordBreak: 'break-word' }}>
                            {slotsText}
                            {group.plannedMinutesPerWeek > 0 && ` · Plan: ${formatHoursMinutesShort(group.plannedMinutesPerWeek)}/sem`}
                          </div>
                        </div>
                        {isConnected && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ minHeight: '26px', padding: '2px 7px', fontSize: '0.68rem', color: '#38bdf8', flexShrink: 0 }}
                            onClick={() => setFilterEventId(isGroupFiltered ? 'all' : `group:${group.groupKey}`)}
                          >
                            {isGroupFiltered ? 'Ver todo' : 'Filtrar'}
                          </button>
                        )}
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                          gap: '5px',
                          marginTop: '8px'
                        }}
                      >
                        {[
                          { label: 'Sem.', mins: group.weeklyMinutes, sess: group.weeklySessions },
                          { label: 'Mes', mins: group.monthlyMinutes, sess: group.monthlySessions },
                          { label: 'Año', mins: group.yearlyMinutes, sess: group.yearlySessions },
                          { label: 'Hist.', mins: group.historicalMinutes, sess: group.historicalSessions }
                        ].map(period => (
                          <div
                            key={period.label}
                            style={{
                              background: 'rgba(15, 23, 42, 0.65)',
                              borderRadius: '8px',
                              padding: '5px 4px',
                              textAlign: 'center',
                              minWidth: 0
                            }}
                          >
                            <div style={{ fontSize: '0.64rem', color: '#64748b', fontWeight: 700 }}>{period.label}</div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: period.mins > 0 ? '#f8fafc' : '#64748b' }}>
                              {formatHoursMinutesShort(period.mins)}
                            </div>
                            <div style={{ fontSize: '0.6rem', color: '#64748b' }}>
                              {period.sess} ses.
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Desglose por categoría */}
          {accuracyReport.perCategory.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <span>Accuracy por Categoría</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {accuracyReport.perCategory.map(catItem => {
                  const meta = SCHEDULE_CATEGORY_META[catItem.category] || SCHEDULE_CATEGORY_META.other;
                  const pct = catItem.accuracyPercent;
                  const isCatFiltered = filterEventId === `cat:${catItem.category}`;
                  return (
                    <div
                      key={catItem.category}
                      style={{
                        background: 'var(--bg-subtle)',
                        borderRadius: '10px',
                        padding: '10px 12px',
                        border: isCatFiltered ? `1px solid ${meta.color}` : '1px solid var(--border-color)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '0.76rem',
                              fontWeight: 800,
                              color: meta.color,
                              background: meta.bg,
                              padding: '2px 8px',
                              borderRadius: '9999px'
                            }}
                          >
                            {meta.label}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            {catItem.eventsCount} {catItem.eventsCount === 1 ? 'horario' : 'horarios'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ minHeight: '24px', padding: '1px 6px', fontSize: '0.68rem', color: '#38bdf8' }}
                            onClick={() => setFilterEventId(isCatFiltered ? 'all' : `cat:${catItem.category}`)}
                          >
                            {isCatFiltered ? 'Ver todo' : 'Filtrar'}
                          </button>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: getAccuracyColor(pct) }}>
                              {pct !== null ? `${pct}%` : '—'}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                              {catItem.completed}/{catItem.expected}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div style={{ height: '6px', borderRadius: '9999px', background: '#0b1120', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(0, pct ?? 0))}%`,
                            height: '100%',
                            background: meta.color
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Desglose por evento */}
          {accuracyReport.perEvent.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <span>Accuracy por Evento</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {accuracyReport.perEvent.map(item => {
                  const meta = SCHEDULE_CATEGORY_META[item.category] || SCHEDULE_CATEGORY_META.other;
                  const pct = item.accuracyPercent;
                  return (
                    <div
                      key={item.eventId}
                      style={{
                        background: 'var(--bg-subtle)',
                        borderRadius: '10px',
                        padding: '10px 12px',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                            {item.title} {!item.active && <span style={{ color: '#94a3b8', fontSize: '0.74rem' }}>(Pausado)</span>}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: meta.color }}>
                            {item.startTime} – {item.endTime}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: getAccuracyColor(pct) }}>
                            {pct !== null ? `${pct}%` : '—'}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            {item.completed}/{item.expected}
                          </div>
                        </div>
                      </div>
                      <div style={{ height: '6px', borderRadius: '9999px', background: '#0b1120', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(0, pct ?? 0))}%`,
                            height: '100%',
                            background: getAccuracyColor(pct)
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ================== PESTAÑA 3: MI HORARIO (CRUD EVENTOS) ================== */}
      {subTab === 'manage' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 800 }}>Eventos Recurrentes</h2>
            {!showForm && (
              <button type="button" className="btn btn-primary btn-sm" onClick={openNewEventForm}>
                <Plus size={16} />
                Nuevo evento
              </button>
            )}
          </div>

          {showForm && (
            <form className="card" onSubmit={handleSaveEvent} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="card-header" style={{ marginBottom: 0 }}>
                <span className="card-title">{editingId ? 'Editar evento' : 'Añadir evento recurrente'}</span>
              </div>

              <div className="input-group">
                <label className="input-label">Nombre del evento</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej: Natación, Gimnasio, Inglés..."
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  maxLength={50}
                />
                {matchingExistingGroup && (
                  <div
                    style={{
                      marginTop: '5px',
                      fontSize: '0.72rem',
                      color: '#67e8f9',
                      background: 'rgba(6, 182, 212, 0.12)',
                      border: '1px solid rgba(6, 182, 212, 0.3)',
                      borderRadius: '8px',
                      padding: '5px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <Link2 size={12} />
                    <span>
                      Se conectará con «{matchingExistingGroup.displayTitle}» ({matchingExistingGroup.slotsCount}{' '}
                      {matchingExistingGroup.slotsCount === 1 ? 'horario ya creado' : 'horarios ya creados'}) y sumará sus horas.
                    </span>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div className="input-group">
                  <label className="input-label">Hora inicio</label>
                  <input
                    type="time"
                    className="input-field"
                    value={formStartTime}
                    onChange={e => setFormStartTime(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Hora fin</label>
                  <input
                    type="time"
                    className="input-field"
                    value={formEndTime}
                    onChange={e => setFormEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                  <label className="input-label">Días que se repite</label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ minHeight: '22px', padding: '1px 6px', fontSize: '0.68rem', color: '#38bdf8' }}
                      onClick={() => setFormDays([0, 1, 2, 3, 4])}
                    >
                      L-V
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ minHeight: '22px', padding: '1px 6px', fontSize: '0.68rem', color: '#38bdf8' }}
                      onClick={() => setFormDays([0, 1, 2, 3, 4, 5, 6])}
                    >
                      Todos
                    </button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '5px', marginTop: '4px' }}>
                  {SPANISH_WEEKDAY_SHORT.map((label, idx) => {
                    const active = formDays.includes(idx);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => toggleFormDay(idx)}
                        style={{
                          minHeight: '38px',
                          borderRadius: '10px',
                          border: `1px solid ${active ? '#06b6d4' : 'var(--border-color)'}`,
                          background: active ? 'rgba(6, 182, 212, 0.22)' : 'var(--bg-subtle)',
                          color: active ? '#67e8f9' : 'var(--text-muted)',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer'
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div className="input-group">
                  <label className="input-label">Categoría</label>
                  <select
                    className="input-field"
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value as ScheduleCategory)}
                  >
                    {EVENT_SELECTABLE_CATEGORIES.map(key => (
                      <option key={key} value={key}>
                        {SCHEDULE_CATEGORY_META[key].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">Cuenta desde ({formatSpanishDateSlash(formStartDateKey)})</label>
                  <input
                    type="date"
                    className="input-field"
                    value={formStartDateKey}
                    onChange={e => e.target.value && setFormStartDateKey(e.target.value)}
                  />
                </div>
              </div>

              {/* Transporte complementario (ida y/o vuelta en el cuadro semanal, sin accuracy) */}
              <div
                style={{
                  background: 'var(--bg-subtle)',
                  borderRadius: '10px',
                  padding: '10px',
                  border: '1px dashed rgba(148, 163, 184, 0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1' }}>
                    🚌 Transporte complementario (opcional)
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                    Aparece en el cuadro semanal antes/después del evento, sin contar en Accuracy.
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="input-group">
                    <label className="input-label">Ida (min antes)</label>
                    <input
                      type="number"
                      min={0}
                      max={240}
                      step={5}
                      className="input-field"
                      value={formTransportBefore}
                      onChange={e => setFormTransportBefore(Math.max(0, Math.min(240, Number(e.target.value) || 0)))}
                    />
                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                      {[0, 15, 20, 30, 45].map(m => (
                        <button
                          key={`b-${m}`}
                          type="button"
                          onClick={() => setFormTransportBefore(m)}
                          style={{
                            padding: '2px 6px',
                            borderRadius: '6px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            border: `1px solid ${formTransportBefore === m ? '#94a3b8' : 'var(--border-color)'}`,
                            background: formTransportBefore === m ? 'rgba(148, 163, 184, 0.25)' : 'var(--bg-input)',
                            color: '#e2e8f0',
                            cursor: 'pointer'
                          }}
                        >
                          {m}m
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Vuelta (min después)</label>
                    <input
                      type="number"
                      min={0}
                      max={240}
                      step={5}
                      className="input-field"
                      value={formTransportAfter}
                      onChange={e => setFormTransportAfter(Math.max(0, Math.min(240, Number(e.target.value) || 0)))}
                    />
                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                      {[0, 15, 20, 30, 45].map(m => (
                        <button
                          key={`a-${m}`}
                          type="button"
                          onClick={() => setFormTransportAfter(m)}
                          style={{
                            padding: '2px 6px',
                            borderRadius: '6px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            border: `1px solid ${formTransportAfter === m ? '#94a3b8' : 'var(--border-color)'}`,
                            background: formTransportAfter === m ? 'rgba(148, 163, 184, 0.25)' : 'var(--bg-input)',
                            color: '#e2e8f0',
                            cursor: 'pointer'
                          }}
                        >
                          {m}m
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {formError && (
                <div style={{ fontSize: '0.8rem', color: '#fb7185', fontWeight: 600 }}>
                  {formError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    setFormError(null);
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingId ? 'Guardar cambios' : 'Añadir al horario'}
                </button>
              </div>
            </form>
          )}

          {sortedScheduleEvents.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
              <p className="text-muted" style={{ fontSize: '0.84rem' }}>
                No hay bloques horarios definidos todavía. Pulsa «Nuevo evento» para configurar tu rutina semanal.
              </p>
            </div>
          ) : (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '8px' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#94a3b8' }}>
                  Ordenados por días (L–D) y hora
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ minHeight: '28px', padding: '3px 9px', fontSize: '0.72rem' }}
                  onClick={() => setSubTab('weekly')}
                >
                  <CalendarDays size={13} color="#38bdf8" />
                  Ver calendario semanal
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {sortedScheduleEvents.map(ev => {
                  const meta = SCHEDULE_CATEGORY_META[ev.category] || SCHEDULE_CATEGORY_META.other;
                  const daysStr = [...ev.daysOfWeek]
                    .sort((a, b) => a - b)
                    .map(d => SPANISH_WEEKDAY_SHORT[d])
                    .join(' · ');
                  const eventGroup = groupByKeyMap.get(normalizeEventGroupKey(ev.title) || ev.id);
                  return (
                    <div
                      key={ev.id}
                      style={{
                        background: 'var(--bg-subtle)',
                        borderRadius: '12px',
                        padding: '11px 12px',
                        border: '1px solid var(--border-color)',
                        opacity: ev.active ? 1 : 0.68,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                color: '#e2e8f0',
                                background: 'rgba(148, 163, 184, 0.16)',
                                padding: '2px 7px',
                                borderRadius: '9999px'
                              }}
                            >
                              {daysStr}
                            </span>
                            <span
                              style={{
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                color: meta.color,
                                background: meta.bg,
                                padding: '2px 7px',
                                borderRadius: '9999px'
                              }}
                            >
                              {ev.startTime} – {ev.endTime}
                            </span>
                          </div>
                          <div style={{ fontWeight: 700, fontSize: '0.94rem', marginTop: '4px' }}>
                            {ev.title} {!ev.active && <span style={{ color: '#fbbf24', fontSize: '0.75rem' }}>(Pausado)</span>}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <span>Desde el {formatSpanishDateSlash(ev.startDateKey)}</span>
                            {eventGroup && eventGroup.slotsCount > 1 && (
                              <span style={{ color: '#67e8f9' }}>
                                🔗 {eventGroup.slotsCount} horarios · {formatHoursMinutesShort(eventGroup.historicalMinutes)} acum.
                              </span>
                            )}
                            {formatTransportSummary(ev) && (
                              <span style={{ color: '#94a3b8' }}>🚌 {formatTransportSummary(ev)}</span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            style={{ width: 32, height: 32, minHeight: 32 }}
                            onClick={() => handleTogglePause(ev)}
                            title={ev.active ? 'Pausar evento' : 'Reanudar evento'}
                          >
                            {ev.active ? <PauseCircle size={15} color="#fbbf24" /> : <PlayCircle size={15} color="#34d399" />}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            style={{ width: 32, height: 32, minHeight: 32 }}
                            onClick={() => openEditEventForm(ev)}
                            title="Editar evento"
                          >
                            <Edit2 size={14} color="#38bdf8" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            style={{
                              width: confirmDeleteId === ev.id ? 'auto' : 32,
                              padding: confirmDeleteId === ev.id ? '0 8px' : 0,
                              height: 32,
                              minHeight: 32,
                              fontSize: '0.72rem',
                              color: '#fb7185'
                            }}
                            onClick={() => handleDeleteEvent(ev.id)}
                            title="Eliminar evento"
                          >
                            {confirmDeleteId === ev.id ? '¿Borrar?' : <Trash2 size={14} color="#f43f5e" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
};
