import { describe, expect, it } from 'vitest';
import { buildArtistIndex, parseArtist, searchArtists } from '../../src/lib/artists';
import { parseWall } from '../../src/lib/time';
import type { AdeEvent } from '../../src/lib/types';
import { data } from './fixture';

let id = 0;
const ev = (start: string, lineup: string[]) =>
  ({ id: ++id, startMs: parseWall(start), lineup, title: `E${id}` }) as AdeEvent;

describe('parseArtist', () => {
  it('strips country suffixes, including repeated and combined ones', () => {
    expect(parseArtist('Charlotte Adigéry (BE)')).toEqual({ name: 'Charlotte Adigéry', country: 'BE' });
    expect(parseArtist('J Maia (BR) (BR)')).toEqual({ name: 'J Maia', country: 'BR' });
    expect(parseArtist('Duo (NL/BE)')).toEqual({ name: 'Duo', country: 'NL/BE' });
    expect(parseArtist('VSC (Vault Sessions Collective)')).toEqual({
      name: 'VSC (Vault Sessions Collective)',
      country: '',
    });
  });
});

describe('buildArtistIndex', () => {
  const events = [
    ev('2026-10-24 23:00', ['Casa Mata (FR)', 'Bomber (US)']),
    ev('2026-10-22 20:00', ['Casa Mata', 'Bomber (IT)', 'casa mata (FR)']),
    ev('2026-10-23 22:00', ['Bomber']),
  ];
  const idx = buildArtistIndex(events);

  it('merges one artist listed with and without a country, sets in start order', () => {
    const casa = idx.get('casa mata')!;
    expect(casa.name).toBe('Casa Mata');
    expect(casa.eventIds).toEqual([events[1].id, events[0].id]);
  });

  it('keeps same-name artists from different countries apart', () => {
    expect(idx.get('bomber us')).toMatchObject({ name: 'Bomber (US)', eventIds: [events[0].id] });
    expect(idx.get('bomber it')).toMatchObject({ name: 'Bomber (IT)', eventIds: [events[1].id] });
    expect(idx.get('bomber')).toMatchObject({ name: 'Bomber', eventIds: [events[2].id] });
  });

  it('finds artists by name prefix, most sets first', () => {
    expect(searchArtists(idx, 'bom').map((a) => a.name)).toEqual(['Bomber', 'Bomber (IT)', 'Bomber (US)']);
    expect(searchArtists(idx, 'casa ma').map((a) => a.name)).toEqual(['Casa Mata']);
    expect(searchArtists(idx, 'x')).toEqual([]);
  });

  it('indexes the real line-ups', () => {
    const real = buildArtistIndex(data.events);
    expect(real.get('charlotte adigery')?.name).toBe('Charlotte Adigéry');
    const dave = searchArtists(real, 'dave clarke')[0];
    expect(dave.name).toBe('Dave Clarke');
    expect(dave.eventIds.length).toBeGreaterThanOrEqual(2);
    const starts = dave.eventIds.map((i) => data.eventsById.get(i)!.startMs);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });
});
