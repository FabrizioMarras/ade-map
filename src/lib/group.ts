import { dayShort, hhmm } from './time';
import type { AdeEvent } from './types';

export interface Group {
  key: string;
  label: string;
  events: AdeEvent[];
  divider?: boolean;
}

/** Group events (already sorted by start) by start hour; across days the label carries the day. */
export function groupByHour(events: AdeEvent[], withDay: boolean): Group[] {
  const groups: Group[] = [];
  let cur: Group | undefined;
  for (const e of events) {
    const hourStart = e.startMs - (e.startMs % 3_600_000);
    const key = `${e.day}-${hhmm(hourStart)}`;
    if (cur?.key !== key) {
      cur = {
        key,
        label: withDay ? `${dayShort(e.startMs)} · ${hhmm(hourStart)}` : hhmm(hourStart),
        events: [],
      };
      groups.push(cur);
    }
    cur.events.push(e);
  }
  return groups;
}

export function nextDay(day: string): string {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
