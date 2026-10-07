# ADE 2026 Interactive Map — Build Plan

Owner: Fabrizio · Target: Amsterdam Dance Event, Wed 21 – Sun 25 Oct 2026 · Primary device: phone (personal use)

This document is the complete brief for building the app. It records what has already been researched and collected (the data, the API, the venue coordinates), the product spec, the technical design, and an ordered list of implementation tasks with acceptance criteria. It is written so that a coding agent can execute it top to bottom.

---

## 1. Goal and scope

A mobile-first web app that shows every ADE 2026 festival party on a map of Amsterdam. Selecting a party shows where it is and all its details. Selecting an area of the map lists the parties inside that area.

In scope (in priority order):

1. Map of Amsterdam with one pin per venue; tap a pin → see the parties at that venue → tap a party → full details (time, venue, address, line‑up, genres, description, ticket link, link to the ADE page, directions).
2. Day filter (Wed–Sun, or all), text search (party, venue, artist), and a "happening now / tonight" view.
3. Area selection: draw a shape on the map (lasso or rectangle) → list of parties inside it, honouring the active day filter.
4. Favourites (star a party, see "my list" on the map and as a list), stored on the device.
5. Installable as a PWA so it works fast on the phone and keeps working with a flaky network.

Out of scope for now: accounts, sharing between users, buying tickets inside the app, conference (ADE Pro) events.

---

## 2. What already exists

Folder: `~/Desktop/Fabrizio/ADE Map/`

```
ADE Map/
  PLAN.md                     ← this file
  data/ade-2026-data.json     ← full dataset, collected 7 Oct 2026 (3.4 MB)
```

### 2.1 The dataset (`data/ade-2026-data.json`)

```jsonc
{
  "generated": "2026-10-07T16:48:00Z",
  "source": "...",
  "venues": [ { "id": "40620", "name": "Noorderlicht", "address": "NDSM Plein 102, Amsterdam",
                "url": "https://www.amsterdam-dance-event.nl/en/venues/noorderlicht/40620/",
                "lat": 52.39959633, "lng": 4.89694778, "geo": "NDSM-plein 102, 1033WB Amsterdam" } ],
  "events": [ { "id": 2843412, "title": "313X020: BBQ | Network | Dance", "subtitle": "Amsterdam Invites Detroit - ...",
                "start": "2026-10-21 14:00", "end": "2026-10-21 23:30", "showStart": true, "showEnd": true,
                "url": "https://www.amsterdam-dance-event.nl/en/program/2026/313x020-bbq-amsterdam-invites-detroit/2843412/",
                "venueId": "40620", "soldOut": false,
                "categories": "Daytime events / Nighttime events / Detroit Techno / House / Techno / NDSM",
                "interests": ["Daytime events","Nighttime events","NDSM","Detroit Techno","House","Techno"],
                "lineup": ["Angelo D’Onorio (NL)", "..."],
                "ticketUrl": "https://shop.weeztix.com/.../tickets", "ticketText": "Buy Tickets",
                "image": "https://cdn.amsterdam-dance-event.nl/images/.../amsterdam.webp",
                "description": "Detroit Techno Militia, Amsterdam’s Most Wanted and ... (max 900 chars)" } ],
  "basemap": { "origin": [4.7, 52.3], "scale": 100000,
               "layers": { "water": [...], "park": [...], "canal": [...], "road1": [...], "road2": [...], "rail": [...] } }
}
```

Facts about the data:

- 1,263 unique events, 317 venues, every event has a venue and every venue has coordinates.
- Per day: Wed 21: 161 · Thu 22: 297 · Fri 23: 335 · Sat 24: 316 · Sun 25: 154.
- 842 events have a ticket URL, 37 are marked sold out, 346 have no line‑up listed (installations, exhibitions, some parties).
- 504 events end on a different calendar day than they start (overnight). All times are Europe/Amsterdam local time, no timezone suffix.
- `categories` (string, `/`‑separated) and `interests` (array) carry the same tags. Tags mix genres (House, Techno, Trance, Disco, Afro House…), time of day (Daytime events, Nighttime events, Morning events, All night long), venue size (Intimate / Mid-size / Large venues, Warehouses, Unique venues), area (Centre, West, NDSM, Noord…) and type (Club nights, Live, Exhibitions, Free Festival Events, Networking events…). The app should split these into facets (genre / time / venue type / area) with a hand-written mapping table; anything unmapped goes to "Other".
- Several venues share one address (Rembrandtplein 17 hosts Three Sisters Pub, Escape deLux, Oliva; Overhoeksplein 1 hosts A'DAM Toren, The Loft, The Forbidden Garden). Pins will overlap exactly — the UI must handle that (see §4.3).
- Duplicate venue records exist (e.g. "Oceandiva Original" appears twice with two IDs). Treat venue identity by ID; optionally merge by normalised name+coordinates for display.
- Nine venues have hand-placed coordinates (`geo` = `manual…`) because the geocoder failed: Gashouder, WestWeelde, De Wester (Westergas terrain), Pacific Amsterdam, Wereldmuseum, Oceandiva Original, De Sering, Transit, 50:HERTZ Club Train (Central Station). Accurate to roughly 50 m.
- `basemap` is a simplified OpenStreetMap extract (water, canals, major roads, rail, parks) for the bbox 52.30–52.42 N, 4.76–4.98 E. Coordinates are integers: `lng = x/scale + origin[0]`, `lat = y/scale + origin[1]`. `water` and `park` entries are polygons (`[outerRing, hole, hole…]`, fill with even‑odd); other layers are polylines. It exists as an offline/fallback basemap; with a real tile provider (see §5) it is optional. © OpenStreetMap contributors, ODbL.

### 2.2 How the data was obtained (so it can be refreshed)

The ADE site renders the program client‑side from an undocumented JSON endpoint. Everything below was verified on 7 Oct 2026.

Program list (festival events; type IDs 8262 and 8263 are "ADE Festival"; 8264 is the conference):

```
GET https://www.amsterdam-dance-event.nl/api/program/filter/?type=8262,8263&from=2026-10-21&to=2026-10-21&page=1
→ { "data": [ { id, handle:"events", title, subtitle,
                start_date_time:{date:"2026-10-21 14:00:00.000000", timezone:"Europe/Amsterdam"},
                show_start_date_time, end_date_time:{...}, show_end_date_time,
                url, venue:{title}, soldOut, categories:"A / B / C" } ] }
```

- 40 items per page; iterate `page` until `data` is empty. Query one day at a time (`from` = `to`), days 2026‑10‑21 … 25; de‑duplicate by `id` (a few events appear on two days).
- No venue ID, address, line‑up or ticket link in the list → fetch each event's `url` (plain HTML, ~1,263 requests, fine with concurrency 6–8, took ~1 min).

Event page selectors:

| Field | Selector |
|---|---|
| line‑up | `a.link__line-up` (text; links go to `/en/artists-speakers/<slug>/<id>/`) |
| venue page | `.ade-info-bar__data-link[href*="/venues/"]` → `/en/venues/<slug>/<venueId>/` |
| address | `.ade-info-bar__data-link[href*="google.com/maps"]` (text, e.g. "NDSM Plein 102, Amsterdam") |
| ticket link | `a.ade-info-bar__button` (href + text, usually "Buy Tickets") |
| tags | `.ade-info-bar__data-link[href*="category"]` |
| description | `<p>` elements in `main` longer than 40 chars; the first one often repeats the line‑up — drop it if it equals `lineup.join(' / ')` |
| image | `meta[property="og:image"]` |
| calendar | `/en/events/calendar/<eventId>.ics` |

Geocoding: PDOK Locatieserver (free, no key, Dutch government):

```
GET https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=<address>&fq=type:adres&fq=gemeentenaam:Amsterdam&rows=1&fl=weergavenaam,centroide_ll,score
→ response.docs[0].centroide_ll = "POINT(4.89694778 52.39959633)"   (lng lat)
```

Validate every hit: the returned street must start with the queried street and the point must fall inside 52.28–52.45 N / 4.72–5.05 E; otherwise fall back to the manual table (§2.1). Addresses on the ADE site are free text, so normalise first (strip venue name prefixes, "2 Linnaeusstraat" → "Linnaeusstraat 2", "Rhoneweg, 6" → "Rhôneweg 6").

Basemap (optional refresh): Overpass API, bbox `52.30,4.76,52.42,4.98`, query `natural=water` (ways + relations), `waterway=river|canal`, `highway=motorway|trunk|primary|secondary|tertiary`, `railway=rail` without `service`, `leisure=park`; `out geom;` then Douglas‑Peucker simplify at ~6 m and quantise to 1e‑5°. The public Overpass instance was slow; split ways and relations into separate requests.

Build these as `scripts/fetch-program.mjs`, `scripts/geocode.mjs`, `scripts/build-data.mjs` (Node 20+, no dependencies beyond `undici`/native fetch and a small HTML parser such as `node-html-parser`). Cache raw responses under `scripts/.cache/` so a re‑run only fetches new or changed events. Output `public/data/ade-2026.json` in the same schema, plus `public/data/ade-2026.meta.json` with `generated`, counts and the manual-fix list.

Respectful scraping: concurrency ≤ 8, a descriptive User‑Agent, no re‑fetch of unchanged pages, and nothing redistributed beyond personal use.

---

## 3. Product spec (what the user sees)

### 3.1 Screens

The app is a single screen with a full‑height map and a bottom sheet. On phones the sheet has three states: collapsed (a 56 px handle with a summary line, e.g. "Fri 23 · 335 parties"), half (≈45 % of the screen, list scrolls inside), expanded (≈92 %). On wide screens (≥ 900 px) the sheet becomes a left side panel of 400 px and the map fills the rest.

Top bar (floating over the map, safe‑area aware):

- Day chips: `Wed 21 · Thu 22 · Fri 23 · Sat 24 · Sun 25 · All`. Default on open = today if today is within 21–25 Oct, otherwise Wed 21.
- Search field (party title, subtitle, venue, artist). Results replace the list; matching pins stay highlighted, others fade.
- Filter button with a badge showing the number of active filters → filter sheet: genre (multi‑select), time of day (Day / Night / Morning / All night), venue type, area, "free events", "tickets available (hide sold out)".
- "Now" toggle: shows only parties running at the current time (start ≤ now < end) plus the ones starting within the next 2 hours; sorted by start time. Shown only during the festival dates.

Map:

- Pins are per venue, not per event. A pin shows a count badge when the venue has more than one party on the selected day. Pin colour encodes status: default, has a favourite (gold ring), happening now (pulsing), all parties sold out (muted).
- Zoom levels: min 11 (whole city), max 18. Opens on zoom 13 centred on 52.370 N 4.895 E (Centrum) or on the user's location if permission is granted (a "locate me" button; never ask on load).
- Labels: venue names appear from zoom 14 with simple collision avoidance; neighbourhood labels (Centrum, Jordaan, De Pijp, Oost, Noord, NDSM, Westerpark, Sloterdijk, Zuid, Zuidoost) at low zoom.
- Tapping a pin: if several venues sit within ~16 px of the tap, show a venue chooser first (name + party count); otherwise open the venue sheet directly.

Venue sheet: venue name, address, "Directions" (Google Maps / Apple Maps link built from lat/lng), ADE venue page link, then the venue's parties for the selected day as cards ordered by start time (title, time range, genre chips, sold‑out badge, star).

Party detail sheet: image (lazy, 16:9, graceful if missing), title, subtitle, day + time range with overnight indicated ("Sat 24 · 23:00 → 07:00 Sun"), status line (Starts in 2 h / Live now / Ended), venue + address (tap → fly to pin), line‑up as a wrapped list (hide section if empty), genre and other tags as chips, description (collapsed to 5 lines, "Read more"), buttons: Buy tickets (hidden if none; disabled "Sold out" if `soldOut`), Open on ADE site, Add to calendar (`.ics` link), Directions, Star. Back returns to wherever the user came from (venue sheet, list, area results).

List mode: a toggle in the sheet header switches the sheet content between "venues on the map" and "all parties for this day" (grouped by start hour, infinite scroll not needed at ≤ 335 items, but virtualise if scrolling is janky on mid‑range phones). Tapping a list item centres the map on its pin and opens the detail.

### 3.2 Area selection (phase 2, but build it in the first codebase)

- "Select area" button on the map (bottom‑right stack, with locate and zoom‑to‑fit). Entering draw mode shows a hint "Draw around the area you want" and disables map panning (one‑finger drag draws; two fingers still pan/zoom).
- Freehand lasso: pointer path is captured, simplified, closed, and rendered as a translucent polygon with a dashed edge. Rectangle is an alternative mode via a small toggle (lasso / box). Minimum size guard: if the polygon area is < 40 px², treat as a tap and ignore.
- On release: parties whose venue coordinates fall inside the polygon (ray casting, in screen or geographic space) and that pass the current day/filter/search are listed in the sheet with a header "23 parties in this area · Fri 23" and a "Clear area" action. The polygon stays on the map; pins outside it fade. Changing the day re‑evaluates the same polygon.
- Keep it keyboard/desktop friendly: shift+drag draws a box on desktop.

### 3.3 Favourites and personal layer

- Star on every party card and detail. Stored in `localStorage` under a versioned key (`ade2026.favs.v1`: array of event IDs). Export/import as a text blob (copy to clipboard / paste) so it can move between phone and laptop without a backend.
- "My list" chip in the day bar shows only favourites (across days, grouped by day) and highlights their pins. Detect time overlaps between favourites and show a small "clashes with …" note.

### 3.4 PWA and offline

- `manifest.webmanifest` (name "ADE 2026 Map", standalone display, portrait, theme colours for light/dark), icons 192/512 (+ maskable), iOS meta tags.
- Service worker: precache app shell + `ade-2026.json`; stale‑while‑revalidate for tiles with a capped cache (≈150 MB) and a bounding box limited to Amsterdam; network‑first for the data file with fallback to cache; show a small "Updated program available — reload" toast when a new data version is detected.
- Everything the UI needs is in the JSON, so the app is fully usable offline except for tiles outside the cache and the event images.

### 3.5 Accessibility and polish

- All controls reachable by keyboard, visible focus, `aria-live` for list header updates, `prefers-reduced-motion` respected (no pin pulse), minimum 44 px touch targets, text contrast ≥ 4.5:1 in both themes.
- Dark theme by default after 18:00 local time (map style switches too); manual toggle persists.
- Tabular numerals for times; dates in English with the Dutch day numbering already used by ADE ("Fri 23").

---

## 4. Technical design

### 4.1 Stack

- **Vite + TypeScript + Svelte 5** (or Preact — small, fast, no runtime penalty on phones). Avoid heavy UI kits; write the few components by hand.
- **MapLibre GL JS 4.x** for the map (vector tiles, WebGL, smooth pinch‑zoom, rotation disabled). Basemap style and tiles from **OpenFreeMap** (`https://tiles.openfreemap.org/styles/liberty` or `/positron` for a quieter look; free, no key, OSM‑based). Fallback option if that is unavailable: MapTiler free tier (key required) or raster OSM tiles with Leaflet. Include the bundled `basemap` layers from the JSON as a MapLibre GeoJSON source that is shown only if the remote style fails to load, so the map is never blank.
- Pins as a **GeoJSON source with `cluster: false`** and symbol/circle layers, or as HTML markers if the count stays ≤ 350 (it does). Prefer the GeoJSON layer approach for performance and for the fade/highlight states via feature‑state.
- Drawing: implement the lasso yourself on an overlay `<canvas>` (≈150 lines) rather than pulling in mapbox‑gl‑draw; convert the path with `map.unproject` to lng/lat and test points with a ray‑casting function. Keep `@turf/boolean-point-in-polygon` as an optional dependency if preferred.
- Search: client‑side with a prebuilt index (title, subtitle, venue, line‑up) using a tiny fuzzy matcher (`fuse.js` ≈ 10 kB, or a simple normalised `includes` across tokens).
- State: a single store (`day`, `filters`, `query`, `nowMode`, `selectedVenueId`, `selectedEventId`, `areaPolygon`, `favourites`, `sheetState`). URL hash mirrors `day`, `event` and `venue` so a party can be deep‑linked and the back button works (`#d=24&e=2843412`).
- Dates: handle in local time; the data is already Europe/Amsterdam. Use `Temporal` polyfill or `date-fns` only if needed; plain `Date` with manual parsing of `YYYY-MM-DD HH:mm` is enough.
- Tests: Vitest for pure functions (time status, day grouping, point‑in‑polygon, facet mapping, search). Playwright for 3 smoke flows on a mobile viewport (open → tap pin → detail; day switch; lasso → results).
- Hosting: static. GitHub Pages, Netlify or Vercel; the build is plain files. HTTPS is required for service worker and geolocation.

### 4.2 Project structure

```
ade-map/
  public/
    data/ade-2026.json           (copy of data/ade-2026-data.json, re-generated by scripts)
    icons/…  manifest.webmanifest
  scripts/
    fetch-program.mjs            (API list → raw/events.json)
    fetch-event-pages.mjs        (detail pages → raw/details.json, cached)
    geocode.mjs                  (PDOK + manual-fixes.json → raw/venues.json)
    build-data.mjs               (merge → public/data/ade-2026.json + meta)
    manual-fixes.json
  src/
    lib/data.ts                  (load + index data, facet mapping table)
    lib/time.ts                  (parse, day grouping, status: upcoming/live/ended, overnight)
    lib/geo.ts                   (point in polygon, bbox, nearest pins)
    lib/search.ts
    lib/store.ts                 (app state, URL hash sync, favourites persistence)
    map/Map.svelte               (MapLibre init, pins, highlight, fly-to)
    map/Lasso.ts                 (overlay canvas drawing)
    ui/TopBar.svelte  DayChips.svelte  FilterSheet.svelte
    ui/Sheet.svelte              (bottom sheet with snap points, side panel on desktop)
    ui/VenueView.svelte  EventCard.svelte  EventDetail.svelte  AreaResults.svelte  ListView.svelte
    sw.ts
  tests/…
```

### 4.3 Key algorithms and edge cases

- **Day of an event** = calendar day of `start` (this is how ADE lists it, so a 01:00 Sunday party is "Sun 25"). In the list, additionally show "late night" items (start 00:00–05:59) at the end of the previous day's list under a divider "After midnight" — toggleable in settings, default on.
- **Status**: `upcoming` (start > now), `soon` (0–120 min), `live` (start ≤ now < end), `ended`. If `showEnd` is false, treat end = start + 6 h for status only and don't display the end time.
- **Overlapping pins**: on tap, collect venues within 16 px of the point (`map.project`); if > 1, show a chooser. Also apply a tiny deterministic jitter (≤ 6 px at zoom ≥ 15) to venues sharing identical coordinates so badges stay readable.
- **Lasso**: simplify the pointer path (Douglas‑Peucker 3 px), require ≥ 3 points, close it, convert to lng/lat once, test each venue (317) — trivial cost. Re‑test on day/filter change without redrawing.
- **Filters**: AND across facets, OR within a facet. Search applies on top. Counts in the filter sheet reflect the current day.
- **Performance**: data JSON is ~2.3 MB without the basemap; keep the basemap in a separate file loaded only on fallback. Target first interactive < 2 s on a mid‑range phone over 4G: gzip/brotli the JSON (~400 kB), lazy‑load images, avoid re‑rendering the list on map moves.
- **Data refresh**: the app reads `meta.generated` and shows "Program as of 7 Oct" in the sheet footer. Re‑running the scripts before and during ADE picks up new events, line‑up changes and sold‑out flags.

---

## 5. Implementation plan (ordered tasks with acceptance criteria)

Each task should be a commit. Keep the app runnable after every task.

**T0 — Scaffold.** Vite + TS + Svelte, ESLint/Prettier, Vitest, Playwright, GitHub Actions running tests and deploying to Pages. Copy `data/ade-2026-data.json` to `public/data/ade-2026.json`. ✔ `npm run dev` shows an empty full‑screen page with the title.

**T1 — Data layer.** `data.ts` loads the JSON, builds `venuesById`, `eventsByDay`, `eventsByVenue`, facet mapping (genre / time / venue type / area / other) and the search index. `time.ts` with parsing and status. Unit tests for grouping counts (161/297/335/316/154), overnight detection (504), facet mapping of the top 40 tags. ✔ Tests green.

**T2 — Map with pins.** MapLibre with OpenFreeMap style, Amsterdam bounds, pins from a GeoJSON source with per‑venue counts for the selected day, count badge, light/dark style switch. Fallback GeoJSON basemap when the style fails. ✔ All 317 venues visible; tapping a pin logs the venue.

**T3 — Bottom sheet + venue view + event detail.** Sheet with three snap points, drag gesture, side‑panel layout on desktop. Venue view lists that day's parties; detail view with every field in §3.1; overlapping‑pin chooser. Deep link via URL hash. ✔ Flow: open → tap Paradiso → see parties → open one → ticket link opens in new tab → back works.

**T4 — Day chips, search, filters, Now mode.** Pins and lists react to all four. Pins outside the result set fade to 30 %. ✔ Switching to "Sat 24" updates counts and badge numbers; searching "Charlotte" finds line‑up matches.

**T5 — List mode.** Day list grouped by hour with "After midnight" section; tap → fly to pin + detail. ✔ Smooth scrolling of 335 items on a phone.

**T6 — Area selection.** Lasso/box overlay, results header, clear action, fading of outside pins, re‑evaluation on day change. ✔ Draw around Rembrandtplein on Fri → list shows only those venues' parties.

**T7 — Favourites.** Star everywhere, "My list" chip, clash note, export/import. ✔ Survives reload.

**T8 — PWA.** Manifest, icons, service worker with the caching policy in §3.4, update toast. ✔ Installable on iOS and Android; airplane mode → app opens, map tiles previously seen still show, lists work.

**T9 — Data pipeline scripts.** Implement §2.2 as Node scripts with caching, validation report (events without venue, geocode misses, outside‑bbox points) and a `npm run data:refresh` command. ✔ Re‑run reproduces the current JSON (same IDs), prints a diff summary.

**T10 — Polish and QA.** Accessibility pass, reduced motion, empty states ("No parties match — clear filters"), error state when data fails to load, Lighthouse PWA ≥ 90, test on a real phone outdoors in daylight (contrast). ✔ Playwright smoke suite green on mobile viewport.

Nice‑to‑have after T10: route between two favourites with walking time; "near me" radius mode; share a party as a link; push the favourites list into the phone calendar via one combined `.ics`.

---

## 6. Design direction

Utility first: the app is used standing on a street at night. Dark theme optimised for outdoor glare (true dark background, high‑contrast type, pins with a light halo); light theme for daytime. One accent colour for selection and favourites, a separate semantic colour for "live now", muted grey for sold out. Typeface pair: a condensed grotesk for titles and chips (the ADE vernacular is bold, typographic, black‑on‑yellow) and a readable humanist sans for body text; tabular figures for times. Keep the map calm (Positron‑style basemap) so pins and the drawn area carry the colour.

---

## 7. Open questions for Fabrizio

1. Hosting preference (GitHub Pages is simplest; Netlify if you want a custom domain)?
2. Should the conference (ADE Pro, type 8264) be included as a toggle later?
3. Is a map style with street names worth a free MapTiler key as a backup, or is OpenFreeMap enough?

---

## 8. Attribution and licences

Program data © Amsterdam Dance Event, used for personal planning only. Geocoding by PDOK Locatieserver (Kadaster, open data). Map data © OpenStreetMap contributors (ODbL); tiles by OpenFreeMap (keep their attribution control visible).
