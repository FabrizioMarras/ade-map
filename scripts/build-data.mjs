// Merge raw program + pages + venues → public/data/ade-2026.json and ade-2026.meta.json
import { join } from 'node:path';
import { RAW, ROOT, readJSON, writeJSON } from './lib.mjs';

const OUT = join(ROOT, 'public/data/ade-2026.json');
const META = join(ROOT, 'public/data/ade-2026.meta.json');
const BOUNDS = { minLat: 52.28, maxLat: 52.45, minLng: 4.72, maxLng: 5.05 };

const events = readJSON(join(RAW, 'events.json'), null);
const details = readJSON(join(RAW, 'details.json'), null);
const venues = readJSON(join(RAW, 'venues.json'), null);
if (!events || !details || !venues) throw new Error('Run the fetch and geocode scripts first');
const previous = readJSON(OUT, { events: [], venues: [] });

const wall = (d) => d.date.slice(0, 16); // "2026-10-21 14:00:00.000000" → "2026-10-21 14:00"
const venuesById = new Map(venues.map((v) => [v.id, v]));
const report = { noDetails: [], noVenue: [], unlocated: [], outsideBbox: [] };

const out = [];
for (const e of events) {
  const d = details[e.id];
  if (!d) {
    report.noDetails.push(e.id);
    continue;
  }
  if (!d.venueId) {
    report.noVenue.push(`${e.id} ${e.title}`);
    continue;
  }
  if (!venuesById.has(d.venueId)) {
    report.unlocated.push(`${e.id} ${e.title} @ ${d.venueId}`);
    continue;
  }
  const categories = e.categories ?? '';
  out.push({
    id: e.id,
    title: e.title,
    subtitle: e.subtitle ?? '',
    start: wall(e.start_date_time),
    end: wall(e.end_date_time),
    showStart: !!e.show_start_date_time,
    showEnd: !!e.show_end_date_time,
    url: e.url,
    venueId: d.venueId,
    soldOut: !!e.soldOut,
    categories,
    interests: d.tags.length ? d.tags : categories.split(' / ').filter(Boolean),
    lineup: d.lineup,
    ticketUrl: d.ticketUrl || null,
    ticketText: d.ticketUrl ? d.ticketText : null,
    image: d.image,
    description: d.description,
  });
}

const used = new Set(out.map((e) => e.venueId));
const outVenues = venues
  .filter((v) => used.has(v.id))
  .map(({ id, name, address, url, lat, lng, geo }) => ({ id, name, address, url, lat, lng, geo }));
for (const v of outVenues) {
  if (v.lat < BOUNDS.minLat || v.lat > BOUNDS.maxLat || v.lng < BOUNDS.minLng || v.lng > BOUNDS.maxLng) {
    report.outsideBbox.push(`${v.id} ${v.name} (${v.lat}, ${v.lng})`);
  }
}

const generated = new Date().toISOString();
writeJSON(
  OUT,
  {
    generated,
    source:
      'amsterdam-dance-event.nl program API (festival events, type 8262,8263); geocoding PDOK Locatieserver; basemap © OpenStreetMap contributors (ODbL)',
    venues: outVenues,
    events: out,
  },
  false,
);
const byDay = {};
for (const e of out) byDay[e.start.slice(0, 10)] = (byDay[e.start.slice(0, 10)] ?? 0) + 1;
writeJSON(META, {
  generated,
  events: out.length,
  venues: outVenues.length,
  byDay: Object.fromEntries(Object.entries(byDay).sort()),
  manualFixes: outVenues.filter((v) => v.geo.startsWith('manual')).map((v) => ({ id: v.id, name: v.name })),
});

// Validation report
console.log(`\n${out.length} events at ${outVenues.length} venues → public/data/ade-2026.json`);
console.log(
  'Per day:',
  Object.entries(byDay)
    .sort()
    .map(([d, n]) => `${d.slice(8)}: ${n}`)
    .join(' · '),
);
for (const [k, list] of Object.entries(report)) {
  console.log(`${k}: ${list.length}`);
  for (const x of list.slice(0, 20)) console.log(`  - ${x}`);
}

// Diff against the previous file
const prevById = new Map(previous.events.map((e) => [e.id, e]));
const nextById = new Map(out.map((e) => [e.id, e]));
const added = out.filter((e) => !prevById.has(e.id));
const removed = previous.events.filter((e) => !nextById.has(e.id));
const fields = [
  'title',
  'start',
  'end',
  'venueId',
  'soldOut',
  'lineup',
  'ticketUrl',
  'interests',
  'description',
  'image',
];
const changed = Object.fromEntries(fields.map((f) => [f, 0]));
for (const e of out) {
  const p = prevById.get(e.id);
  if (!p) continue;
  for (const f of fields) if (JSON.stringify(p[f]) !== JSON.stringify(e[f])) changed[f]++;
}
console.log(`\nDiff vs previous: +${added.length} added, -${removed.length} removed`);
for (const e of added.slice(0, 15)) console.log(`  + ${e.id} ${e.start} ${e.title}`);
for (const e of removed.slice(0, 15)) console.log(`  - ${e.id} ${e.start} ${e.title}`);
console.log(
  '  changed fields:',
  Object.entries(changed)
    .filter(([, n]) => n)
    .map(([f, n]) => `${f} ${n}`)
    .join(', ') || 'none',
);
const newlySoldOut = out.filter((e) => e.soldOut && prevById.get(e.id) && !prevById.get(e.id).soldOut);
if (newlySoldOut.length) console.log(`  newly sold out: ${newlySoldOut.map((e) => e.title).join('; ')}`);
