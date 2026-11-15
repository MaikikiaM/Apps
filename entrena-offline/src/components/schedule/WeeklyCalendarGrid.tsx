// src/components/schedule/WeeklyCalendarGrid.tsx
// Calendario semanal visual estilo Google Calendar con franjas horarias proporcionales y estado de asistencia

import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Edit2,
  Plus,
  Calendar
} from 'lucide-react';
import { ScheduleCheckStatus, ScheduleDayRecord, ScheduleEvent } from '../../types/models';
import {
  addDaysToDateKey,
  formatChartSpanishDate,
  formatFullSpanishDate,
  getWeekDateKeys,
  toLocalDateKey
} from '../../utils/dates';
import {
  computeGroupedEventHours,
  computeScheduleAccuracy,
  EVENT_SELECTABLE_CATEGORIES,
  formatHoursMinutesShort,
  getEventDurationMinutes,
  minutesToHHMM,
  normalizeEventGroupKey,
  SCHEDULE_CATEGORY_META,
  SPANISH_WEEKDAY_SHORT,
  sortScheduleEvents
} from '../../utils/scheduleStats';

void EVENT_SELECTABLE_CATEGORIES;

interface WeeklyCalendarGridProps {
  selectedDateKey: string;
  onSelectDateKey: (dateKey: string) => void;
  events: ScheduleEvent[];
  attendanceMap: Map<string, Record<string, ScheduleCheckStatus>>;
  attendanceRecords?: ScheduleDayRecord[];
  onSetCheck: (dateKey: string, eventId: string, status: ScheduleCheckStatus | null) => Promise<void>;
  onEditEvent: (event: ScheduleEvent) => void;
  onCreateEvent: () => void;
}

interface PositionedBlock {
  blockId: string;
  event: ScheduleEvent;
  isTransport: boolean;
  transportRole?: 'before' | 'after';
  displayStartTime: string;
  displayEndTime: string;
  startMin: number;
  endMin: number;
  lane: number;
  totalLanes: number;
}

interface InspectedSelection {
  blockId: string;
  eventId: string;
  dateKey: string;
  isTransport: boolean;
  transportRole?: 'before' | 'after';
  displayStartTime: string;
  displayEndTime: string;
}

function parseTimeToMinutes(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 9 * 60;
  return h * 60 + m;
}

function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

// Expande cada evento con sus bloques complementarios de transporte (ida/vuelta) y resuelve solapes en carriles
function layoutOverlappingEvents(dayEvents: ScheduleEvent[]): PositionedBlock[] {
  const expanded: {
    blockId: string;
    event: ScheduleEvent;
    isTransport: boolean;
    transportRole?: 'before' | 'after';
    displayStartTime: string;
    displayEndTime: string;
    startMin: number;
    endMin: number;
  }[] = [];

  for (const ev of sortScheduleEvents(dayEvents)) {
    const startMin = parseTimeToMinutes(ev.startTime);
    const rawEnd = parseTimeToMinutes(ev.endTime);
    const endMin = Math.max(startMin + 25, rawEnd);

    const beforeMin = ev.transportBeforeMinutes && ev.transportBeforeMinutes > 0 ? ev.transportBeforeMinutes : 0;
    if (beforeMin > 0 && startMin > 0) {
      const trStart = Math.max(0, startMin - beforeMin);
      const trVisualEnd = Math.max(trStart + 15, startMin);
      expanded.push({
        blockId: `${ev.id}__tr_before`,
        event: ev,
        isTransport: true,
        transportRole: 'before',
        displayStartTime: minutesToHHMM(trStart),
        displayEndTime: ev.startTime,
        startMin: trStart,
        endMin: trVisualEnd
      });
    }

    expanded.push({
      blockId: ev.id,
      event: ev,
      isTransport: false,
      displayStartTime: ev.startTime,
      displayEndTime: ev.endTime,
      startMin,
      endMin
    });

    const afterMin = ev.transportAfterMinutes && ev.transportAfterMinutes > 0 ? ev.transportAfterMinutes : 0;
    if (afterMin > 0 && rawEnd < 24 * 60) {
      const trEnd = Math.min(24 * 60, rawEnd + afterMin);
      const trVisualEnd = Math.max(rawEnd + 15, trEnd);
      expanded.push({
        blockId: `${ev.id}__tr_after`,
        event: ev,
        isTransport: true,
        transportRole: 'after',
        displayStartTime: ev.endTime,
        displayEndTime: minutesToHHMM(Math.min(23 * 60 + 59, trEnd)),
        startMin: rawEnd,
        endMin: trVisualEnd
      });
    }
  }

  const sorted = expanded.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const blocks: PositionedBlock[] = [];
  let cluster: typeof sorted = [];
  let clusterMaxEnd = -1;

  const flushCluster = () => {
    if (cluster.length === 0) return;
    const laneEnds: number[] = [];
    const assigned: { item: (typeof sorted)[number]; lane: number }[] = [];

    for (const item of cluster) {
      let placedLane = laneEnds.findIndex(end => end <= item.startMin);
      if (placedLane === -1) {
        placedLane = laneEnds.length;
        laneEnds.push(item.endMin);
      } else {
        laneEnds[placedLane] = item.endMin;
      }
      assigned.push({ item, lane: placedLane });
    }

    const totalLanes = Math.max(1, laneEnds.length);
    for (const entry of assigned) {
      blocks.push({
        blockId: entry.item.blockId,
        event: entry.item.event,
        isTransport: entry.item.isTransport,
        transportRole: entry.item.transportRole,
        displayStartTime: entry.item.displayStartTime,
        displayEndTime: entry.item.displayEndTime,
        startMin: entry.item.startMin,
        endMin: entry.item.endMin,
        lane: entry.lane,
        totalLanes
      });
    }
    cluster = [];
    clusterMaxEnd = -1;
  };

  for (const item of sorted) {
    if (cluster.length > 0 && item.startMin >= clusterMaxEnd) {
      flushCluster();
    }
    cluster.push(item);
    if (item.endMin > clusterMaxEnd) {
      clusterMaxEnd = item.endMin;
    }
  }
  flushCluster();

  return blocks;
}

const HOUR_HEIGHT_PX = 44;

export const WeeklyCalendarGrid: React.FC<WeeklyCalendarGridProps> = ({
  selectedDateKey,
  onSelectDateKey,
  events,
  attendanceMap,
  attendanceRecords,
  onSetCheck,
  onEditEvent,
  onCreateEvent
}) => {
  const [showWeekdaysOnly, setShowWeekdaysOnly] = useState<boolean>(false);
  const [inspectedBlock, setInspectedBlock] = useState<InspectedSelection | null>(null);

  const todayKey = toLocalDateKey(new Date());
  const weekKeys = useMemo(() => getWeekDateKeys(selectedDateKey), [selectedDateKey]);
  const visibleWeekDays = useMemo(
    () => (showWeekdaysOnly ? weekKeys.slice(0, 5) : weekKeys),
    [weekKeys, showWeekdaysOnly]
  );

  const activeEvents = useMemo(
    () => sortScheduleEvents(events.filter(ev => ev.active)),
    [events]
  );

  // Rango vertical dinámico de horas contemplando eventos y su transporte previo/posterior
  const { startHour, endHour } = useMemo(() => {
    if (activeEvents.length === 0) {
      return { startHour: 8, endHour: 22 };
    }
    let minH = 23;
    let maxH = 0;
    for (const ev of activeEvents) {
      const beforeMin = ev.transportBeforeMinutes && ev.transportBeforeMinutes > 0 ? ev.transportBeforeMinutes : 0;
      const afterMin = ev.transportAfterMinutes && ev.transportAfterMinutes > 0 ? ev.transportAfterMinutes : 0;
      const sMin = Math.max(0, parseTimeToMinutes(ev.startTime) - beforeMin);
      const eMin = Math.min(24 * 60, parseTimeToMinutes(ev.endTime) + afterMin);
      minH = Math.min(minH, Math.floor(sMin / 60));
      maxH = Math.max(maxH, Math.ceil(eMin / 60));
    }
    const clampedStart = Math.max(0, Math.min(minH - 1, 9));
    const clampedEnd = Math.min(24, Math.max(maxH + 1, clampedStart + 6, 20));
    return { startHour: clampedStart, endHour: clampedEnd };
  }, [activeEvents]);

  const hoursList = useMemo(() => {
    const arr: number[] = [];
    for (let h = startHour; h <= endHour; h++) {
      arr.push(h);
    }
    return arr;
  }, [startHour, endHour]);

  const totalGridHeight = (endHour - startHour) * HOUR_HEIGHT_PX;

  // Bloques posicionados por cada día visible
  const dayColumns = useMemo(() => {
    return visibleWeekDays.map((dateKey, colIdx) => {
      const statuses = attendanceMap.get(dateKey) || {};
      const dayEvents = activeEvents.filter(ev => ev.daysOfWeek.includes(colIdx));
      return {
        dateKey,
        dayIdx: colIdx,
        shortLabel: SPANISH_WEEKDAY_SHORT[colIdx],
        dayNum: parseInt(dateKey.split('-')[2], 10),
        statuses,
        blocks: layoutOverlappingEvents(dayEvents)
      };
    });
  }, [visibleWeekDays, activeEvents, attendanceMap]);

  // Línea horizontal de hora actual si hoy está en la semana visible
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const showNowLine =
    weekKeys.includes(todayKey) &&
    currentMinutes >= startHour * 60 &&
    currentMinutes <= endHour * 60;
  const nowTopPx = ((currentMinutes - startHour * 60) / 60) * HOUR_HEIGHT_PX;

  const selectedEventObj = inspectedBlock
    ? events.find(ev => ev.id === inspectedBlock.eventId) || null
    : null;

  const resolvedAttendanceRecords = useMemo<ScheduleDayRecord[]>(() => {
    if (attendanceRecords) return attendanceRecords;
    return Array.from(attendanceMap.entries()).map(([date, statuses]) => ({
      date,
      statuses,
      updatedAt: 0
    }));
  }, [attendanceRecords, attendanceMap]);

  const selectedEventInsights = useMemo(() => {
    if (!selectedEventObj) return null;

    const eventAccuracy = computeScheduleAccuracy(events, resolvedAttendanceRecords, {
      rangeDays: null,
      todayKey,
      filterEventId: selectedEventObj.id
    });

    const groupedReport = computeGroupedEventHours(events, resolvedAttendanceRecords, todayKey);
    const groupKey = normalizeEventGroupKey(selectedEventObj.title) || selectedEventObj.id;
    const matchedGroup =
      groupedReport.groups.find(g => g.groupKey === groupKey || g.eventIds.includes(selectedEventObj.id)) || null;

    const groupAccuracy =
      matchedGroup && matchedGroup.slotsCount > 1
        ? computeScheduleAccuracy(events, resolvedAttendanceRecords, {
            rangeDays: null,
            todayKey,
            filterEventIds: matchedGroup.eventIds
          })
        : null;

    const singleHours = computeGroupedEventHours([selectedEventObj], resolvedAttendanceRecords, todayKey).groups[0] || null;

    const startMin = parseTimeToMinutes(selectedEventObj.startTime);
    const endMin = parseTimeToMinutes(selectedEventObj.endTime);
    const beforeMin =
      selectedEventObj.transportBeforeMinutes && selectedEventObj.transportBeforeMinutes > 0
        ? selectedEventObj.transportBeforeMinutes
        : 0;
    const afterMin =
      selectedEventObj.transportAfterMinutes && selectedEventObj.transportAfterMinutes > 0
        ? selectedEventObj.transportAfterMinutes
        : 0;

    return {
      meta: SCHEDULE_CATEGORY_META[selectedEventObj.category] || SCHEDULE_CATEGORY_META.other,
      durationMin: getEventDurationMinutes(selectedEventObj),
      daysText: [...selectedEventObj.daysOfWeek]
        .sort((a, b) => a - b)
        .map(d => SPANISH_WEEKDAY_SHORT[d])
        .join(' · '),
      beforeMin,
      idaRange: beforeMin > 0 ? `${minutesToHHMM(Math.max(0, startMin - beforeMin))}–${selectedEventObj.startTime}` : null,
      afterMin,
      vueltaRange:
        afterMin > 0 ? `${selectedEventObj.endTime}–${minutesToHHMM(Math.min(23 * 60 + 59, endMin + afterMin))}` : null,
      eventAccuracy,
      singleHours,
      matchedGroup,
      groupAccuracy
    };
  }, [selectedEventObj, events, resolvedAttendanceRecords, todayKey]);

  const weekStartLabel = formatChartSpanishDate(weekKeys[0]);
  const weekEndLabel = formatChartSpanishDate(weekKeys[6]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Barra superior estilo Google Calendar */}
      <div className="card" style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            style={{ width: 34, height: 34, minHeight: 34 }}
            onClick={() => onSelectDateKey(addDaysToDateKey(selectedDateKey, -7))}
            title="Semana anterior"
            aria-label="Semana anterior"
          >
            <ChevronLeft size={18} />
          </button>

          <div style={{ textAlign: 'center', minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--text-main)' }}>
              Semana {weekStartLabel} – {weekEndLabel}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
              {!weekKeys.includes(todayKey) && (
                <button
                  type="button"
                  onClick={() => onSelectDateKey(todayKey)}
                  style={{
                    background: 'rgba(6, 182, 212, 0.16)',
                    border: '1px solid rgba(6, 182, 212, 0.35)',
                    color: '#67e8f9',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '1px 7px',
                    borderRadius: '9999px',
                    cursor: 'pointer'
                  }}
                >
                  Ir a hoy
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowWeekdaysOnly(v => !v)}
                style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                  color: '#cbd5e1',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  padding: '1px 8px',
                  borderRadius: '9999px',
                  cursor: 'pointer'
                }}
              >
                {showWeekdaysOnly ? 'Vista L–V (ver L–D)' : 'Vista L–D (ver L–V)'}
              </button>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-icon"
            style={{ width: 34, height: 34, minHeight: 34 }}
            onClick={() => onSelectDateKey(addDaysToDateKey(selectedDateKey, 7))}
            title="Semana siguiente"
            aria-label="Semana siguiente"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Cuadrícula horaria Google Calendar */}
      {activeEvents.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
          <Calendar size={32} color="#06b6d4" style={{ margin: '0 auto 10px' }} />
          <div style={{ fontWeight: 700, fontSize: '0.96rem', marginBottom: '6px' }}>
            Sin eventos activos en tu calendario
          </div>
          <p className="text-muted" style={{ fontSize: '0.82rem', marginBottom: '12px' }}>
            Añade tus clases, entrenamientos o bloques diarios para verlos distribuidos por horas aquí.
          </p>
          <button type="button" className="btn btn-primary btn-sm" onClick={onCreateEvent}>
            <Plus size={16} />
            Añadir evento
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: '10px 6px 12px 6px' }}>
          {/* Cabecera fija de días de la semana */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `36px repeat(${visibleWeekDays.length}, minmax(0, 1fr))`,
              gap: '2px',
              paddingBottom: '6px',
              borderBottom: '1px solid var(--border-color)',
              marginBottom: '4px'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.6rem',
                color: '#64748b',
                fontWeight: 700
              }}
            >
              HORA
            </div>
            {dayColumns.map(col => {
              const isTodayCol = col.dateKey === todayKey;
              const isSelCol = col.dateKey === selectedDateKey;
              return (
                <button
                  key={col.dateKey}
                  type="button"
                  onClick={() => onSelectDateKey(col.dateKey)}
                  style={{
                    background: isSelCol ? 'rgba(6, 182, 212, 0.16)' : 'transparent',
                    border: isTodayCol
                      ? '1px solid #06b6d4'
                      : isSelCol
                      ? '1px solid rgba(6, 182, 212, 0.35)'
                      : '1px solid transparent',
                    borderRadius: '8px',
                    padding: '3px 1px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'pointer',
                    color: isTodayCol ? '#67e8f9' : isSelCol ? '#f8fafc' : '#94a3b8'
                  }}
                >
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, lineHeight: 1.1 }}>
                    {col.shortLabel}
                  </span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, lineHeight: 1.2 }}>
                    {col.dayNum}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Cuerpo horario proporcional */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `36px repeat(${visibleWeekDays.length}, minmax(0, 1fr))`,
              gap: '2px',
              position: 'relative',
              height: `${totalGridHeight + 12}px`,
              paddingTop: '6px'
            }}
          >
            {/* Columna de horas a la izquierda */}
            <div style={{ position: 'relative', height: `${totalGridHeight}px` }}>
              {hoursList.map((hour, idx) => (
                <div
                  key={hour}
                  style={{
                    position: 'absolute',
                    top: `${idx * HOUR_HEIGHT_PX - 6}px`,
                    right: '4px',
                    fontSize: '0.58rem',
                    fontWeight: 600,
                    color: '#64748b',
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1
                  }}
                >
                  {formatHourLabel(hour)}
                </div>
              ))}
            </div>

            {/* Columnas por día */}
            {dayColumns.map(col => {
              const isTodayCol = col.dateKey === todayKey;
              return (
                <div
                  key={col.dateKey}
                  style={{
                    position: 'relative',
                    height: `${totalGridHeight}px`,
                    background: isTodayCol
                      ? 'rgba(6, 182, 212, 0.04)'
                      : 'rgba(15, 23, 42, 0.45)',
                    borderRadius: '6px',
                    borderLeft: '1px solid rgba(148, 163, 184, 0.1)',
                    overflow: 'hidden'
                  }}
                >
                  {/* Líneas horizontales de cada hora */}
                  {hoursList.map((hour, idx) => (
                    <div
                      key={hour}
                      style={{
                        position: 'absolute',
                        top: `${idx * HOUR_HEIGHT_PX}px`,
                        left: 0,
                        right: 0,
                        borderTop: '1px solid rgba(148, 163, 184, 0.12)',
                        pointerEvents: 'none'
                      }}
                    />
                  ))}

                  {/* Línea de hora actual */}
                  {showNowLine && isTodayCol && (
                    <div
                      style={{
                        position: 'absolute',
                        top: `${nowTopPx}px`,
                        left: 0,
                        right: 0,
                        borderTop: '2px solid #f43f5e',
                        zIndex: 4,
                        pointerEvents: 'none'
                      }}
                    />
                  )}

                  {/* Bloques de eventos y transporte posicionados por intervalo horario */}
                  {col.blocks.map(block => {
                    const topPx = Math.max(
                      0,
                      ((block.startMin - startHour * 60) / 60) * HOUR_HEIGHT_PX
                    );
                    const heightPx = Math.max(
                      block.isTransport ? 16 : 20,
                      ((block.endMin - block.startMin) / 60) * HOUR_HEIGHT_PX - 1
                    );
                    const leftPct = (block.lane / block.totalLanes) * 100;
                    const widthPct = 100 / block.totalLanes;

                    const meta = block.isTransport
                      ? SCHEDULE_CATEGORY_META.transport
                      : SCHEDULE_CATEGORY_META[block.event.category] || SCHEDULE_CATEGORY_META.other;
                    const status = block.isTransport ? undefined : col.statuses[block.event.id];
                    const isInspected =
                      inspectedBlock?.blockId === block.blockId &&
                      inspectedBlock?.dateKey === col.dateKey;

                    const bg = block.isTransport
                      ? SCHEDULE_CATEGORY_META.transport.bg
                      : status === 'completed'
                      ? 'rgba(16, 185, 129, 0.28)'
                      : status === 'missed'
                      ? 'rgba(244, 63, 94, 0.24)'
                      : meta.bg;
                    const accent = block.isTransport
                      ? SCHEDULE_CATEGORY_META.transport.color
                      : status === 'completed'
                      ? '#10b981'
                      : status === 'missed'
                      ? '#f43f5e'
                      : meta.color;

                    const subtleBorder = isInspected
                      ? '1.5px solid #f8fafc'
                      : block.isTransport
                      ? '1px dashed rgba(148, 163, 184, 0.45)'
                      : '1px solid rgba(255,255,255,0.08)';

                    const blockTitle = block.isTransport
                      ? `${block.transportRole === 'before' ? 'Ida' : 'Vuelta'}: ${block.event.title}`
                      : block.event.title;

                    return (
                      <button
                        key={`${block.blockId}-${col.dateKey}`}
                        type="button"
                        onClick={() =>
                          setInspectedBlock(
                            isInspected
                              ? null
                              : {
                                  blockId: block.blockId,
                                  eventId: block.event.id,
                                  dateKey: col.dateKey,
                                  isTransport: block.isTransport,
                                  transportRole: block.transportRole,
                                  displayStartTime: block.displayStartTime,
                                  displayEndTime: block.displayEndTime
                                }
                          )
                        }
                        title={`${blockTitle} (${block.displayStartTime}–${block.displayEndTime})`}
                        style={{
                          position: 'absolute',
                          top: `${topPx + 1}px`,
                          height: `${heightPx}px`,
                          left: `calc(${leftPct}% + 1px)`,
                          width: `calc(${widthPct}% - 2px)`,
                          background: bg,
                          borderTop: subtleBorder,
                          borderRight: subtleBorder,
                          borderBottom: subtleBorder,
                          borderLeft: `3px solid ${accent}`,
                          borderRadius: '5px',
                          padding: '2px 3px',
                          textAlign: 'left',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'flex-start',
                          zIndex: isInspected ? 5 : block.isTransport ? 1 : 2,
                          color: block.isTransport ? '#e2e8f0' : '#f8fafc'
                        }}
                      >
                        <div
                          style={{
                            fontSize: showWeekdaysOnly ? '0.62rem' : '0.54rem',
                            fontWeight: block.isTransport ? 600 : 700,
                            lineHeight: 1.15,
                            display: '-webkit-box',
                            WebkitLineClamp: heightPx >= 48 ? 3 : heightPx >= 32 ? 2 : 1,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            wordBreak: 'break-word',
                            textDecoration: status === 'missed' ? 'line-through' : 'none'
                          }}
                        >
                          {block.isTransport
                            ? `🚌 ${block.transportRole === 'before' ? 'Ida' : 'Vuelta'} · ${block.event.title}`
                            : `${status === 'completed' ? '✓ ' : status === 'missed' ? '✕ ' : ''}${block.event.title}`}
                        </div>
                        {heightPx >= 34 && (
                          <div
                            style={{
                              fontSize: '0.5rem',
                              color: '#cbd5e1',
                              opacity: 0.9,
                              lineHeight: 1.1,
                              marginTop: '1px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden'
                            }}
                          >
                            {block.displayStartTime}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tarjeta de detalle rápido al pulsar una clase o desplazamiento en el calendario */}
      {selectedEventObj && inspectedBlock && selectedEventInsights && (
        <div
          className="card"
          style={{
            borderColor: inspectedBlock.isTransport
              ? 'rgba(148, 163, 184, 0.5)'
              : 'rgba(56, 189, 248, 0.5)',
            background: 'rgba(15, 23, 42, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: '0.74rem',
                  color: inspectedBlock.isTransport ? '#94a3b8' : '#38bdf8',
                  fontWeight: 700
                }}
              >
                {inspectedBlock.displayStartTime} – {inspectedBlock.displayEndTime} ·{' '}
                {formatFullSpanishDate(inspectedBlock.dateKey)}
              </div>
              <div style={{ fontWeight: 800, fontSize: '1rem', marginTop: '2px' }}>
                {inspectedBlock.isTransport
                  ? `🚌 Transporte (${inspectedBlock.transportRole === 'before' ? 'Ida a' : 'Vuelta de'}: ${selectedEventObj.title})`
                  : selectedEventObj.title}
              </div>

              {/* Etiquetas informativas del evento (categoría, días, duración, conexión) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: selectedEventInsights.meta.color,
                    background: selectedEventInsights.meta.bg,
                    padding: '2px 7px',
                    borderRadius: '9999px'
                  }}
                >
                  {selectedEventInsights.meta.label}
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: '#cbd5e1',
                    background: 'rgba(148, 163, 184, 0.16)',
                    padding: '2px 7px',
                    borderRadius: '9999px'
                  }}
                >
                  {selectedEventInsights.daysText} · {selectedEventObj.startTime}–{selectedEventObj.endTime} (
                  {formatHoursMinutesShort(selectedEventInsights.durationMin)})
                </span>
                {selectedEventInsights.matchedGroup && selectedEventInsights.matchedGroup.slotsCount > 1 && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: '#67e8f9',
                      background: 'rgba(6, 182, 212, 0.16)',
                      padding: '2px 7px',
                      borderRadius: '9999px'
                    }}
                  >
                    🔗 {selectedEventInsights.matchedGroup.slotsCount} horarios
                  </span>
                )}
              </div>

              {/* Detalle de desplazamiento Ida / Vuelta si tiene */}
              {(selectedEventInsights.beforeMin > 0 || selectedEventInsights.afterMin > 0) && (
                <div
                  style={{
                    marginTop: '6px',
                    padding: '5px 8px',
                    borderRadius: '8px',
                    background: 'rgba(148, 163, 184, 0.1)',
                    border: '1px dashed rgba(148, 163, 184, 0.3)',
                    fontSize: '0.72rem',
                    color: '#cbd5e1'
                  }}
                >
                  🚌{' '}
                  {[
                    selectedEventInsights.beforeMin > 0
                      ? `Ida ${selectedEventInsights.beforeMin}m (${selectedEventInsights.idaRange})`
                      : null,
                    selectedEventInsights.afterMin > 0
                      ? `Vuelta ${selectedEventInsights.afterMin}m (${selectedEventInsights.vueltaRange})`
                      : null
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              )}

              {inspectedBlock.isTransport && (
                <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '5px' }}>
                  Bloque complementario de desplazamiento · No computa en Accuracy
                </div>
              )}
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ minHeight: '30px', padding: '4px 9px', fontSize: '0.74rem', flexShrink: 0 }}
              onClick={() => onEditEvent(selectedEventObj)}
            >
              <Edit2 size={13} />
              Editar
            </button>
          </div>

          {/* Accuracy general y horas acumuladas del evento (y del grupo conectado si existe) */}
          {!inspectedBlock.isTransport && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  selectedEventInsights.groupAccuracy ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))',
                gap: '6px'
              }}
            >
              <div
                style={{
                  background: '#0b1120',
                  border: '1px solid var(--border-color)',
                  borderRadius: '9px',
                  padding: '6px 8px'
                }}
              >
                <div style={{ fontSize: '0.64rem', color: '#94a3b8', fontWeight: 700 }}>Accuracy general</div>
                <div
                  style={{
                    fontSize: '0.92rem',
                    fontWeight: 800,
                    color:
                      selectedEventInsights.eventAccuracy.accuracyPercent === null
                        ? '#94a3b8'
                        : selectedEventInsights.eventAccuracy.accuracyPercent >= 80
                        ? '#10b981'
                        : selectedEventInsights.eventAccuracy.accuracyPercent >= 60
                        ? '#f59e0b'
                        : '#f43f5e'
                  }}
                >
                  {selectedEventInsights.eventAccuracy.accuracyPercent !== null
                    ? `${selectedEventInsights.eventAccuracy.accuracyPercent}%`
                    : '—'}
                </div>
                <div style={{ fontSize: '0.64rem', color: '#64748b' }}>
                  {selectedEventInsights.eventAccuracy.completed}/{selectedEventInsights.eventAccuracy.expected} ses.
                </div>
              </div>

              <div
                style={{
                  background: '#0b1120',
                  border: '1px solid var(--border-color)',
                  borderRadius: '9px',
                  padding: '6px 8px'
                }}
              >
                <div style={{ fontSize: '0.64rem', color: '#94a3b8', fontWeight: 700 }}>Horas (este horario)</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#38bdf8' }}>
                  {formatHoursMinutesShort(selectedEventInsights.singleHours?.historicalMinutes || 0)}
                </div>
                <div style={{ fontSize: '0.64rem', color: '#64748b' }}>
                  Sem: {formatHoursMinutesShort(selectedEventInsights.singleHours?.weeklyMinutes || 0)}
                </div>
              </div>

              {selectedEventInsights.groupAccuracy && selectedEventInsights.matchedGroup && (
                <div
                  style={{
                    background: '#0b1120',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    borderRadius: '9px',
                    padding: '6px 8px'
                  }}
                >
                  <div style={{ fontSize: '0.64rem', color: '#67e8f9', fontWeight: 700 }}>Actividad unificada</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f8fafc' }}>
                    {selectedEventInsights.groupAccuracy.accuracyPercent !== null
                      ? `${selectedEventInsights.groupAccuracy.accuracyPercent}%`
                      : '—'}
                  </div>
                  <div style={{ fontSize: '0.64rem', color: '#94a3b8' }}>
                    Total: {formatHoursMinutesShort(selectedEventInsights.matchedGroup.historicalMinutes)}
                  </div>
                </div>
              )}
            </div>
          )}

          {!inspectedBlock.isTransport && (() => {
            const currentSt = (attendanceMap.get(inspectedBlock.dateKey) || {})[selectedEventObj.id];
            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() =>
                    onSetCheck(
                      inspectedBlock.dateKey,
                      selectedEventObj.id,
                      currentSt === 'completed' ? null : 'completed'
                    )
                  }
                  className="btn btn-sm"
                  style={{
                    minHeight: '38px',
                    background:
                      currentSt === 'completed' ? 'rgba(16, 185, 129, 0.25)' : 'var(--bg-input)',
                    border: `1px solid ${currentSt === 'completed' ? '#10b981' : 'var(--border-color)'}`,
                    color: currentSt === 'completed' ? '#6ee7b7' : 'var(--text-main)'
                  }}
                >
                  <CheckCircle2 size={15} />
                  Cumplido
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onSetCheck(
                      inspectedBlock.dateKey,
                      selectedEventObj.id,
                      currentSt === 'missed' ? null : 'missed'
                    )
                  }
                  className="btn btn-sm"
                  style={{
                    minHeight: '38px',
                    background:
                      currentSt === 'missed' ? 'rgba(244, 63, 94, 0.25)' : 'var(--bg-input)',
                    border: `1px solid ${currentSt === 'missed' ? '#f43f5e' : 'var(--border-color)'}`,
                    color: currentSt === 'missed' ? '#fda4af' : 'var(--text-muted)'
                  }}
                >
                  <XCircle size={15} />
                  No cumplido
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* Botón rápido de añadir evento debajo del calendario */}
      {activeEvents.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={onCreateEvent}>
            <Plus size={15} />
            Añadir evento al horario
          </button>
        </div>
      )}
    </div>
  );
};
