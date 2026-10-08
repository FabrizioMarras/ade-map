import { describe, expect, it } from 'vitest';
import { eventsToIcs, fold, icsText } from '../../src/lib/ics';
import { data } from './fixture';

/** Minimal RFC 5545 reader: unfold lines, collect VEVENT properties (name + params → value). */
function parse(text: string) {
  expect(text.endsWith('\r\n')).toBe(true);
  const lines = text.replace(/\r\n /g, '').split('\r\n').filter(Boolean);
  for (const l of lines) expect(new TextEncoder().encode(l).length).toBeGreaterThan(0);
  const events: Record<string, string>[] = [];
  let cur: Record<string, string> | null = null;
  const stack: string[] = [];
  for (const line of lines) {
    if (line.startsWith('BEGIN:')) {
      stack.push(line.slice(6));
      if (line === 'BEGIN:VEVENT') cur = {};
      continue;
    }
    if (line.startsWith('END:')) {
      expect(stack.pop()).toBe(line.slice(4));
      if (line === 'END:VEVENT') {
        events.push(cur!);
        cur = null;
      }
      continue;
    }
    const i = line.indexOf(':');
    if (cur) cur[line.slice(0, i)] = line.slice(i + 1);
  }
  expect(stack).toEqual([]);
  return { lines, events };
}

const ids = [2892764, 2863536, 2843412]; // Paradiso Fri 18:30, NDSM Fri 23:00 → Sat 06:00, Wed 14:00
const starred = ids.map((id) => data.eventsById.get(id)!);

describe('.ics export', () => {
  const { lines, events } = parse(eventsToIcs(starred, new Date('2026-10-08T10:15:00Z')));

  it('is a valid calendar with a Europe/Amsterdam time zone', () => {
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('VERSION:2.0');
    expect(lines).toContain('TZID:Europe/Amsterdam');
    expect(lines.at(-1)).toBe('END:VCALENDAR');
  });

  it('has one VEVENT per starred party, sorted by start, with UID/DTSTART/DTEND/TZID', () => {
    expect(events).toHaveLength(3);
    expect(events.map((e) => e.UID)).toEqual([
      'ade2026-2843412@fabriziomarras.github.io',
      'ade2026-2892764@fabriziomarras.github.io',
      'ade2026-2863536@fabriziomarras.github.io',
    ]);
    for (const e of events) {
      expect(e['DTSTART;TZID=Europe/Amsterdam']).toMatch(/^\d{8}T\d{6}$/);
      expect(e['DTEND;TZID=Europe/Amsterdam']).toMatch(/^\d{8}T\d{6}$/);
      expect(e.DTSTAMP).toBe('20261008T101500Z');
    }
    // Wall-clock times as listed by ADE; an overnight party ends the next day.
    expect(events[1]['DTSTART;TZID=Europe/Amsterdam']).toBe('20261023T183000');
    expect(events[1]['DTEND;TZID=Europe/Amsterdam']).toBe('20261023T223000');
    expect(events[2]['DTSTART;TZID=Europe/Amsterdam']).toBe('20261023T230000');
    expect(events[2]['DTEND;TZID=Europe/Amsterdam']).toBe('20261024T060000');
  });

  it('carries title, venue + address and the ADE link', () => {
    const deewee = events[1];
    expect(deewee.SUMMARY).toContain('DEEWEE: 2manydjs + Charlotte Adigéry & Bolis Pupul');
    expect(deewee.LOCATION).toBe('Paradiso\\, Weteringschans 6-8\\, Amsterdam');
    expect(deewee.DESCRIPTION).toContain('https://www.amsterdam-dance-event.nl/');
    expect(deewee.URL).toMatch(/^https:\/\/www\.amsterdam-dance-event\.nl\/.+2892764\/$/);
  });

  it('escapes text and folds long lines at 75 octets', () => {
    expect(icsText('a, b; c\\d\ne')).toBe('a\\, b\\; c\\\\d\\ne');
    const long = 'DESCRIPTION:' + 'é'.repeat(80);
    const folded = fold(long);
    for (const l of folded.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe(long);
  });
});
