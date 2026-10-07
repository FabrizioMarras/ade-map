import { DAYS } from './time';
import type { DayKey } from './types';

export type DayScope = DayKey | 'all' | 'fav';

export interface HashState {
  day?: DayScope;
  event?: number;
  venue?: string;
  /** Pulse mode time in festival minutes (present = Pulse mode on). */
  pulse?: number;
}

/** `#d=24&e=2843412&v=40620&p=4290` ↔ state. */
export function parseHash(hash: string): HashState {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const out: HashState = {};
  const d = p.get('d');
  if (d === 'all' || d === 'fav') out.day = d;
  else if (d) {
    const day = DAYS.find((x) => x.num === d);
    if (day) out.day = day.key;
  }
  const e = Number(p.get('e'));
  if (Number.isFinite(e) && e > 0) out.event = e;
  const v = p.get('v');
  if (v) out.venue = v;
  const pt = p.get('p');
  if (pt !== null && pt !== '' && Number.isFinite(Number(pt))) out.pulse = Number(pt);
  return out;
}

export function formatHash(s: HashState): string {
  const p = new URLSearchParams();
  if (s.day)
    p.set('d', s.day === 'all' || s.day === 'fav' ? s.day : (DAYS.find((x) => x.key === s.day)?.num ?? ''));
  if (s.venue) p.set('v', s.venue);
  if (s.event) p.set('e', String(s.event));
  if (s.pulse !== undefined) p.set('p', String(Math.round(s.pulse)));
  return '#' + p.toString();
}
