import type { DayKey } from './types';

export const TZ = 'Europe/Amsterdam';
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
/** Assumed duration when an event hides its end time. */
export const HIDDEN_END_DURATION = 6 * HOUR;
export const SOON_WINDOW = 2 * HOUR;

export interface FestivalDay {
  key: DayKey;
  short: string; // "Fri 23"
  num: string; // "23" — used in the URL hash
}

export const DAYS: FestivalDay[] = [
  { key: '2026-10-21', short: 'Wed 21', num: '21' },
  { key: '2026-10-22', short: 'Thu 22', num: '22' },
  { key: '2026-10-23', short: 'Fri 23', num: '23' },
  { key: '2026-10-24', short: 'Sat 24', num: '24' },
  { key: '2026-10-25', short: 'Sun 25', num: '25' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Parse "YYYY-MM-DD HH:mm" as a wall-clock timestamp: the Amsterdam local time is
 * encoded as if it were UTC, so comparisons never depend on the device time zone.
 */
export function parseWall(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s);
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
}

/** Current Amsterdam wall-clock time in the same encoding as `parseWall`. */
export function nowWall(date: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t: string) => +(parts.find((p) => p.type === t)?.value ?? 0);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
}

export function dayKeyOf(wall: number): DayKey {
  return new Date(wall).toISOString().slice(0, 10);
}

export function hhmm(wall: number): string {
  return new Date(wall).toISOString().slice(11, 16);
}

export function dayShort(wall: number): string {
  const d = new Date(wall);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()}`;
}

export function festivalDay(key: DayKey): FestivalDay | undefined {
  return DAYS.find((d) => d.key === key);
}

/** Default day on open: today when inside the festival, otherwise the first day. */
export function defaultDay(now = nowWall()): DayKey {
  const today = dayKeyOf(now);
  return festivalDay(today) ? today : DAYS[0].key;
}

export function isFestivalTime(now = nowWall()): boolean {
  return !!festivalDay(dayKeyOf(now)) || dayKeyOf(now - 8 * HOUR) === DAYS[DAYS.length - 1].key;
}

export type Status = 'upcoming' | 'soon' | 'live' | 'ended';

export function status(ev: { startMs: number; endMs: number }, now = nowWall()): Status {
  if (now >= ev.endMs) return 'ended';
  if (now >= ev.startMs) return 'live';
  if (ev.startMs - now <= SOON_WINDOW) return 'soon';
  return 'upcoming';
}

function duration(ms: number): string {
  const mins = Math.round(ms / MINUTE);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 24) return `${Math.round(h / 24)} d`;
  return m && h < 3 ? `${h} h ${m} min` : `${h} h`;
}

export function statusLabel(ev: { startMs: number; endMs: number }, now = nowWall()): string {
  switch (status(ev, now)) {
    case 'ended':
      return 'Ended';
    case 'live':
      return 'Live now';
    default:
      return `Starts in ${duration(ev.startMs - now)}`;
  }
}

/** "Sat 24 · 23:00 → 07:00 Sun" */
export function timeRange(ev: { startMs: number; end: string; showEnd: boolean }): string {
  const start = `${dayShort(ev.startMs)} · ${hhmm(ev.startMs)}`;
  if (!ev.showEnd) return start;
  const end = parseWall(ev.end);
  const sameDay = dayKeyOf(end) === dayKeyOf(ev.startMs);
  return `${start} → ${hhmm(end)}${sameDay ? '' : ' ' + WEEKDAYS[new Date(end).getUTCDay()]}`;
}

/** Short "23:00–07:00" used on cards. */
/** Card time: "14:00–23:30", or for overnight parties "23:00 → 07:00 Sun". */
export function shortRange(ev: { startMs: number; end: string; showEnd: boolean }): string {
  if (!ev.showEnd) return hhmm(ev.startMs);
  const end = parseWall(ev.end);
  if (!(end > ev.startMs)) return hhmm(ev.startMs); // no usable end (e.g. "00:00–00:00")
  if (dayKeyOf(end) === dayKeyOf(ev.startMs)) return `${hhmm(ev.startMs)}–${hhmm(end)}`;
  return `${hhmm(ev.startMs)} → ${hhmm(end)} ${WEEKDAYS[new Date(end).getUTCDay()]}`;
}

export function overlaps(a: { startMs: number; endMs: number }, b: { startMs: number; endMs: number }) {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "14:30 today", "23:10 yesterday" or "Wed 21 Oct, 14:30" — Amsterdam time. */
export function asOfLabel(iso: string, now = nowWall()): string {
  const at = nowWall(new Date(iso));
  if (!Number.isFinite(at)) return '';
  const day = dayKeyOf(at);
  if (day === dayKeyOf(now)) return `${hhmm(at)} today`;
  if (day === dayKeyOf(now - 24 * HOUR)) return `${hhmm(at)} yesterday`;
  const d = new Date(at);
  return `${dayShort(at)} ${MONTHS[d.getUTCMonth()]}, ${hhmm(at)}`;
}
