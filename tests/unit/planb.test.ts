import { describe, expect, it } from 'vitest';
import type { LngLat } from '../../src/lib/geo';
import { PREVIEW_AT, circlePolygon, distanceM, planB, walkMinutes } from '../../src/lib/planb';
import { parseWall } from '../../src/lib/time';
import type { AdeEvent } from '../../src/lib/types';
import { data } from './fixture';

const REMBRANDTPLEIN: LngLat = [4.8966, 52.3662];
/** A point `metres` due north of Rembrandtplein. */
const north = (metres: number): LngLat => [REMBRANDTPLEIN[0], REMBRANDTPLEIN[1] + metres / 111_195];

let id = 0;
function ev(at: LngLat, start: string, end: string, extra: Partial<AdeEvent> = {}): AdeEvent {
  id++;
  return {
    id,
    title: `E${id}`,
    startMs: parseWall(start),
    endMs: parseWall(end),
    free: false,
    soldOut: false,
    venue: { id: `v${id}`, name: `V${id}`, lat: at[1], lng: at[0] },
    ...extra,
  } as AdeEvent;
}

describe('distance and walking time', () => {
  it('measures straight-line metres', () => {
    expect(distanceM(REMBRANDTPLEIN, north(1000))).toBeCloseTo(1000, -1);
    expect(distanceM(REMBRANDTPLEIN, REMBRANDTPLEIN)).toBe(0);
  });
  it('walks at 80 m/min, rounding up, at least 1 minute', () => {
    expect(walkMinutes(0)).toBe(1);
    expect(walkMinutes(80)).toBe(1);
    expect(walkMinutes(81)).toBe(2);
    expect(walkMinutes(1200)).toBe(15);
  });
});

describe('planB filter (Fri 23:30 at Rembrandtplein)', () => {
  const at = parseWall('2026-10-23 23:30');
  const live = ev(north(400), '2026-10-23 22:00', '2026-10-24 05:00');
  const startsIn45 = ev(north(800), '2026-10-24 00:15', '2026-10-24 06:00');
  const startsIn90 = ev(north(300), '2026-10-24 01:00', '2026-10-24 06:00');
  const ended = ev(north(200), '2026-10-23 18:00', '2026-10-23 23:00');
  const tooFar = ev(north(1300), '2026-10-23 22:00', '2026-10-24 05:00'); // 17 min
  const soldOut = ev(north(600), '2026-10-23 23:00', '2026-10-24 04:00', { soldOut: true });
  const all = [live, startsIn45, startsIn90, ended, tooFar, soldOut];

  it('keeps live and starting-within-60 parties inside the 15-minute walk', () => {
    const ids = planB(all, REMBRANDTPLEIN, at).map((i) => i.event.id);
    expect(ids).toEqual([live.id, soldOut.id, startsIn45.id]);
  });

  it('keeps sold-out parties (shown with the TicketSwap badge)', () => {
    expect(planB(all, REMBRANDTPLEIN, at).some((i) => i.event.soldOut)).toBe(true);
  });

  it('widening to 30 minutes reaches further', () => {
    const ids = planB(all, REMBRANDTPLEIN, at, 30).map((i) => i.event.id);
    expect(ids).toContain(tooFar.id);
    expect(ids).not.toContain(ended.id);
    expect(ids).not.toContain(startsIn90.id);
  });

  it('sorts by walking band, free first within a band, then minutes, then start', () => {
    const a = ev(north(320), '2026-10-23 23:00', '2026-10-24 04:00'); // 4 min, band 0-5
    const b = ev(north(390), '2026-10-23 23:00', '2026-10-24 04:00', { free: true }); // 5 min, free
    const c = ev(north(480), '2026-10-23 23:00', '2026-10-24 04:00'); // 6 min, band 5-10
    const d = ev(north(700), '2026-10-23 23:00', '2026-10-24 04:00', { free: true }); // 9 min, free
    const e = ev(north(320), '2026-10-24 00:00', '2026-10-24 04:00'); // 4 min, later start
    const ids = planB([c, a, d, e, b], REMBRANDTPLEIN, at).map((i) => i.event.id);
    expect(ids).toEqual([b.id, a.id, e.id, d.id, c.id]);
  });

  it('finds real parties near Rembrandtplein in the preview moment', () => {
    const items = planB(data.events, REMBRANDTPLEIN, PREVIEW_AT);
    expect(items.length).toBeGreaterThan(5);
    expect(items.every((i) => i.minutes <= 15)).toBe(true);
  });
});

describe('circlePolygon', () => {
  it('is a closed ring at the requested radius', () => {
    const ring = circlePolygon(REMBRANDTPLEIN, 1200);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    for (const p of ring) expect(distanceM(REMBRANDTPLEIN, p)).toBeCloseTo(1200, -1);
  });
});
