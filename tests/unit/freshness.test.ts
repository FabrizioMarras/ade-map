import { describe, expect, it } from 'vitest';
import { pageMaxAgeHours } from '../../scripts/fetch-event-pages.mjs';
import { programmeChanged } from '../../src/lib/data';
import { asOfLabel, parseWall, staleNotice } from '../../src/lib/time';

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
  it('parties starting within 12 h (or on now): 6 h', () => {
    expect(pageMaxAgeHours(ev('2026-10-23 22:00:00', '2026-10-24 06:00:00'), now)).toBe(6);
    expect(pageMaxAgeHours(ev('2026-10-23 23:59:00', '2026-10-24 06:00:00'), now)).toBe(6);
    expect(pageMaxAgeHours(ev('2026-10-23 10:00:00', '2026-10-23 18:00:00'), now)).toBe(6); // live now
  });
  it('other upcoming parties: 24 h', () => {
    expect(pageMaxAgeHours(ev('2026-10-24 00:00:00', '2026-10-24 06:00:00'), now)).toBe(24); // 12 h away
    expect(pageMaxAgeHours(ev('2026-10-25 22:00:00', '2026-10-26 06:00:00'), now)).toBe(24);
  });
  it('ended: re-read for 6 h, then never', () => {
    expect(pageMaxAgeHours(ev('2026-10-22 23:00:00', '2026-10-23 07:00:00'), now)).toBe(6); // ended 5 h ago
    expect(pageMaxAgeHours(ev('2026-10-22 22:00:00', '2026-10-23 05:00:00'), now)).toBe(Infinity);
    expect(pageMaxAgeHours(ev('2026-10-21 14:00:00', '2026-10-21 23:00:00'), now)).toBe(Infinity);
  });
});

describe('staleNotice', () => {
  it('warns during the festival when the programme is more than 6 h old', () => {
    const now = new Date('2026-10-23T18:00:00Z');
    expect(staleNotice('2026-10-23T12:30:00Z', now)).toBeNull(); // 5.5 h
    expect(staleNotice('2026-10-23T11:00:00Z', now)).toBe('Programme last updated 7 h ago');
    expect(staleNotice('2026-10-21T18:00:00Z', now)).toBe('Programme last updated 48 h ago');
  });
  it('stays quiet outside 21–25 Oct and for unreadable dates', () => {
    expect(staleNotice('2026-10-08T10:36:00Z', new Date('2026-10-20T12:00:00Z'))).toBeNull();
    expect(staleNotice('2026-10-20T10:00:00Z', new Date('2026-10-26T12:00:00Z'))).toBeNull();
    expect(staleNotice('2026-10-08T10:36:00Z', new Date('2026-10-20T22:30:00Z'))).toBe(
      'Programme last updated 299 h ago',
    ); // already Wed 21 Oct 00:30 in Amsterdam
    expect(staleNotice('', new Date('2026-10-23T18:00:00Z'))).toBeNull();
  });
  it('counts real hours across the switch to winter time', () => {
    // Sat 24 Oct 23:00 CEST → Sun 25 Oct 07:00 CET: 9 real hours.
    expect(staleNotice('2026-10-24T21:00:00Z', new Date('2026-10-25T06:00:00Z'))).toBe(
      'Programme last updated 9 h ago',
    );
  });
});
