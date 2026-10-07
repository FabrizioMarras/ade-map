import { describe, expect, it } from 'vitest';
import { data, raw } from './fixture';

describe('indexData', () => {
  it('indexes every event and venue', () => {
    expect(data.events).toHaveLength(1263);
    expect(data.venuesById.size).toBe(317);
    expect(data.events.every((e) => e.venue && Number.isFinite(e.venue.lat))).toBe(true);
  });

  it('groups events by start day', () => {
    const counts = [...data.eventsByDay.entries()].map(([k, v]) => [k, v.length]);
    expect(counts).toEqual([
      ['2026-10-21', 161],
      ['2026-10-22', 297],
      ['2026-10-23', 335],
      ['2026-10-24', 316],
      ['2026-10-25', 154],
    ]);
  });

  it('detects overnight events', () => {
    expect(data.events.filter((e) => e.overnight)).toHaveLength(504);
  });

  it('groups events by venue, sorted by start', () => {
    const total = [...data.eventsByVenue.values()].reduce((n, l) => n + l.length, 0);
    expect(total).toBe(1263);
    for (const list of data.eventsByVenue.values()) {
      for (let i = 1; i < list.length; i++)
        expect(list[i].startMs).toBeGreaterThanOrEqual(list[i - 1].startMs);
    }
  });

  it('uses start + 6 h when the end is hidden', () => {
    const hidden = data.events.filter((e) => !e.showEnd);
    expect(hidden.length).toBeGreaterThan(0);
    for (const e of hidden) expect(e.endMs - e.startMs).toBe(6 * 3600_000);
  });

  it('marks free events', () => {
    const free = raw.events.filter((e) =>
      e.interests.some((t) => t === 'Free Festival Events' || t === 'Free A&C Events'),
    ).length;
    expect(data.events.filter((e) => e.free)).toHaveLength(free);
  });
});
