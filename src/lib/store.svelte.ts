import { formatHash, parseHash, type DayScope } from './hash';
import { KEYS, readJSON, writeJSON } from './storage';
import { defaultDay, nowWall } from './time';
import type { AdeEvent, Dataset, Venue } from './types';

export type ThemePref = 'auto' | 'light' | 'dark';
export type SheetSnap = 'collapsed' | 'half' | 'expanded';

export interface VenuePin {
  venue: Venue;
  count: number;
  /** Events at this venue that pass the current day/filters/search/area. */
  matched: number;
  soldOutAll: boolean;
  live: boolean;
  fav: boolean;
}

function autoTheme(now: number): 'light' | 'dark' {
  const h = new Date(now).getUTCHours();
  return h >= 18 || h < 7 ? 'dark' : 'light';
}

class AppState {
  data = $state.raw<Dataset | null>(null);
  error = $state<string | null>(null);
  now = $state(nowWall());

  day = $state<DayScope>(defaultDay());
  selectedVenueId = $state<string | null>(null);
  selectedEventId = $state<number | null>(null);
  /** Venue ids under an ambiguous tap; shown as a chooser. */
  chooser = $state<string[] | null>(null);
  sheet = $state<SheetSnap>('collapsed');
  wide = $state(typeof matchMedia !== 'undefined' && matchMedia('(min-width: 900px)').matches);

  themePref = $state<ThemePref>(readJSON<ThemePref>(KEYS.theme, 'auto'));
  theme = $derived<'light' | 'dark'>(this.themePref === 'auto' ? autoTheme(this.now) : this.themePref);

  /** Events in the selected day scope, before filters. */
  scopeEvents = $derived.by<AdeEvent[]>(() => {
    const d = this.data;
    if (!d) return [];
    if (this.day === 'all' || this.day === 'fav') return d.events;
    return d.eventsByDay.get(this.day) ?? [];
  });

  /** Events after every filter: the result set. */
  results = $derived<AdeEvent[]>(this.scopeEvents);

  pins = $derived.by<VenuePin[]>(() => {
    const byVenue = new Map<string, VenuePin>();
    const matched = new Set(this.results.map((e) => e.id));
    for (const e of this.scopeEvents) {
      let p = byVenue.get(e.venueId);
      if (!p) {
        p = { venue: e.venue, count: 0, matched: 0, soldOutAll: true, live: false, fav: false };
        byVenue.set(e.venueId, p);
      }
      p.count++;
      if (matched.has(e.id)) p.matched++;
      if (!e.soldOut) p.soldOutAll = false;
      if (e.startMs <= this.now && this.now < e.endMs) p.live = true;
    }
    return [...byVenue.values()];
  });

  selectedVenue = $derived(
    this.selectedVenueId ? (this.data?.venuesById.get(this.selectedVenueId) ?? null) : null,
  );
  selectedEvent = $derived(
    this.selectedEventId ? (this.data?.eventsById.get(this.selectedEventId) ?? null) : null,
  );

  /** The venue to highlight on the map (selected venue, or the venue of the open event). */
  focusVenueId = $derived(this.selectedEvent?.venueId ?? this.selectedVenueId);

  constructor() {
    if (typeof window === 'undefined') return;
    this.applyHash(location.hash);
    if (this.selectedEventId) this.sheet = 'expanded';
    else if (this.selectedVenueId) this.sheet = 'half';
    window.addEventListener('popstate', () => this.applyHash(location.hash));
    matchMedia('(min-width: 900px)').addEventListener('change', (e) => (this.wide = e.matches));
    setInterval(() => (this.now = nowWall()), 30_000);
  }

  private applyHash(hash: string) {
    const h = parseHash(hash);
    if (h.day) this.day = h.day;
    this.selectedVenueId = h.venue ?? null;
    this.selectedEventId = h.event ?? null;
    this.chooser = null;
  }

  private writeHash(push: boolean) {
    const hash = formatHash({
      day: this.day,
      venue: this.selectedVenueId ?? undefined,
      event: this.selectedEventId ?? undefined,
    });
    if (hash === location.hash) return;
    if (push) history.pushState({ app: true }, '', hash);
    else history.replaceState(history.state, '', hash);
  }

  setDay(day: DayScope) {
    this.day = day;
    this.writeHash(false);
  }

  /** A tap on the map hit one or more venues. */
  pick(ids: string[]) {
    if (ids.length > 1) {
      this.chooser = ids;
      if (this.sheet === 'collapsed') this.sheet = 'half';
    } else this.openVenue(ids[0]);
  }

  openVenue(id: string) {
    const replace = this.selectedVenueId !== null && this.selectedEventId === null;
    this.chooser = null;
    this.selectedVenueId = id;
    this.selectedEventId = null;
    if (this.sheet === 'collapsed') this.sheet = 'half';
    // Hopping between venues replaces the entry so "back" doesn't walk through every pin.
    this.writeHash(!replace);
  }

  openEvent(id: number) {
    this.chooser = null;
    this.selectedEventId = id;
    if (!this.wide) this.sheet = 'expanded';
    this.writeHash(true);
  }

  /** Back to wherever the user came from. */
  back() {
    if (this.chooser) {
      this.chooser = null;
      return;
    }
    if (history.state?.app) return history.back();
    if (this.selectedEventId) this.selectedEventId = null;
    else this.selectedVenueId = null;
    this.writeHash(false);
  }

  close() {
    this.chooser = null;
    this.selectedEventId = null;
    this.selectedVenueId = null;
    this.writeHash(false);
  }

  setTheme(pref: ThemePref) {
    this.themePref = pref;
    writeJSON(KEYS.theme, pref);
  }
}

export const app = new AppState();
