// Organiser insights from the published programme → public/data/insights.json.
// The /insights/ page renders this JSON; every number in its sentences comes from here.
// Run by build-data after each refresh, or standalone: `node scripts/build-insights.mjs`.
import { join } from 'node:path';
import { ROOT, isMain, readJSON, writeJSON } from './lib.mjs';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAYS = [
  ['2026-10-21', 'Wed 21'],
  ['2026-10-22', 'Thu 22'],
  ['2026-10-23', 'Fri 23'],
  ['2026-10-24', 'Sat 24'],
  ['2026-10-25', 'Sun 25'],
];
/** Hourly timeline: Wed 21 12:00 → Mon 26 08:00 (as in Pulse mode). */
const T_START = '2026-10-21 12:00';
const T_END = '2026-10-26 08:00';

/**
 * Neighbourhood centres (the same labels the map shows). A venue belongs to the nearest
 * centre — a simple, documented approximation, not official district borders.
 */
export const HOODS = [
  ['Centrum', 4.894, 52.3725],
  ['Jordaan', 4.88, 52.3765],
  ['De Pijp', 4.894, 52.3545],
  ['Oost', 4.93, 52.3605],
  ['Noord', 4.925, 52.393],
  ['NDSM', 4.893, 52.4025],
  ['Westerpark', 4.872, 52.3875],
  ['Sloterdijk', 4.838, 52.3885],
  ['Zuid', 4.872, 52.343],
  ['Zuidoost', 4.948, 52.312],
];

/** Areas compared for clustering: parties starting in the same 30 minutes within 1 km. */
export const CLUSTER_AREAS = [
  ['Rembrandtplein', 4.8966, 52.3662],
  ['Noord', 4.925, 52.393],
  ['Zuidoost', 4.948, 52.312],
];
export const CLUSTER_RADIUS_M = 1000;

export const SIZES = [
  ['Intimate venues', 'Intimate'],
  ['Mid-size venues', 'Mid-size'],
  ['Large venues', 'Large'],
  ['Warehouses', 'Warehouse'],
];

const GENRE_TOP = 6;

export const wall = (s) =>
  Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), +s.slice(11, 13), +s.slice(14, 16));

export function distanceM([lng1, lat1], [lng2, lat2]) {
  const rad = Math.PI / 180;
  const x = (lng2 - lng1) * rad * Math.cos(((lat1 + lat2) / 2) * rad);
  const y = (lat2 - lat1) * rad;
  return Math.hypot(x, y) * 6_371_000;
}

export function nearestHood(lng, lat) {
  let best = HOODS[0][0];
  let bestD = Infinity;
  for (const [name, hx, hy] of HOODS) {
    const d = distanceM([lng, lat], [hx, hy]);
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}

/** Genre tags, as split by the app (kept in sync with src/lib/facets.ts by a unit test). */
export function buildInsights(data, genreOf) {
  const venues = new Map(data.venues.map((v) => [v.id, v]));
  const events = data.events
    .filter((e) => venues.has(e.venueId))
    .map((e) => {
      const v = venues.get(e.venueId);
      const s = wall(e.start);
      const rawEnd = wall(e.end);
      return {
        ...e,
        s,
        // Same rule as the app: hidden or invalid end → start + 6 h.
        en: e.showEnd && rawEnd > s ? rawEnd : s + 6 * HOUR,
        day: e.start.slice(0, 10),
        hood: nearestHood(v.lng, v.lat),
        lng: v.lng,
        lat: v.lat,
        isFree: e.interests.some((t) => t === 'Free Festival Events' || t === 'Free A&C Events'),
      };
    });
  const live = (t) => events.filter((e) => e.s <= t && t < e.en);

  // 1. Parties live at each hour across the week.
  const hourly = [];
  for (let t = wall(T_START); t <= wall(T_END); t += HOUR) hourly.push(live(t).length);

  // 2. Parties by neighbourhood at 23:00 each day.
  const hoods = HOODS.map(([n]) => n);
  const at23 = DAYS.map(([key]) => {
    const counts = Object.fromEntries(hoods.map((h) => [h, 0]));
    for (const e of live(wall(`${key} 23:00`))) counts[e.hood]++;
    return counts;
  });

  // 3. Genre mix per neighbourhood: share of parties tagged with each of the top 6 genres.
  const genreCount = new Map();
  for (const e of events)
    for (const g of genreOf(e.interests)) genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
  const genres = [...genreCount.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, GENRE_TOP)
    .map(([g]) => g);
  const genreByHood = hoods.map((h) => {
    const inHood = events.filter((e) => e.hood === h);
    return {
      hood: h,
      total: inHood.length,
      counts: Object.fromEntries(
        genres.map((g) => [g, inHood.filter((e) => genreOf(e.interests).includes(g)).length]),
      ),
    };
  });

  // 4. Free vs paid by day (by start day, as the app lists them).
  const freeByDay = DAYS.map(([key]) => {
    const day = events.filter((e) => e.day === key);
    const free = day.filter((e) => e.isFree).length;
    return { free, paid: day.length - free };
  });

  // 5. Venue size mix by day (parties at venues ADE tags by size; untagged counted apart).
  const sizeByDay = DAYS.map(([key]) => {
    const day = events.filter((e) => e.day === key);
    const counts = Object.fromEntries(SIZES.map(([, label]) => [label, 0]));
    let untagged = 0;
    for (const e of day) {
      const tag = SIZES.find(([t]) => e.interests.includes(t));
      if (tag) counts[tag[1]]++;
      else untagged++;
    }
    return { counts, untagged };
  });

  // 6. Clustering: most parties starting in the same 30-minute window within 1 km.
  const clusters = CLUSTER_AREAS.map(([name, lng, lat]) => {
    const near = events.filter((e) => distanceM([lng, lat], [e.lng, e.lat]) <= CLUSTER_RADIUS_M);
    const windows = new Map();
    for (const e of near) {
      const w = e.s - (e.s % (30 * MIN));
      windows.set(w, (windows.get(w) ?? 0) + 1);
    }
    let peak = 0;
    let peakAt = null;
    for (const [w, n] of [...windows.entries()].sort((a, b) => a[0] - b[0])) {
      if (n > peak) {
        peak = n;
        peakAt = w;
      }
    }
    return {
      name,
      peak,
      peakAt: peakAt === null ? null : new Date(peakAt).toISOString().slice(0, 16).replace('T', ' '),
      parties: near.length,
    };
  });

  return {
    generated: data.generated,
    events: events.length,
    venues: data.venues.length,
    days: DAYS.map(([key, label]) => ({ key, label })),
    hourly: { start: T_START, stepMinutes: 60, counts: hourly },
    hoods,
    at23,
    genres,
    genreByHood,
    freeByDay,
    sizes: SIZES.map(([, label]) => label),
    sizeByDay,
    clusters,
    clusterRadiusM: CLUSTER_RADIUS_M,
    method: {
      neighbourhood: 'Each venue is assigned to the nearest of ten neighbourhood centres shown on the map.',
      live: 'A party is live from its start until its end; parties without a published end count for 6 hours.',
    },
  };
}

/** Genre tags of an event, using the app's facet table (scripts can't import the TS). */
export async function loadGenreOf() {
  const src = await import('node:fs').then((fs) => fs.readFileSync(join(ROOT, 'src/lib/facets.ts'), 'utf8'));
  const block = src.slice(src.indexOf('genre: ['), src.indexOf('],', src.indexOf('genre: [')));
  const genres = new Set([...block.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'")));
  return (tags) => tags.filter((t) => genres.has(t));
}

export async function writeInsights(dir = join(ROOT, 'public/data')) {
  const data = readJSON(join(dir, 'ade-2026.json'), null);
  if (!data) throw new Error('public/data/ade-2026.json is missing');
  const insights = buildInsights(data, await loadGenreOf());
  writeJSON(join(dir, 'insights.json'), insights, false);
  return insights;
}

if (isMain(import.meta.url)) {
  const i = await writeInsights();
  console.log(
    `insights: ${i.events} events, peak ${Math.max(...i.hourly.counts)} live, top genres ${i.genres.join(', ')}`,
  );
}
