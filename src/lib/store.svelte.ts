import { applyQuery, emptyFilters, inArea, type Filters } from './filter';
import { spotKey, type LngLat } from './geo';
import { formatHash, parseHash, type DayScope } from './hash';
import { buildArtistIndex, type Artist } from './artists';
import { mergeIntoList, shareOrCopy } from './share';
import { KEYS, readJSON, writeJSON } from './storage';
import { defaultNight, nightStops, planNight, type Leg, type TravelMode } from './nightplan';
import { DEFAULT_MINUTES, PREVIEW_AT, planB as computePlanB, type PlanBItem } from './planb';
import { clampT, defaultT } from './pulse';
import { defaultDay, isFestivalTime, nowWall } from './time';
import type { AdeEvent, Dataset, Venue } from './types';

import { resolveTheme, type ThemePref } from './theme';
export type { ThemePref };
export type SheetSnap = 'collapsed' | 'half' | 'expanded';

export type NavTab = 'map' | 'parties' | 'fav' | 'more';

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

/** How long a toast stays: longer text gets more time to read. */
export function toastTimeout(text: string): number {
  return text.length > 60 ? 7000 : 4000;
}

export interface VenuePin {
  venue: Venue;
  count: number;
  /** Events at this venue that pass the current day/filters/search/area. */
  matched: number;
  soldOutAll: boolean;
  live: boolean;
  fav: boolean;
  /** Map pins only: all venues sharing this spot (2+), this pin's venue being the busiest. */
  members?: Venue[];
}

class AppState {
  data = $state.raw<Dataset | null>(null);
  error = $state<string | null>(null);
  /** Latest time the server re-checked the programme without changes (newer than data.generated). */
  checkedAt = $state<string | null>(null);
  /** Descriptions arrive after the first paint; null until then. */
  descriptions = $state.raw<Map<number, string> | null>(null);
  now = $state(nowWall());

  day = $state<DayScope>(defaultDay());
  selectedVenueId = $state<string | null>(null);
  selectedEventId = $state<number | null>(null);
  /** Venue ids under an ambiguous tap; shown as a chooser. */
  chooser = $state<string[] | null>(null);
  sheet = $state<SheetSnap>('collapsed');
  /**
   * The active navigation tab: set by the tabs themselves and reset by what the user does
   * (opening something on the map, collapsing the sheet, searching…). Wide screens have no Map
   * tab: there the panel always shows Parties, My list or More.
   */
  tab = $state<NavTab>('map');
  /** The More content is showing (a sheet on phones, the side panel on wide screens). */
  moreOpen = $derived(this.tab === 'more');
  /** The last day (or All) shown in the Parties list, for the Parties tab after My list. */
  listDay = $state<DayScope>(defaultDay());
  /** Chrome's install prompt, when the browser offers one (beforeinstallprompt). */
  installPrompt = $state.raw<(Event & { prompt: () => Promise<void> }) | null>(null);
  wide = $state(typeof matchMedia !== 'undefined' && matchMedia('(min-width: 900px)').matches);

  query = $state('');
  filters = $state<Filters>(emptyFilters());
  nowMode = $state(false);
  /** Toasts on screen, oldest first (see notify). */
  toasts = $state<Toast[]>([]);
  private toastId = 0;

  /** Show a short message; it dismisses itself (4 s, or 7 s for longer text). */
  notify(text: string, action?: Toast['action']) {
    const id = ++this.toastId;
    // The same message again replaces the old one instead of stacking duplicates.
    this.toasts = [...this.toasts.filter((t) => t.text !== text), { id, text, action }].slice(-3);
  }

  dismissToast(id: number) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }
  /** A link to show for copying by hand when neither sharing nor the clipboard works. */
  manualLink = $state<string | null>(null);

  /** Share a link (share sheet → clipboard → copy by hand) and report what happened. */
  async share(url: string, title: string) {
    const r = await shareOrCopy(url, title);
    if (r === 'copied') this.notify('Link copied');
    else if (r === 'manual') this.manualLink = url;
  }

  /** A list someone shared with a `#list=` link: viewed until saved, closed or a day is picked. */
  sharedList = $state.raw<{ ids: number[] } | null>(null);
  /** The "Save to my list / Just look" banner is showing. */
  sharedBanner = $state(false);

  /** Pulse mode: the festival-at-a-glance timeline. `pulseT` is in festival minutes. */
  pulseOn = $state(false);
  pulseT = $state(defaultT());

  /** Drawn selection polygon (closed ring, lng/lat). */
  area = $state.raw<LngLat[] | null>(null);
  drawMode = $state<'lasso' | 'box' | null>(null);

  /** Reminder notifications 30 min before starred parties (opt-in). */
  reminders = $state(readJSON<boolean>(KEYS.reminders, false));
  reminded = $state.raw<Set<number>>(new Set(readJSON<number[]>(KEYS.reminded, [])));

  setReminders(on: boolean) {
    this.reminders = on;
    writeJSON(KEYS.reminders, on);
  }

  markReminded(ids: number[]) {
    this.reminded = new Set([...this.reminded, ...ids]);
    writeJSON(KEYS.reminded, [...this.reminded]);
  }

  favs = $state.raw<Set<number>>(new Set(readJSON<number[]>(KEYS.favs, [])));

  themePref = $state<ThemePref>(readJSON<ThemePref>(KEYS.theme, 'auto'));
  theme = $derived<'light' | 'dark'>(resolveTheme(this.themePref, this.now));
  /** Map style follows the theme, except Pulse, which is a night map by design. */
  mapTheme = $derived<'light' | 'dark'>(this.pulseOn ? 'dark' : this.theme);

  /** Events in the selected day scope, before filters. Now mode spans days. */
  scopeEvents = $derived.by<AdeEvent[]>(() => {
    const d = this.data;
    if (!d) return [];
    if (this.sharedList && !this.nowMode) {
      const ids = new Set(this.sharedList.ids);
      return d.events.filter((e) => ids.has(e.id));
    }
    if (this.day === 'fav' && !this.nowMode) return d.events.filter((e) => this.favs.has(e.id));
    if (this.nowMode || this.day === 'all') return d.events;
    return d.eventsByDay.get(this.day) ?? [];
  });

  /**
   * Plan B: parties on now or within the hour, within walking distance of `origin`.
   * `preview` = outside the festival, shown for Fri 23 23:30 so it can be tried.
   */
  planB = $state.raw<{
    origin: LngLat;
    source: 'location' | 'centre';
    minutes: number;
    preview: boolean;
  } | null>(null);

  planBAt = $derived(this.planB?.preview ? PREVIEW_AT : this.now);
  planBItems = $derived.by<PlanBItem[]>(() =>
    this.planB && this.data
      ? computePlanB(this.data.events, this.planB.origin, this.planBAt, this.planB.minutes)
      : [],
  );

  /** Line-up index: artist → their sets across the week. */
  artistIndex = $derived(this.data ? buildArtistIndex(this.data.events) : new Map<string, Artist>());
  /** The artist sheet that is open (from a search), if any. */
  artistKey = $state<string | null>(null);
  artist = $derived(this.artistKey ? (this.artistIndex.get(this.artistKey) ?? null) : null);
  artistEvents = $derived.by<AdeEvent[]>(() => {
    const d = this.data;
    if (!this.artist || !d) return [];
    return this.artist.eventIds.map((id) => d.eventsById.get(id)).filter((e): e is AdeEvent => !!e);
  });

  openArtist(key: string) {
    this.tab = 'parties'; // opened from a search
    this.chooser = null;
    this.selectedEventId = null;
    this.selectedVenueId = null;
    this.artistKey = key;
    if (!this.wide && this.sheet === 'collapsed') this.sheet = 'half';
  }

  closeArtist() {
    this.artistKey = null;
  }

  /** Night planner (from My list): one night's starred parties as a route. */
  nightPlan = $state<{ night: string; mode: TravelMode } | null>(null);

  /** Nights (06:00 → 06:00) that have starred parties, in order. */
  starredNights = $derived.by<string[]>(() => {
    if (!this.data) return [];
    const nights = new Set<string>();
    for (const id of this.favs) {
      const e = this.data.eventsById.get(id);
      if (e) nights.add(new Date(e.startMs - 6 * 3_600_000).toISOString().slice(0, 10));
    }
    return [...nights].sort();
  });

  nightStops = $derived.by<AdeEvent[]>(() => {
    if (!this.nightPlan || !this.data) return [];
    const data = this.data;
    const starred = [...this.favs].map((id) => data.eventsById.get(id)).filter((e): e is AdeEvent => !!e);
    return nightStops(starred, this.nightPlan.night);
  });

  nightLegs = $derived.by<Leg[]>(() =>
    this.nightPlan ? planNight(this.nightStops, this.nightPlan.mode) : [],
  );

  /** Events after every filter: the result set. (Plan B and the night planner replace it.) */
  results = $derived.by<AdeEvent[]>(() => {
    if (this.planB) return this.planBItems.map((i) => i.event);
    if (this.nightPlan) return this.nightStops;
    if (this.artist) return this.artistEvents;
    const r = applyQuery(this.scopeEvents, {
      filters: this.filters,
      query: this.query,
      nowMode: this.nowMode,
      now: this.now,
    });
    return this.area ? r.filter((e) => this.inArea(e)) : r;
  });

  /** Results in list order: by start time. */
  listEvents = $derived(
    this.nowMode || this.sharedList || this.day === 'all' || this.day === 'fav'
      ? [...this.results].sort((a, b) => a.startMs - b.startMs)
      : this.results,
  );

  /** Sheet content when nothing is selected. */
  listMode = $state<'parties' | 'venues'>('parties');

  /** Pins only for venues in scope; in Now mode only venues with something on now/soon. */
  pinEvents = $derived.by(() => {
    if (this.nowMode) return this.results;
    // Plan B: the day's venues stay on the map (faded unless in the result), plus result venues
    // from another day (e.g. the preview Friday while Wednesday is selected).
    if (this.planB || this.nightPlan || this.artist)
      return [...new Set([...this.scopeEvents, ...this.results])];
    return this.scopeEvents;
  });

  pins = $derived.by<VenuePin[]>(() => {
    const byVenue = new Map<string, VenuePin>();
    const matched = new Set(this.results.map((e) => e.id));
    for (const e of this.pinEvents) {
      let p = byVenue.get(e.venueId);
      if (!p) {
        p = { venue: e.venue, count: 0, matched: 0, soldOutAll: true, live: false, fav: false };
        byVenue.set(e.venueId, p);
      }
      p.count++;
      if (matched.has(e.id)) p.matched++;
      if (!e.soldOut) p.soldOutAll = false;
      if (e.startMs <= this.now && this.now < e.endMs) p.live = true;
      if (this.favs.has(e.id)) p.fav = true;
    }
    return [...byVenue.values()];
  });

  /**
   * Pins as drawn on the map: venues on the same spot become one pin with the combined count;
   * tapping it opens the venue chooser.
   */
  mapPins = $derived.by<VenuePin[]>(() => {
    const spots = new Map<string, VenuePin[]>();
    for (const p of this.pins) {
      const k = spotKey(p.venue);
      if (!spots.has(k)) spots.set(k, []);
      spots.get(k)!.push(p);
    }
    const out: VenuePin[] = [];
    for (const group of spots.values()) {
      if (group.length === 1) {
        out.push(group[0]);
        continue;
      }
      group.sort(
        (a, b) => b.matched - a.matched || b.count - a.count || a.venue.name.localeCompare(b.venue.name),
      );
      out.push({
        venue: group[0].venue,
        count: group.reduce((n, p) => n + p.count, 0),
        matched: group.reduce((n, p) => n + p.matched, 0),
        soldOutAll: group.every((p) => p.soldOutAll),
        live: group.some((p) => p.live),
        fav: group.some((p) => p.fav),
        members: group.map((p) => p.venue),
      });
    }
    return out;
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
    else if (this.selectedVenueId || this.sharedList) this.sheet = 'half';
    // My list via a deep link opens on the My list tab, with the list showing.
    else if (this.day === 'fav') this.sheet = 'half';
    this.tab = this.day === 'fav' && !this.sharedList ? 'fav' : this.sharedList ? 'parties' : this.homeTab;
    window.addEventListener('popstate', () => this.applyHash(location.hash));
    // Keep favourites in sync across tabs.
    window.addEventListener('storage', (e) => {
      if (e.key === KEYS.favs) this.favs = new Set(readJSON<number[]>(KEYS.favs, []));
    });
    matchMedia('(min-width: 900px)').addEventListener('change', (e) => {
      this.wide = e.matches;
      if (this.wide && this.tab === 'map') this.tab = 'parties';
    });
    setInterval(() => (this.now = nowWall()), 30_000);
  }

  private applyHash(hash: string) {
    const h = parseHash(hash);
    if (h.day) this.day = h.day;
    this.dayFromLink = !h.day;
    if (h.list?.length) {
      const known = this.sharedList?.ids.join() === h.list.join();
      this.sharedList = { ids: h.list };
      if (!known) this.sharedBanner = true;
    } else this.sharedList = null;
    this.pulseOn = h.pulse !== undefined;
    if (h.pulse !== undefined) this.pulseT = clampT(h.pulse);
    this.selectedVenueId = h.venue ?? null;
    this.selectedEventId = h.event ?? null;
    this.chooser = null;
    this.resolveLinkDay();
    if (this.day === 'fav' && !this.sharedList) this.tab = 'fav';
  }

  /** Set when the URL named a party/venue but no day: pick the day from the item. */
  private dayFromLink = false;

  /**
   * `#e=<id>` / `#v=<id>` links carry no day: show the party's day, or a day the venue has
   * parties on. Runs again once the programme has loaded.
   */
  resolveLinkDay() {
    if (!this.dayFromLink || !this.data || this.sharedList) return;
    if (this.day === 'all' || this.day === 'fav') return;
    const ev = this.selectedEventId ? this.data.eventsById.get(this.selectedEventId) : undefined;
    if (ev) {
      this.day = ev.day;
      this.dayFromLink = false;
      return;
    }
    const venueEvents = this.selectedVenueId ? this.data.eventsByVenue.get(this.selectedVenueId) : undefined;
    if (venueEvents?.length) {
      if (!venueEvents.some((e) => e.day === this.day)) this.day = venueEvents[0].day;
      this.dayFromLink = false;
    }
  }

  writeHash(push: boolean) {
    const hash = formatHash({
      day: this.day,
      venue: this.selectedVenueId ?? undefined,
      pulse: this.pulseOn ? this.pulseT : undefined,
      event: this.selectedEventId ?? undefined,
      list: this.sharedList?.ids,
    });
    if (hash === location.hash) return;
    if (push) history.pushState({ app: true }, '', hash);
    else history.replaceState(history.state, '', hash);
  }

  /** Open the night planner on tonight (during the festival) or the first starred night. */
  openNightPlan() {
    const night = defaultNight(this.starredNights, this.now);
    if (!night) return;
    this.chooser = null;
    this.selectedEventId = null;
    this.selectedVenueId = null;
    this.planB = null;
    this.nightPlan = { night, mode: this.nightPlan?.mode ?? 'walk' };
    this.writeHash(false);
    if (!this.wide && this.sheet === 'collapsed') this.sheet = 'half';
  }

  closeNightPlan() {
    this.nightPlan = null;
  }

  setDay(day: DayScope) {
    if (day !== 'fav') this.listDay = day;
    // A day chip while My list is showing switches to that day's list.
    if (day !== 'fav' && this.tab === 'fav') this.tab = 'parties';
    this.nightPlan = null;
    this.day = day;
    this.sharedList = null;
    this.sharedBanner = false;
    this.writeHash(false);
  }

  /** Save the shared list into My list (no duplicates) and show My list. */
  saveSharedList(): number {
    if (!this.sharedList || !this.data) return 0;
    const data = this.data;
    const { ids, added } = mergeIntoList(this.favs, this.sharedList.ids, (id) => data.eventsById.has(id));
    this.setFavs(ids);
    this.setDay('fav');
    this.tab = 'fav';
    return added;
  }

  closeSharedList() {
    this.sharedList = null;
    this.sharedBanner = false;
    this.writeHash(false);
  }

  /** A tap on the map hit one or more venues. */
  pick(ids: string[]) {
    this.tab = this.homeTab;
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

  /** Enter Pulse mode (adds a history entry, so Back returns to the normal map). */
  /** Start Plan B from `origin` (the user's location, or the map centre as a fallback). */
  startPlanB(origin: LngLat, source: 'location' | 'centre') {
    this.tab = this.homeTab;
    this.chooser = null;
    this.selectedEventId = null;
    this.selectedVenueId = null;
    this.drawMode = null;
    this.area = null;
    this.planB = { origin, source, minutes: DEFAULT_MINUTES, preview: !isFestivalTime(this.now) };
    this.listMode = 'parties';
    this.writeHash(false);
    if (!this.wide && this.sheet === 'collapsed') this.sheet = 'half';
  }

  widenPlanB() {
    if (this.planB) this.planB = { ...this.planB, minutes: this.planB.minutes * 2 };
  }

  closePlanB() {
    this.planB = null;
  }

  enterPulse(t = defaultT(this.now)) {
    if (this.pulseOn) return;
    this.tab = this.homeTab;
    this.planB = null;
    this.chooser = null;
    this.selectedEventId = null;
    this.selectedVenueId = null;
    this.drawMode = null;
    this.pulseOn = true;
    this.pulseT = clampT(t);
    this.writeHash(true);
  }

  exitPulse() {
    if (!this.pulseOn) return;
    // Pop our own history entry when there is one, so Back and the toggle behave the same.
    if (history.state?.app && !this.selectedVenueId && !this.selectedEventId) return history.back();
    this.pulseOn = false;
    this.selectedEventId = null;
    this.selectedVenueId = null;
    this.writeHash(false);
  }

  /** Move the Pulse clock; the URL follows (without adding history entries). */
  setPulseT(t: number, writeUrl = true) {
    this.pulseT = clampT(t);
    if (writeUrl) this.writeHash(false);
  }

  setNowMode(on: boolean) {
    this.nowMode = on;
  }

  isFav(id: number): boolean {
    return this.favs.has(id);
  }

  toggleFav(id: number) {
    const next = new Set(this.favs);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.setFavs(next);
  }

  setFavs(ids: Set<number>) {
    this.favs = ids;
    writeJSON(KEYS.favs, [...ids]);
  }

  inArea(e: AdeEvent): boolean {
    return inArea(e, this.area);
  }

  setArea(poly: LngLat[] | null) {
    this.area = poly;
    this.drawMode = null;
    if (poly) {
      this.chooser = null;
      this.selectedVenueId = null;
      this.selectedEventId = null;
      this.listMode = 'parties';
      this.writeHash(false);
      this.tab = 'parties';
      if (!this.wide && this.sheet === 'collapsed') this.sheet = 'half';
    }
  }

  clearArea() {
    this.area = null;
  }

  clearFilters() {
    this.filters = emptyFilters();
  }

  /** The tab to fall back to: Map on phones; wide screens have no Map tab. */
  get homeTab(): NavTab {
    return this.wide ? 'parties' : 'map';
  }

  /** Map tab (phones): collapse the sheet and clear the selection. */
  showMap() {
    this.tab = this.homeTab;
    this.close();
    if (!this.wide) this.sheet = 'collapsed';
  }

  /** More tab: open its content, or close it again. */
  toggleMore() {
    if (this.tab === 'more') this.closeMore();
    else this.tab = 'more';
  }

  closeMore() {
    if (this.tab === 'more') this.tab = this.homeTab;
  }

  /** Parties tab: the current day's list at half height. */
  showParties() {
    // Again while active (phones): put the list away.
    if (this.tab === 'parties' && !this.wide) return this.collapseList();
    this.tab = 'parties';
    this.close();
    this.closePlanB();
    this.nightPlan = null;
    this.artistKey = null;
    if (this.day === 'fav' || this.sharedList)
      this.setDay(this.listDay === 'fav' ? defaultDay() : this.listDay);
    this.listMode = 'parties';
    if (!this.wide) this.sheet = 'half';
  }

  /** My list tab: favourites, with their actions at the top. */
  showMyList() {
    // Remember the day on screen (it may have come from a link) for the Parties tab.
    if (this.day !== 'fav') this.listDay = this.day;
    if (this.tab === 'fav' && !this.wide) return this.collapseList();
    this.close();
    this.closePlanB();
    this.artistKey = null;
    this.nowMode = false;
    this.setDay('fav');
    this.tab = 'fav';
    this.listMode = 'parties';
    if (!this.wide) this.sheet = 'half';
  }

  private collapseList() {
    this.sheet = 'collapsed';
    this.tab = 'map';
  }

  setTheme(pref: ThemePref) {
    this.themePref = pref;
    writeJSON(KEYS.theme, pref);
  }
}

export const app = new AppState();
