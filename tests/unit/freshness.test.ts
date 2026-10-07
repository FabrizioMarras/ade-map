import { describe, expect, it } from 'vitest';
import { pageMaxAgeHours } from '../../scripts/fetch-event-pages.mjs';
import { programmeChanged } from '../../src/lib/data';
import { asOfLabel, parseWall } from '../../src/lib/time';

describe('asOfLabel (Amsterdam time)', () => {
  const now = parseWall('2026-10-23 16:00');
  it('says today / yesterday / a date', () => {
    expect(asOfLabel('2026-10-23T12:30:00Z', now)).toBe('14:30 today'); // CEST = UTC+2
    expect(asOfLabel('2026-10-22T21:10:00Z', now)).toBe('23:10 yesterday');
    expect(asOfLabel('2026-10-07T16:48:45Z', now)).toBe('Wed 7 Oct, 18:48');
  });
  it('handles the switch to winter time', () => {
    expect(asOfLabel('2026-10-26T13:30:00Z', parseWall('2026-10-26 15:00'))).toBe('14:30 today'); // CET = UTC+1
  });
});

describe('programmeChanged', () => {
  it('compares fingerprints when both sides have one', () => {
    expect(programmeChanged({ generated: 'a', hash: 'x' }, { generated: 'b', hash: 'x' })).toBe(false);
    expect(programmeChanged({ generated: 'a', hash: 'x' }, { generated: 'b', hash: 'y' })).toBe(true);
  });
  it('falls back to the timestamp for older data files', () => {
    expect(programmeChanged({ generated: 'a' }, { generated: 'a', hash: 'x' })).toBe(false);
    expect(programmeChanged({ generated: 'a' }, { generated: 'b', hash: 'x' })).toBe(true);
  });
});

describe('pageMaxAgeHours', () => {
  const ev = (start: string, end: string) => ({
    start_date_time: { date: start },
    end_date_time: { date: end },
  });
  const now = parseWall('2026-10-23 12:00');
  it('re-reads parties in the next 36 h on every run', () => {
    expect(pageMaxAgeHours(ev('2026-10-23 22:00:00', '2026-10-24 06:00:00'), now)).toBe(1.5);
    expect(pageMaxAgeHours(ev('2026-10-23 10:00:00', '2026-10-23 18:00:00'), now)).toBe(1.5); // live now
  });
  it('re-reads later parties daily and skips finished ones', () => {
    expect(pageMaxAgeHours(ev('2026-10-25 22:00:00', '2026-10-26 06:00:00'), now)).toBe(20);
    expect(pageMaxAgeHours(ev('2026-10-21 14:00:00', '2026-10-21 23:00:00'), now)).toBe(168);
  });
});
