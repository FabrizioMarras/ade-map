import { describe, expect, it } from 'vitest';
import { parseHash } from '../../src/lib/hash';
import {
  MAX_URL,
  decodeList,
  encodeList,
  eventLink,
  listLink,
  listTitle,
  mergeIntoList,
  venueLink,
} from '../../src/lib/share';
import { data } from './fixture';

const BASE = 'https://fabriziomarras.github.io/ade-map/';

describe('list encoding', () => {
  it('round-trips ids through base36 + base64url', () => {
    const ids = [2843412, 2861728, 1, 99999999];
    const payload = encodeList(ids);
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/); // URL-safe, no padding
    expect(decodeList(payload)).toEqual(ids);
  });

  it('round-trips every real event id', () => {
    const ids = data.events.slice(0, 200).map((e) => e.id);
    expect(decodeList(encodeList(ids))).toEqual(ids);
  });

  it('ignores garbage and duplicates', () => {
    expect(decodeList('%%%not-base64')).toEqual([]);
    expect(decodeList(encodeList([5, 5, 7]))).toEqual([5, 7]);
    expect(decodeList(btoa('abc,,-1,zz').replace(/=+$/, ''))).toEqual([13368, 1295]);
  });
});

describe('links', () => {
  it('builds party and venue links', () => {
    expect(eventLink(2843412, BASE)).toBe(BASE + '#e=2843412');
    expect(venueLink('1576', BASE)).toBe(BASE + '#v=1576');
  });

  it('builds a list link that parses back, with the name', () => {
    const { url, included } = listLink([2843412, 2861728], 'Fabrizio', BASE);
    expect(included).toBe(2);
    const h = parseHash(new URL(url).hash);
    expect(h.list).toEqual([2843412, 2861728]);
    expect(h.by).toBe('Fabrizio');
  });

  it('stays under 2,000 characters by cutting very long lists', () => {
    const all = data.events.map((e) => e.id);
    const { url, included } = listLink(all, 'Fabrizio', BASE);
    expect(url.length).toBeLessThan(MAX_URL);
    expect(included).toBeGreaterThan(100);
    expect(included).toBeLessThan(all.length);
    expect(parseHash(new URL(url).hash).list).toEqual(all.slice(0, included));
  });

  it('a typical list of 30 parties fits easily', () => {
    expect(
      listLink(
        data.events.slice(0, 30).map((e) => e.id),
        'Fabrizio',
        BASE,
      ).url.length,
    ).toBeLessThan(400);
  });
});

describe('merging a shared list', () => {
  it('adds known events without duplicates', () => {
    const known = (id: number) => id !== 999;
    const { ids, added } = mergeIntoList([1, 2], [2, 3, 999, 3], known);
    expect([...ids]).toEqual([1, 2, 3]);
    expect(added).toBe(1);
  });
});

describe('listTitle', () => {
  it('names the list', () => {
    expect(listTitle('Fabrizio')).toBe("Fabrizio's list");
    expect(listTitle('James')).toBe("James' list");
    expect(listTitle('  ')).toBe('Shared list');
    expect(listTitle()).toBe('Shared list');
  });
});
