export interface Venue {
  id: string;
  name: string;
  address: string;
  url: string;
  lat: number;
  lng: number;
  geo: string;
}

export interface RawEvent {
  id: number;
  title: string;
  subtitle: string;
  start: string; // "YYYY-MM-DD HH:mm", Europe/Amsterdam wall clock
  end: string;
  showStart: boolean;
  showEnd: boolean;
  url: string;
  venueId: string;
  soldOut: boolean;
  categories: string;
  interests: string[];
  lineup: string[];
  ticketUrl: string | null;
  ticketText: string | null;
  image: string;
  /** Absent in the core file; loaded separately (see loadDescriptions). */
  description?: string;
}

export interface RawData {
  generated: string;
  source: string;
  venues: Venue[];
  events: RawEvent[];
}

export type FacetKey = 'genre' | 'time' | 'venueType' | 'area' | 'type' | 'other';

export type Facets = Record<FacetKey, string[]>;

/** "YYYY-MM-DD" of a festival day. */
export type DayKey = string;

export interface AdeEvent extends RawEvent {
  /** Calendar day of `start` — how ADE lists it. */
  day: DayKey;
  /** Wall-clock milliseconds (Amsterdam local time encoded as if UTC). */
  startMs: number;
  /** Effective end for status checks (start + 6 h when the end is hidden). */
  endMs: number;
  overnight: boolean;
  /** Starts between 00:00 and 05:59. */
  lateNight: boolean;
  free: boolean;
  facets: Facets;
  venue: Venue;
  /** Normalised haystack for search. */
  searchText: string;
}

export interface Dataset {
  generated: string;
  venues: Venue[];
  events: AdeEvent[];
  venuesById: Map<string, Venue>;
  eventsById: Map<number, AdeEvent>;
  eventsByDay: Map<DayKey, AdeEvent[]>;
  eventsByVenue: Map<string, AdeEvent[]>;
}
