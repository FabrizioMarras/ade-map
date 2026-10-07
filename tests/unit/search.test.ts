import { describe, expect, it } from 'vitest';
import { matchingArtists, normalise, search, tokens } from '../../src/lib/search';
import { data } from './fixture';

describe('search', () => {
  it('normalises diacritics and punctuation', () => {
    expect(normalise('De León (US)')).toBe('de leon us');
    expect(normalise('A’DAM Toren')).toBe('adam toren');
  });

  it('finds line-up matches', () => {
    const hits = search(data.events, 'Charlotte');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((e) => matchingArtists(e, tokens('Charlotte')).length > 0)).toBe(true);
  });

  it('matches venue names and requires every token', () => {
    const hits = search(data.events, 'paradiso');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((e) => e.searchText.includes('paradiso'))).toBe(true);
    expect(search(data.events, 'paradiso zzzzqqq')).toHaveLength(0);
  });

  it('returns everything for an empty query', () => {
    expect(search(data.events, '  ')).toHaveLength(1263);
  });
});
