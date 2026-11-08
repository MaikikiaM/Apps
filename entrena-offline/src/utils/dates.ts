// src/utils/dates.ts
// Manejo seguro y determinista de fechas locales 'YYYY-MM-DD'

export function toLocalDateKey(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDateKey(key: string): Date {
  const [yearStr, monthStr, dayStr] = key.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  return new Date(year, month, day, 12, 0, 0, 0); // Mediodía para evitar cualquier salto DST
}

export function formatFriendlyDate(key: string): string {
  const date = parseLocalDateKey(key);
  const todayKey = toLocalDateKey(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayKey = toLocalDateKey(yesterdayDate);
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowKey = toLocalDateKey(tomorrowDate);

  if (key === todayKey) return 'Hoy';
  if (key === yesterdayKey) return 'Ayer';
  if (key === tomorrowKey) return 'Mañana';

  const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const dayName = daysOfWeek[date.getDay()];
  const dayNum = date.getDate();
  const monthName = months[date.getMonth()];
  return `${dayName}, ${dayNum} ${monthName}`;
}

export function formatFullSpanishDate(key: string): string {
  const date = parseLocalDateKey(key);
  const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  return `${daysOfWeek[date.getDay()]}, ${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
}

export function addDaysToDateKey(key: string, days: number): string {
  const d = parseLocalDateKey(key);
  d.setDate(d.getDate() + days);
  return toLocalDateKey(d);
}

export function daysBetween(keyA: string, keyB: string): number {
  const dateA = parseLocalDateKey(keyA);
  const dateB = parseLocalDateKey(keyB);
  const diffMs = dateB.getTime() - dateA.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// Genera una secuencia consecutiva de claves 'YYYY-MM-DD' entre startKey y endKey inclusive
export function getDateRangeSequence(startKey: string, endKey: string): string[] {
  const result: string[] = [];
  let current = startKey;
  while (current <= endKey) {
    result.push(current);
    current = addDaysToDateKey(current, 1);
  }
  return result;
}

// Información para la cuadrícula del calendario mensual (lunes a domingo)
export interface MonthCalendarCell {
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
}

export function getMonthCalendarGrid(year: number, month: number): MonthCalendarCell[] {
  // month es 0-11
  const todayKey = toLocalDateKey(new Date());
  const firstDayOfMonth = new Date(year, month, 1, 12, 0, 0);
  const lastDayOfMonth = new Date(year, month + 1, 0, 12, 0, 0);

  // En JavaScript: 0 = domingo, 1 = lunes, ..., 6 = sábado
  // Queremos que la semana empiece en Lunes (0) y termine en Domingo (6)
  const firstDayWeekday = (firstDayOfMonth.getDay() + 6) % 7; // 0 = lunes, 6 = domingo
  const daysInMonth = lastDayOfMonth.getDate();

  const cells: MonthCalendarCell[] = [];

  // Días del mes anterior para completar la primera semana
  for (let i = firstDayWeekday - 1; i >= 0; i--) {
    const prevDate = new Date(year, month, -i, 12, 0, 0);
    const key = toLocalDateKey(prevDate);
    cells.push({
      dateKey: key,
      dayNumber: prevDate.getDate(),
      isCurrentMonth: false,
      isToday: key === todayKey,
      isWeekend: prevDate.getDay() === 0 || prevDate.getDay() === 6
    });
  }

  // Días del mes actual
  for (let d = 1; d <= daysInMonth; d++) {
    const currDate = new Date(year, month, d, 12, 0, 0);
    const key = toLocalDateKey(currDate);
    cells.push({
      dateKey: key,
      dayNumber: d,
      isCurrentMonth: true,
      isToday: key === todayKey,
      isWeekend: currDate.getDay() === 0 || currDate.getDay() === 6
    });
  }

  // Días del mes siguiente para completar cuadrícula de 7 columnas
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let j = 1; j <= remaining; j++) {
      const nextDate = new Date(year, month + 1, j, 12, 0, 0);
      const key = toLocalDateKey(nextDate);
      cells.push({
        dateKey: key,
        dayNumber: j,
        isCurrentMonth: false,
        isToday: key === todayKey,
        isWeekend: nextDate.getDay() === 0 || nextDate.getDay() === 6
      });
    }
  }

  return cells;
}
