import type { LngLat } from './geo';
import { MINUTE, parseWall } from './time';
import type { AdeEvent } from './types';

/** Walking speed and default reach, as in the plan: 15 min ≈ 1,200 m straight-line. */
export const WALK_M_PER_MIN = 80;
export const DEFAULT_MINUTES = 15;
/** Parties starting within this many minutes count as "on" (besides those live now). */
export const STARTING_WITHIN = 60;
/** Width of a walking band: free parties float to the top within the same band. */
export const BAND_MINUTES = 5;
/** Demo moment used outside the festival dates: Fri 23 23:30. */
export const PREVIEW_AT = parseWall('2026-10-23 23:30');

const EARTH_R = 6_371_000;

/** Great-circle distance in metres. */
export function distanceM([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(a));
}

export function walkMinutes(metres: number): number {
  return Math.max(1, Math.ceil(metres / WALK_M_PER_MIN));
}

export interface PlanBItem {
  event: AdeEvent;
  metres: number;
  minutes: number;
  live: boolean;
}

/**
 * Parties live now or starting within 60 minutes, within `maxMinutes` walk (straight line at
 * 80 m/min). Sold-out parties stay in (the UI marks them for TicketSwap). Sorted by walking
 * band, free first within a band, then walking minutes, then start time.
 */
export function planB(
  events: AdeEvent[],
  origin: LngLat,
  at: number,
  maxMinutes = DEFAULT_MINUTES,
): PlanBItem[] {
  const maxM = maxMinutes * WALK_M_PER_MIN;
  const out: PlanBItem[] = [];
  for (const e of events) {
    const live = e.startMs <= at && at < e.endMs;
    const soon = e.startMs > at && e.startMs - at <= STARTING_WITHIN * MINUTE;
    if (!live && !soon) continue;
    const metres = distanceM(origin, [e.venue.lng, e.venue.lat]);
    if (metres > maxM) continue;
    out.push({ event: e, metres, minutes: walkMinutes(metres), live });
  }
  const band = (m: number) => Math.floor((m - 1) / BAND_MINUTES);
  return out.sort(
    (a, b) =>
      band(a.minutes) - band(b.minutes) ||
      Number(b.event.free) - Number(a.event.free) ||
      a.minutes - b.minutes ||
      a.event.startMs - b.event.startMs ||
      a.event.title.localeCompare(b.event.title),
  );
}

/** Polygon approximating a circle of `metres` around `center` (for the radius on the map). */
export function circlePolygon(center: LngLat, metres: number, steps = 64): LngLat[] {
  const [lng, lat] = center;
  const dLat = (metres / EARTH_R) * (180 / Math.PI);
  const dLng = dLat / Math.cos((lat * Math.PI) / 180);
  const ring: LngLat[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (2 * Math.PI * i) / steps;
    ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return ring;
}
