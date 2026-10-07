import { describe, expect, it } from 'vitest';
import { clashes, exportFavs, importFavs } from '../../src/lib/favs';
import { parseWall } from '../../src/lib/time';
import type { AdeEvent } from '../../src/lib/types';

const ev = (id: number, start: string, end: string) =>
  ({ id, title: `E${id}`, startMs: parseWall(start), endMs: parseWall(end) }) as AdeEvent;

describe('favourites', () => {
  it('finds overlapping favourites', () => {
    const a = ev(1, '2026-10-24 22:00', '2026-10-25 04:00');
    const b = ev(2, '2026-10-25 02:00', '2026-10-25 08:00');
    const c = ev(3, '2026-10-25 08:00', '2026-10-25 10:00'); // touches b, no overlap
    const m = clashes([c, b, a]);
    expect(m.get(1)!.map((e) => e.id)).toEqual([2]);
    expect(m.get(2)!.map((e) => e.id)).toEqual([1]);
    expect(m.has(3)).toBe(false);
  });

  it('round-trips export/import and ignores unknown ids', () => {
    const blob = exportFavs([2843412, 1234567]);
    expect(blob).toBe('ADE2026-FAVS:1234567,2843412');
    expect(importFavs(blob, (id) => id === 2843412)).toEqual([2843412]);
    expect(importFavs('https://www.amsterdam-dance-event.nl/en/program/2026/x/2843412/', () => true)).toEqual(
      [2843412],
    );
  });
});
