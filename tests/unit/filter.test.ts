import { describe, expect, it } from 'vitest';
import {
  activeFilterCount,
  applyQuery,
  emptyFilters,
  facetCounts,
  passesFilters,
} from '../../src/lib/filter';
import { parseWall } from '../../src/lib/time';
import { data } from './fixture';

const fri = data.eventsByDay.get('2026-10-23')!;
const q = (over: Partial<Parameters<typeof applyQuery>[1]> = {}) => ({
  filters: emptyFilters(),
  query: '',
  nowMode: false,
  now: parseWall('2026-10-23 12:00'),
  ...over,
});

describe('filters', () => {
  it('passes everything with no filters', () => {
    expect(applyQuery(fri, q())).toHaveLength(335);
  });

  it('ORs within a facet and ANDs across facets', () => {
    const house = applyQuery(fri, q({ filters: { ...emptyFilters(), genre: ['House'] } }));
    const techno = applyQuery(fri, q({ filters: { ...emptyFilters(), genre: ['Techno'] } }));
    const either = applyQuery(fri, q({ filters: { ...emptyFilters(), genre: ['House', 'Techno'] } }));
    const both = new Set([...house, ...techno].map((e) => e.id));
    expect(either).toHaveLength(both.size);
    const houseNight = applyQuery(
      fri,
      q({ filters: { ...emptyFilters(), genre: ['House'], time: ['Nighttime events'] } }),
    );
    expect(
      houseNight.every((e) => e.facets.genre.includes('House') && e.facets.time.includes('Nighttime events')),
    ).toBe(true);
    expect(houseNight.length).toBeLessThan(house.length);
  });

  it('handles free and sold-out toggles', () => {
    const f = { ...emptyFilters(), free: true, hideSoldOut: true };
    expect(activeFilterCount(f)).toBe(2);
    const r = applyQuery(data.events, q({ filters: f }));
    expect(r.every((e) => e.free && !e.soldOut)).toBe(true);
    expect(r.length).toBeGreaterThan(0);
  });

  it('counts facets with the other facets applied', () => {
    const f = { ...emptyFilters(), genre: ['House'] };
    const c = facetCounts(fri, f);
    // Genre counts ignore the genre selection itself…
    expect(c.genre.get('Techno')).toBe(fri.filter((e) => e.facets.genre.includes('Techno')).length);
    // …while other facets respect it.
    expect(c.time.get('Nighttime events')).toBe(
      fri.filter((e) => passesFilters(e, f) && e.facets.time.includes('Nighttime events')).length,
    );
  });

  it('Now mode keeps live events and those starting within 2 h', () => {
    const now = parseWall('2026-10-24 23:30');
    const r = applyQuery(data.events, q({ nowMode: true, now }));
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((e) => e.startMs - now <= 2 * 3600_000 && e.endMs > now)).toBe(true);
  });
});
