import { pointInPolygon, type LngLat } from './geo';
import { matches, tokens } from './search';
import { status } from './time';
import type { AdeEvent } from './types';

export type FilterFacet = 'genre' | 'time' | 'venueType' | 'area' | 'type';

/**
 * Sold-out parties: show normally, hide, or keep visible marked for TicketSwap resale
 * ("Sold out · TicketSwap" badge instead of the muted style).
 */
export type SoldOutMode = 'all' | 'hide' | 'resale';

export interface Filters {
  genre: string[];
  time: string[];
  venueType: string[];
  area: string[];
  type: string[];
  free: boolean;
  soldOut: SoldOutMode;
}

export const FILTER_FACETS: FilterFacet[] = ['genre', 'time', 'venueType', 'area', 'type'];

export function emptyFilters(): Filters {
  return { genre: [], time: [], venueType: [], area: [], type: [], free: false, soldOut: 'all' };
}

export function activeFilterCount(f: Filters): number {
  return (
    FILTER_FACETS.reduce((n, k) => n + f[k].length, 0) + (f.free ? 1 : 0) + (f.soldOut !== 'all' ? 1 : 0)
  );
}

/** AND across facets, OR within a facet. `skip` ignores one facet (for facet counts). */
export function passesFilters(e: AdeEvent, f: Filters, skip?: FilterFacet): boolean {
  if (f.free && !e.free) return false;
  if (f.soldOut === 'hide' && e.soldOut) return false;
  for (const k of FILTER_FACETS) {
    if (k === skip || !f[k].length) continue;
    if (!f[k].some((t) => e.facets[k].includes(t))) return false;
  }
  return true;
}

/** Live now, or starting within the next two hours. */
export function isNowish(e: AdeEvent, now: number): boolean {
  const s = status(e, now);
  return s === 'live' || s === 'soon';
}

export function inArea(e: AdeEvent, area: LngLat[] | null): boolean {
  return !area || pointInPolygon([e.venue.lng, e.venue.lat], area);
}

export interface Query {
  filters: Filters;
  query: string;
  nowMode: boolean;
  now: number;
}

export function applyQuery(events: AdeEvent[], q: Query): AdeEvent[] {
  const toks = tokens(q.query);
  return events.filter(
    (e) =>
      passesFilters(e, q.filters) && (!toks.length || matches(e, toks)) && (!q.nowMode || isNowish(e, q.now)),
  );
}

/** Tag counts per facet for the filter sheet, each facet counted with the others applied. */
export function facetCounts(events: AdeEvent[], f: Filters): Record<FilterFacet, Map<string, number>> {
  const out = Object.fromEntries(FILTER_FACETS.map((k) => [k, new Map<string, number>()])) as Record<
    FilterFacet,
    Map<string, number>
  >;
  for (const e of events) {
    for (const k of FILTER_FACETS) {
      if (!passesFilters(e, f, k)) continue;
      for (const t of e.facets[k]) out[k].set(t, (out[k].get(t) ?? 0) + 1);
    }
  }
  return out;
}
