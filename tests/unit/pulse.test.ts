import { describe, expect, it } from 'vitest';
import {
  BIN,
  T_DEFAULT,
  T_MAX,
  T_MIN,
  computeState,
  defaultT,
  formatT,
  histogram,
  pulseEvents,
  type PulseEvent,
} from '../../src/lib/pulse';
import { parseWall } from '../../src/lib/time';
import { data } from './fixture';

const FRI_2330 = 2 * 1440 + 23 * 60 + 30;

describe('pulse time model (sample venue)', () => {
  // Venue 0: one party 22:00–06:00 on Fri (minutes 4200–4680). Venue 1: idle.
  const ev: PulseEvent[] = [{ v: 0, s: 4200, e: 4680 }];
  const at = (t: number) => computeState(ev, 2, t);

  it('is soon within 60 minutes before the start, not before', () => {
    expect(at(4200 - 61).soon[0]).toBe(0);
    expect(at(4200 - 60).soon[0]).toBe(1);
    expect(at(4200 - 5).soon[0]).toBe(1);
    expect(at(4200 - 5).count[0]).toBe(0);
  });

  it('starts live with a full ripple and fades in over 15 minutes', () => {
    const s = at(4200);
    expect(s.count[0]).toBe(1);
    expect(s.soon[0]).toBe(0);
    expect(s.weight[0]).toBe(0);
    expect(s.flash[0]).toBe(1);
    expect(at(4200 + 10).flash[0]).toBeCloseTo(0.5);
    expect(at(4200 + 20).flash[0]).toBe(0);
    expect(at(4200 + 7.5).weight[0]).toBeCloseTo(0.5);
    expect(at(4200 + 15).weight[0]).toBeCloseTo(1);
  });

  it('dims over the last 30 minutes and ends exactly at the end time', () => {
    expect(at(4680 - 30).weight[0]).toBeCloseTo(1);
    expect(at(4680 - 15).weight[0]).toBeCloseTo(0.65);
    expect(at(4680 - 1).weight[0]).toBeCloseTo(1 / 30 + 0.15);
    const end = at(4680);
    expect(end.count[0]).toBe(0);
    expect(end.weight[0]).toBe(0);
    expect(end.nLive).toBe(0);
  });

  it('adds up parties at the same venue', () => {
    const two = computeState(
      [
        { v: 0, s: 0, e: 600 },
        { v: 0, s: 100, e: 600 },
      ],
      1,
      300,
    );
    expect(two.count[0]).toBe(2);
    expect(two.weight[0]).toBeCloseTo(2);
    expect(two.nLive).toBe(2);
    expect(two.nVenues).toBe(1);
  });
});

describe('pulse on the real programme', () => {
  const events = pulseEvents(data.events, data.venues);

  it('has 144 parties live at 132 venues on Fri 23:30', () => {
    const s = computeState(events, data.venues.length, FRI_2330);
    expect(s.nLive).toBe(144);
    expect(s.nVenues).toBe(132);
  });

  it('builds 10-minute histogram bins over the whole timeline', () => {
    const bins = histogram(events);
    expect(bins).toHaveLength((T_MAX - T_MIN) / BIN + 1);
    expect(bins[(FRI_2330 - T_MIN) / BIN]).toBe(144);
    // Each bin equals a direct count at that minute.
    for (const m of [T_MIN, 1500, 3000, 6000, T_MAX]) {
      expect(bins[(m - T_MIN) / BIN]).toBe(computeState(events, data.venues.length, m).nLive);
    }
    expect(Math.max(...bins)).toBeGreaterThan(144);
  });
});

describe('pulse clock', () => {
  it('formats festival minutes', () => {
    expect(formatT(FRI_2330)).toBe('Fri 23 · 23:30');
    expect(formatT(T_MIN)).toBe('Wed 21 · 12:00');
    expect(formatT(T_MAX)).toBe('Mon 26 · 08:00');
  });

  it('defaults to now during the festival, otherwise Wed 21 14:00', () => {
    expect(defaultT(parseWall('2026-10-23 23:30'))).toBe(FRI_2330);
    expect(defaultT(parseWall('2026-10-08 12:00'))).toBe(T_DEFAULT);
    expect(defaultT(parseWall('2026-10-27 12:00'))).toBe(T_DEFAULT);
  });
});
