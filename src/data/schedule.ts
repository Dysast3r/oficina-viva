/**
 * Horario laboral de la oficina, en hora de Chile. Define cuándo se puede
 * marcar la llegada, qué días cuentan para la racha y los objetivos, y si la
 * oficina está "abierta" en el mundo.
 */

import { hash } from './progress';

export const TIME_ZONE = 'America/Santiago';

export interface Shift {
  /** Minutos desde medianoche. */
  start: number;
  end: number;
}

const hm = (h: number, m: number) => h * 60 + m;

/** Índice = día de la semana (0 domingo … 6 sábado); null = no se trabaja. */
export const WORK_WEEK: (Shift | null)[] = [
  null,
  { start: hm(8, 30), end: hm(18, 0) },
  { start: hm(8, 30), end: hm(18, 0) },
  { start: hm(8, 30), end: hm(18, 0) },
  { start: hm(8, 30), end: hm(18, 0) },
  { start: hm(8, 30), end: hm(16, 45) },
  null,
];

/** Se puede marcar la llegada desde media hora antes del inicio. */
export const CHECKIN_EARLY_MIN = 30;

/** Colación: todos al casino a almorzar, todos los días laborales. */
export const LUNCH: Shift = { start: hm(15, 0), end: hm(16, 0) };

/** Pausa para estirar las piernas: una por hora, de 10 a 15 minutos. */
export const BREAK_MIN = 10;
export const BREAK_MAX = 15;

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const partsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Día de la semana y minuto del día en la oficina para un instante. */
export function officeClock(ts: number): { weekday: number; minutes: number } {
  const p = Object.fromEntries(partsFormat.formatToParts(ts).map((x) => [x.type, x.value]));
  return { weekday: WEEKDAY[p.weekday] ?? 0, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

export function shiftOn(weekday: number): Shift | null {
  return WORK_WEEK[weekday] ?? null;
}

/** Día de la semana de una fecha "AAAA-MM-DD" (sin depender de la zona horaria). */
export function weekdayOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isWorkDay(day: string): boolean {
  return shiftOn(weekdayOf(day)) !== null;
}

/** Día laboral anterior a `day` (para la racha: el fin de semana no la corta). */
export function previousWorkDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  for (let i = 0; i < 7; i++) {
    t.setUTCDate(t.getUTCDate() - 1);
    if (shiftOn(t.getUTCDay()) !== null) return t.toISOString().slice(0, 10);
  }
  return t.toISOString().slice(0, 10);
}

export function isWorkTime(ts: number): boolean {
  const { weekday, minutes } = officeClock(ts);
  const s = shiftOn(weekday);
  return s !== null && minutes >= s.start && minutes < s.end;
}

export function isLunchTime(ts: number): boolean {
  const { weekday, minutes } = officeClock(ts);
  const s = shiftOn(weekday);
  return s !== null && minutes >= LUNCH.start && minutes < LUNCH.end && minutes < s.end;
}

/**
 * ¿Le toca la pausa de la hora a esta persona? El equipo (`ids`) se reparte
 * parejo en la hora, así nunca salen todos juntos, y cada navegador calcula lo
 * mismo. La duración (10 a 15 minutos) es fija para cada persona. No hay
 * pausas durante la colación.
 */
export function isOnBreak(id: string, ids: string[], ts: number): boolean {
  if (!isWorkTime(ts) || isLunchTime(ts)) return false;
  const team = [...ids].sort();
  const index = team.indexOf(id);
  if (index < 0) return false;
  const h = hash(`pausa:${id}`);
  const offset = (Math.floor((index * 60) / team.length) + (h % 3)) % 60;
  const length = BREAK_MIN + ((h >>> 8) % (BREAK_MAX - BREAK_MIN + 1));
  const { minutes } = officeClock(ts);
  return (((minutes - offset) % 60) + 60) % 60 < length;
}

export function canCheckInAt(ts: number): boolean {
  const { weekday, minutes } = officeClock(ts);
  const s = shiftOn(weekday);
  return s !== null && minutes >= s.start - CHECKIN_EARLY_MIN && minutes < s.end;
}

export function fmtMinutes(min: number): string {
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
}

/** Texto para el HUD: "Jornada 8:30 – 18:00" o "Fuera de horario · vuelve el lunes 8:30". */
export function scheduleStatus(ts: number): { open: boolean; text: string } {
  const { weekday, minutes } = officeClock(ts);
  const s = shiftOn(weekday);
  if (s !== null && minutes >= s.start && minutes < s.end) {
    if (minutes >= LUNCH.start && minutes < LUNCH.end) return { open: true, text: `🍽️ Colación hasta las ${fmtMinutes(LUNCH.end)}` };
    return { open: true, text: `Jornada ${fmtMinutes(s.start)} – ${fmtMinutes(s.end)}` };
  }
  if (s !== null && minutes < s.start) return { open: false, text: `Abre hoy a las ${fmtMinutes(s.start)}` };
  for (let i = 1; i <= 7; i++) {
    const wd = (weekday + i) % 7;
    const next = shiftOn(wd);
    if (next !== null) {
      const when = i === 1 ? 'mañana' : `el ${DAY_NAMES[wd]}`;
      return { open: false, text: `Fuera de horario · vuelve ${when} ${fmtMinutes(next.start)}` };
    }
  }
  return { open: false, text: 'Fuera de horario' };
}

/** Por qué no se puede marcar ahora (o null si se puede). */
export function checkInBlockedReason(ts: number): string | null {
  if (canCheckInAt(ts)) return null;
  const { weekday, minutes } = officeClock(ts);
  const s = shiftOn(weekday);
  if (s === null) return 'Hoy no es día laboral.';
  if (minutes < s.start - CHECKIN_EARLY_MIN) return `Puedes marcar desde las ${fmtMinutes(s.start - CHECKIN_EARLY_MIN)}.`;
  return `La jornada de hoy terminó a las ${fmtMinutes(s.end)}.`;
}
