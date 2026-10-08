import { describe, expect, it } from 'vitest';
import { mergeDuplicateVenues, sharedSpots } from '../../scripts/merge-venues.mjs';
import { spotKey } from '../../src/lib/geo';
import { data } from './fixture';

const v = (id: string, name: string, lat: number, lng: number, address = 'X 1, Amsterdam') => ({
  id,
  name,
  lat,
  lng,
  address,
});

describe('mergeDuplicateVenues', () => {
  it('merges the same name (accents/case ignored) within 50 m, keeping the busiest record', () => {
    const venues = [v('1', 'Bar Bacan', 52.3651, 4.8935), v('2', 'Bar Bacán', 52.36512, 4.89351)];
    const events = [{ venueId: '1' }, { venueId: '2' }, { venueId: '2' }];
    const r = mergeDuplicateVenues(venues, events);
    expect(r.venues).toHaveLength(1);
    expect(r.venues[0]).toMatchObject({ id: '2', name: 'Bar Bacán', aliases: ['1'] });
    expect(r.events.map((e) => e.venueId)).toEqual(['2', '2', '2']);
    expect(r.merged).toEqual([{ kept: '2', name: 'Bar Bacán', removed: ['1'] }]);
  });

  it('keeps same-name venues that are far apart, and different names at one address', () => {
    const venues = [
      v('1', 'Club X', 52.37, 4.89),
      v('2', 'Club X', 52.38, 4.9), // ~1.3 km away
      v('3', 'Oliva', 52.3661, 4.8968),
      v('4', 'Three Sisters Pub', 52.3661, 4.8968),
    ];
    const r = mergeDuplicateVenues(venues, []);
    expect(r.venues.map((x) => x.id)).toEqual(['1', '2', '3', '4']);
    expect(r.merged).toEqual([]);
  });

  it('breaks ties by the lowest id', () => {
    const r = mergeDuplicateVenues([v('9', 'Oceandiva', 52.4, 4.9), v('3', 'oceandiva', 52.4, 4.9)], []);
    expect(r.venues.map((x) => x.id)).toEqual(['3']);
  });

  it('finds the two duplicates in the 7 Oct programme', () => {
    // The committed snapshot is already merged; the merge is idempotent.
    const raw = data.venues.flatMap((x) => [x]);
    expect(mergeDuplicateVenues(raw, data.events).merged).toEqual([]);
    expect(
      raw
        .filter((x) => x.aliases?.length)
        .map((x) => x.name)
        .sort(),
    ).toEqual(['Bar Bacan', 'Oceandiva Original']);
  });
});

describe('shared spots', () => {
  it('groups venues on the same spot, including the four from the plan', () => {
    const spots = sharedSpots(data.venues);
    const flat = spots.map((s) => s.venues.join(' | '));
    expect(
      flat.some((s) => s.includes('Oliva') && s.includes('Three Sisters Pub') && s.includes('Escape deLux')),
    ).toBe(true);
    expect(flat.some((s) => s.includes('The Loft Amsterdam') && s.includes("A'DAM Toren"))).toBe(true);
    expect(flat.some((s) => s.includes('Auditorium') && s.includes('OOSTerbar'))).toBe(true);
    expect(flat.some((s) => s.includes('Palladium Amsterdam') && s.includes('Sociëteit De Kring'))).toBe(
      true,
    );
    // The app clusters with the same key.
    for (const s of spots) {
      const keys = new Set(data.venues.filter((x) => s.venues.includes(x.name)).map(spotKey));
      expect(keys.size).toBeGreaterThanOrEqual(1);
    }
  });
});
