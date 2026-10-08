import { describe, expect, it } from 'vitest';
import {
  defaultDay,
  nowWall,
  parseWall,
  shortRange,
  status,
  statusLabel,
  timeRange,
} from '../../src/lib/time';

const ev = (start: string, end: string, showEnd = true) => {
  const startMs = parseWall(start);
  const endMs = showEnd ? parseWall(end) : startMs + 6 * 3600_000;
  return { start, end, showEnd, startMs, endMs };
};

describe('time', () => {
  it('parses wall-clock times independent of the device zone', () => {
    expect(new Date(parseWall('2026-10-24 23:00')).toISOString()).toBe('2026-10-24T23:00:00.000Z');
  });

  it('converts an instant to Amsterdam wall clock (CEST and CET)', () => {
    expect(nowWall(new Date('2026-10-24T21:30:00Z'))).toBe(parseWall('2026-10-24 23:30'));
    expect(nowWall(new Date('2026-10-26T12:00:00Z'))).toBe(parseWall('2026-10-26 13:00'));
  });

  it('computes status', () => {
    const e = ev('2026-10-24 23:00', '2026-10-25 07:00');
    expect(status(e, parseWall('2026-10-24 18:00'))).toBe('upcoming');
    expect(status(e, parseWall('2026-10-24 21:30'))).toBe('soon');
    expect(status(e, parseWall('2026-10-25 02:00'))).toBe('live');
    expect(status(e, parseWall('2026-10-25 07:00'))).toBe('ended');
    expect(statusLabel(e, parseWall('2026-10-24 21:00'))).toBe('Starts in 2 h');
    expect(statusLabel(e, parseWall('2026-10-24 22:15'))).toBe('Starts in 45 min');
  });

  it('formats overnight ranges', () => {
    const e = ev('2026-10-24 23:00', '2026-10-25 07:00');
    expect(timeRange(e)).toBe('Sat 24 · 23:00 → 07:00 Sun');
    expect(shortRange(e)).toBe('23:00 → 07:00 Sun');
    expect(shortRange(ev('2026-10-21 14:00', '2026-10-21 23:30'))).toBe('14:00–23:30');
    expect(shortRange(ev('2026-10-23 18:00', '2026-10-24 00:00'))).toBe('18:00 → 00:00 Sat');
    expect(shortRange(ev('2026-10-21 14:00', '2026-10-21 23:30', false))).toBe('14:00');
    expect(
      shortRange({ startMs: parseWall('2026-10-23 00:00'), end: '2026-10-23 00:00', showEnd: true }),
    ).toBe('00:00');
    expect(timeRange(ev('2026-10-21 14:00', '2026-10-21 23:30'))).toBe('Wed 21 · 14:00 → 23:30');
    expect(timeRange(ev('2026-10-21 14:00', '2026-10-21 23:30', false))).toBe('Wed 21 · 14:00');
  });

  it('defaults to today during the festival, otherwise Wed 21', () => {
    expect(defaultDay(parseWall('2026-10-23 12:00'))).toBe('2026-10-23');
    expect(defaultDay(parseWall('2026-10-07 12:00'))).toBe('2026-10-21');
  });
});
