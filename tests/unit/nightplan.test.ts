import { describe, expect, it } from 'vitest';
import type { LngLat } from '../../src/lib/geo';
import {
  CLASH_MINUTES,
  DETOUR,
  defaultNight,
  isNorthOfIJ,
  nightStops,
  planNight,
} from '../../src/lib/nightplan';
import { distanceM } from '../../src/lib/planb';
import { parseWall } from '../../src/lib/time';
import type { AdeEvent } from '../../src/lib/types';
import { data } from './fixture';

const PLACES: Record<string, LngLat> = {
  Paradiso: [4.8839, 52.3623],
  Melkweg: [4.8811, 52.3647],
  Shelter: [4.9017, 52.3843], // Overhoeks, north of the IJ
  NDSM: [4.8928, 52.3997],
  Rembrandtplein: [4.8966, 52.3662],
};

let id = 0;
function ev(place: keyof typeof PLACES, start: string, end: string, title = `E${++id}`): AdeEvent {
  const [lng, lat] = PLACES[place];
  return {
    id: ++id,
    title,
    startMs: parseWall(start),
    endMs: parseWall(end),
    venue: { id: place, name: place, lng, lat },
  } as AdeEvent;
}

describe('which side of the IJ', () => {
  it('puts Noord, NDSM and Overhoeks north; Houthavens, IJdok and the centre south', () => {
    const byName = (n: string) => data.venues.find((v) => v.name === n)!;
    for (const n of [
      'NDSM',
      'Pllek',
      'Noorderlicht',
      "A'DAM Toren",
      'Shelter',
      'Klaproos',
      'Het Veronica Schip',
    ])
      expect(isNorthOfIJ(byName(n).lng, byName(n).lat), n).toBe(true);
    for (const n of [
      'Paradiso',
      'Theater Amsterdam', // Danzigerkade, Houthavens
      'THE OTHER SIDE', // Rigakade
      'Mediahaven', // Moermanskkade
      'Comedy Cafe Amsterdam', // IJdok, next to Centraal
      "Muziekgebouw aan 't IJ",
      'Thuishaven',
    ])
      expect(isNorthOfIJ(byName(n).lng, byName(n).lat), n).toBe(false);
  });
});

describe('planNight', () => {
  it('orders a night by start time, from 06:00 to 06:00', () => {
    const late = ev('NDSM', '2026-10-24 01:00', '2026-10-24 07:00'); // Sat 01:00 = Friday night
    const early = ev('Paradiso', '2026-10-23 20:00', '2026-10-23 23:30');
    const mid = ev('Melkweg', '2026-10-23 23:00', '2026-10-24 04:00');
    const nextNight = ev('Paradiso', '2026-10-24 22:00', '2026-10-25 04:00');
    const stops = nightStops([late, mid, nextNight, early], '2026-10-23');
    expect(stops.map((s) => s.id)).toEqual([early.id, mid.id, late.id]);
  });

  it('computes leg distance (straight line × 1.25) and walking/bike minutes', () => {
    const a = ev('Paradiso', '2026-10-23 20:00', '2026-10-23 23:00');
    const b = ev('Rembrandtplein', '2026-10-23 23:30', '2026-10-24 03:00');
    const metres = distanceM(PLACES.Paradiso, PLACES.Rembrandtplein) * DETOUR;
    const [walk] = planNight([a, b], 'walk');
    expect(walk.metres).toBeCloseTo(metres, 3);
    expect(walk.minutes).toBe(Math.ceil(metres / 80));
    expect(planNight([a, b], 'bike')[0].minutes).toBe(Math.ceil(metres / 250));
    // Leave in time to arrive as the next party starts (A ended earlier, so leave at A's end).
    expect(walk.leave).toBe(a.endMs);
    expect(walk.arrive).toBe(a.endMs + walk.minutes * 60_000);
    expect(walk.infeasible).toBe(false);
    expect(walk.clashMinutes).toBe(0);
    expect(walk.ferry).toBeNull();
  });

  it('flags clashes only above 30 minutes of overlap', () => {
    const a = ev('Paradiso', '2026-10-23 20:00', '2026-10-24 00:30');
    const b = ev('Melkweg', '2026-10-24 00:00', '2026-10-24 04:00'); // 30 min overlap: fine
    const c = ev('Melkweg', '2026-10-23 23:00', '2026-10-24 04:00'); // 90 min overlap: clash
    expect(planNight([a, b])[0].clashMinutes).toBe(0);
    expect(planNight([a, c])[0].clashMinutes).toBe(90);
    expect(CLASH_MINUTES).toBe(30);
  });

  it('flags a leg you would reach after the next party has ended', () => {
    const a = ev('Paradiso', '2026-10-23 22:00', '2026-10-24 04:00');
    const b = ev('NDSM', '2026-10-23 22:00', '2026-10-23 22:20'); // ends before you can get there
    const [leg] = planNight([a, b]);
    expect(leg.infeasible).toBe(true);
  });

  it('adds a ferry note across the IJ: F4 to NDSM in the evening, F3 late at night', () => {
    const centre = ev('Paradiso', '2026-10-23 18:00', '2026-10-23 21:00');
    const ndsm = ev('NDSM', '2026-10-23 22:00', '2026-10-24 04:00');
    const late = ev('Paradiso', '2026-10-24 01:00', '2026-10-24 05:00');
    const shelter = ev('Shelter', '2026-10-24 05:30', '2026-10-24 09:00');
    const legs = planNight([centre, ndsm, late, shelter]);
    expect(legs.map((l) => l.ferry)).toEqual(['F4', 'F3-late', 'F3']);
  });

  it('suggests night buses for legs leaving after 00:30', () => {
    const a = ev('Paradiso', '2026-10-23 22:00', '2026-10-24 00:20');
    const b = ev('Rembrandtplein', '2026-10-24 00:40', '2026-10-24 04:00');
    const c = ev('Melkweg', '2026-10-24 02:00', '2026-10-24 05:00');
    const legs = planNight([a, b, c]);
    expect(legs.map((l) => l.nightBus)).toEqual([false, true]);
  });
});

describe('defaultNight', () => {
  it('is tonight during the festival (before 06:00 still the previous night), else the first', () => {
    const nights = ['2026-10-22', '2026-10-23', '2026-10-24'];
    expect(defaultNight(nights, parseWall('2026-10-23 21:00'))).toBe('2026-10-23');
    expect(defaultNight(nights, parseWall('2026-10-24 03:00'))).toBe('2026-10-23');
    expect(defaultNight(nights, parseWall('2026-10-08 12:00'))).toBe('2026-10-22');
  });
});
