import { describe, expect, it } from 'vitest';
import { facetOf, splitFacets } from '../../src/lib/facets';
import { raw } from './fixture';

const EXPECTED: Record<string, string> = {
  House: 'genre',
  'Daytime events': 'time',
  'Intimate venues': 'venueType',
  'Nighttime events': 'time',
  Techno: 'genre',
  'Club nights': 'type',
  'Music Culture': 'type',
  'Tech-house': 'genre',
  'Deep House': 'genre',
  Trance: 'genre',
  'Unique venues': 'venueType',
  Other: 'other',
  Centre: 'area',
  'Live Performances': 'type',
  'Beyond the Dancefloor': 'type',
  Live: 'type',
  'Large venues': 'venueType',
  'Free Festival Events': 'type',
  'New Arts & Culture Venues': 'venueType',
  'Free A&C Events': 'type',
  'Mid-size venues': 'venueType',
  Exhibitions: 'type',
  Disco: 'genre',
  'Club Culture': 'type',
  'Ambient & Listening': 'genre',
  'Audiovisual & Immersive Arts': 'type',
  'Disco, Funk & Soul': 'genre',
  'All night long': 'time',
  'Electro & Wave': 'genre',
  Warehouses: 'venueType',
  Ambient: 'genre',
  Elektro: 'genre',
  'Morning events': 'time',
  West: 'area',
  'Afro House': 'genre',
  Melodic: 'genre',
  'Networking events': 'type',
  'Bass & UK': 'genre',
  '(Live) Events': 'type',
  'Melodic House': 'genre',
};

describe('facet mapping', () => {
  it('covers the 40 most used tags', () => {
    const counts = new Map<string, number>();
    for (const e of raw.events) for (const t of e.interests) counts.set(t, (counts.get(t) ?? 0) + 1);
    const top40 = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([t]) => t);
    expect(new Set(top40)).toEqual(new Set(Object.keys(EXPECTED)));
    for (const t of top40) expect([t, facetOf(t)]).toEqual([t, EXPECTED[t]]);
  });

  it('sends unknown tags to other and de-duplicates', () => {
    expect(splitFacets(['House', 'Awakenings', 'House', 'NDSM'])).toEqual({
      genre: ['House'],
      time: [],
      venueType: [],
      area: ['NDSM'],
      type: [],
      other: ['Awakenings'],
    });
  });
});
