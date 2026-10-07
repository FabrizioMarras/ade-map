import { FREE_TAGS, splitFacets } from './facets';
import { buildSearchText } from './search';
import { DAYS, HIDDEN_END_DURATION, dayKeyOf, parseWall } from './time';
import type { AdeEvent, Dataset, RawData } from './types';

/** Programme without descriptions (fast first paint); descriptions follow in TEXT_URL. */
export const DATA_URL = 'data/ade-2026.core.json';
export const TEXT_URL = 'data/ade-2026.text.json';
export const META_URL = 'data/ade-2026.meta.json';
export const BASEMAP_URL = 'data/basemap.json';

export function indexData(raw: RawData): Dataset {
  const venuesById = new Map(raw.venues.map((v) => [v.id, v]));
  const eventsById = new Map<number, AdeEvent>();
  const eventsByDay = new Map<string, AdeEvent[]>(DAYS.map((d) => [d.key, []]));
  const eventsByVenue = new Map<string, AdeEvent[]>();

  for (const r of raw.events) {
    const venue = venuesById.get(r.venueId);
    if (!venue || eventsById.has(r.id)) continue;
    const startMs = parseWall(r.start);
    const rawEnd = parseWall(r.end);
    const endMs = r.showEnd && rawEnd > startMs ? rawEnd : startMs + HIDDEN_END_DURATION;
    const day = dayKeyOf(startMs);
    const hour = new Date(startMs).getUTCHours();
    const ev: AdeEvent = {
      ...r,
      description: r.description ?? '',
      day,
      startMs,
      endMs,
      overnight: r.end.slice(0, 10) !== r.start.slice(0, 10),
      lateNight: hour < 6,
      free: r.interests.some((t) => FREE_TAGS.has(t)),
      facets: splitFacets(r.interests),
      venue,
      searchText: buildSearchText([r.title, r.subtitle, venue.name, ...r.lineup]),
    };
    eventsById.set(ev.id, ev);
    if (!eventsByDay.has(day)) eventsByDay.set(day, []);
    eventsByDay.get(day)!.push(ev);
    if (!eventsByVenue.has(venue.id)) eventsByVenue.set(venue.id, []);
    eventsByVenue.get(venue.id)!.push(ev);
  }

  const byStart = (a: AdeEvent, b: AdeEvent) => a.startMs - b.startMs || a.title.localeCompare(b.title);
  for (const list of eventsByDay.values()) list.sort(byStart);
  for (const list of eventsByVenue.values()) list.sort(byStart);
  const events = [...eventsById.values()].sort(byStart);

  return {
    generated: raw.generated,
    venues: raw.venues,
    events,
    venuesById,
    eventsById,
    eventsByDay,
    eventsByVenue,
  };
}

export async function loadData(url = DATA_URL): Promise<Dataset> {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load the programme (${res.status})`);
  return indexData((await res.json()) as RawData);
}

/** `generated` of the programme on the server, or null when offline. */
export async function fetchGenerated(url = META_URL): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return null;
    return ((await res.json()) as { generated?: string }).generated ?? null;
  } catch {
    return null;
  }
}

/** Event descriptions, keyed by event id. */
export async function loadDescriptions(url = TEXT_URL): Promise<Map<number, string>> {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load descriptions (${res.status})`);
  const { descriptions } = (await res.json()) as { descriptions: Record<string, string> };
  return new Map(Object.entries(descriptions).map(([id, d]) => [Number(id), d]));
}
