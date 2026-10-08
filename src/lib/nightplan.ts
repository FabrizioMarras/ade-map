import { distanceM } from './planb';
import { HOUR, MINUTE, parseWall } from './time';
import type { AdeEvent } from './types';

/** Straight-line distance × this ≈ distance along the streets. */
export const DETOUR = 1.25;
export const SPEED_M_PER_MIN = { walk: 80, bike: 250 } as const;
export type TravelMode = keyof typeof SPEED_M_PER_MIN;
/** Consecutive parties overlapping by more than this are flagged as a clash. */
export const CLASH_MINUTES = 30;

/** A night runs from 06:00 on its day to 06:00 the next morning. */
export function nightWindow(dayKey: string): [number, number] {
  const start = parseWall(`${dayKey} 06:00`);
  return [start, start + 24 * HOUR];
}

/** The starred parties of one night, in the order they start. */
export function nightStops(events: AdeEvent[], dayKey: string): AdeEvent[] {
  const [from, to] = nightWindow(dayKey);
  return events
    .filter((e) => e.startMs >= from && e.startMs < to)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs || a.title.localeCompare(b.title));
}

// The IJ separates Noord (incl. NDSM) from the centre. North-shore latitude by longitude,
// a simplified line along the water; a point clearly north of it is "across the IJ".
const SHORE: [number, number][] = [
  [4.8, 52.41],
  [4.86, 52.406], // west of NDSM the IJ lies north of Houthavens/Westpoort (south bank)
  [4.884, 52.4035],
  [4.889, 52.3975], // NDSM wharf
  [4.896, 52.393],
  [4.8995, 52.3822], // Overhoeks / A'DAM Toren opposite Centraal
  [4.92, 52.3795],
  [4.95, 52.3775],
  [4.99, 52.381],
];

export function shoreLat(lng: number): number {
  if (lng <= SHORE[0][0]) return SHORE[0][1];
  for (let i = 1; i < SHORE.length; i++) {
    const [x1, y1] = SHORE[i];
    const [x0, y0] = SHORE[i - 1];
    if (lng <= x1) return y0 + ((lng - x0) / (x1 - x0)) * (y1 - y0);
  }
  return SHORE[SHORE.length - 1][1];
}

/** North of the IJ (Noord, NDSM, Overhoeks), within the city's longitudes. */
export function isNorthOfIJ(lng: number, lat: number): boolean {
  return lng > 4.78 && lng < 5.0 && lat > shoreLat(lng) + 0.0008;
}

/** NDSM wharf: the F4 ferry's terminus (also used to pick F4 over F3). */
const NDSM: [number, number] = [4.8932, 52.4012];

/** F4 NDSM ↔ Centraal stops around 23:45; F3 Buiksloterweg ↔ Centraal runs 24 h. */
export type FerryNote = 'F3' | 'F4' | 'F3-late';

export interface Leg {
  from: AdeEvent;
  to: AdeEvent;
  metres: number;
  minutes: number;
  /** When you leave `from` and reach `to` (wall-clock ms). */
  leave: number;
  arrive: number;
  /** Overlap of the two parties beyond CLASH_MINUTES, in minutes (0 = no clash). */
  clashMinutes: number;
  /** You would arrive after `to` has ended. */
  infeasible: boolean;
  ferry: FerryNote | null;
  /** Leaving after 00:30, when trams stop and night buses run. */
  nightBus: boolean;
}

function ferryFor(a: AdeEvent, b: AdeEvent, leave: number): FerryNote | null {
  const na = isNorthOfIJ(a.venue.lng, a.venue.lat);
  const nb = isNorthOfIJ(b.venue.lng, b.venue.lat);
  if (na === nb) return null;
  const north = na ? a : b;
  const nearNdsm = distanceM(NDSM, [north.venue.lng, north.venue.lat]) <= 1500;
  if (!nearNdsm) return 'F3';
  const h = new Date(leave).getUTCHours() + new Date(leave).getUTCMinutes() / 60;
  return h >= 23.75 || h < 6.5 ? 'F3-late' : 'F4';
}

/**
 * The route through one night's parties. You arrive at the first party when it starts;
 * you leave each party in time to reach the next one as it starts — never before you got
 * there and never after it ends.
 */
export function planNight(stops: AdeEvent[], mode: TravelMode = 'walk'): Leg[] {
  const legs: Leg[] = [];
  let arrivedAt = stops[0]?.startMs ?? 0;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    const metres = distanceM([a.venue.lng, a.venue.lat], [b.venue.lng, b.venue.lat]) * DETOUR;
    const minutes = Math.max(1, Math.ceil(metres / SPEED_M_PER_MIN[mode]));
    const leave = Math.max(arrivedAt, Math.min(a.endMs, b.startMs - minutes * MINUTE));
    const arrive = leave + minutes * MINUTE;
    const overlap = (a.endMs - b.startMs) / MINUTE;
    const hour = new Date(leave).getUTCHours() + new Date(leave).getUTCMinutes() / 60;
    legs.push({
      from: a,
      to: b,
      metres,
      minutes,
      leave,
      arrive,
      clashMinutes: overlap > CLASH_MINUTES ? Math.round(overlap) : 0,
      infeasible: arrive >= b.endMs,
      ferry: ferryFor(a, b, leave),
      nightBus: hour >= 0.5 && hour < 6,
    });
    arrivedAt = Math.max(arrive, b.startMs);
  }
  return legs;
}

/** The night to plan by default: tonight during the festival, else the first with stars. */
export function defaultNight(nightsWithStops: string[], now: number): string | undefined {
  // Before 06:00 it is still the previous night.
  const tonight = new Date(now - 6 * HOUR).toISOString().slice(0, 10);
  return nightsWithStops.includes(tonight) ? tonight : nightsWithStops[0];
}
