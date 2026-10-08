// Merge raw program + pages + venues → public/data/ade-2026.json and ade-2026.meta.json
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { RAW, ROOT, args, readJSON, readManualFixes, summary, writeJSON } from './lib.mjs';
import { mergeDuplicateVenues, sharedSpots } from './merge-venues.mjs';
import { splitData } from './split-data.mjs';

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
const report = { noDetails: [], noVenue: [], unlocated: [], outsideBbox: [], badOverrides: [] };
const eventFixes = readManualFixes().events;
const TICKETSWAP_HOST = /^https:\/\/(www\.)?ticketswap\.(com|nl)\//;

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
  // Hand-set TicketSwap event page (otherwise the app links to a TicketSwap search).
  const tsUrl = eventFixes[e.id]?.ticketswapUrl;
  if (tsUrl && TICKETSWAP_HOST.test(tsUrl)) out[out.length - 1].ticketswapUrl = tsUrl;
  else if (tsUrl) report.badOverrides.push(`${e.id} ticketswapUrl is not a TicketSwap URL: ${tsUrl}`);
}

const used = new Set(out.map((e) => e.venueId));
const usedVenues = venues
  .filter((v) => used.has(v.id))
  .map(({ id, name, address, url, lat, lng, geo }) => ({ id, name, address, url, lat, lng, geo }));
// Duplicate venue records (same name within 50 m) become one; events are remapped.
const dedup = mergeDuplicateVenues(usedVenues, out);
const outVenues = dedup.venues;
out.splice(0, out.length, ...dedup.events);
const spots = sharedSpots(outVenues);
for (const v of outVenues) {
  if (v.lat < BOUNDS.minLat || v.lat > BOUNDS.maxLat || v.lng < BOUNDS.minLng || v.lng > BOUNDS.maxLng) {
    report.outsideBbox.push(`${v.id} ${v.name} (${v.lat}, ${v.lng})`);
  }
}

// Diff against the previously published programme.
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
const newlySoldOut = out.filter((e) => e.soldOut && prevById.get(e.id) && !prevById.get(e.id).soldOut);
const changedLineups = out.filter(
  (e) => prevById.get(e.id) && JSON.stringify(prevById.get(e.id).lineup) !== JSON.stringify(e.lineup),
);

// Safety check: a sudden large drop usually means the ADE site changed or fetching half
// failed. Refuse to publish; the previous programme stays live. Override with --force.
const MIN_RATIO = 0.8;
if (
  !out.length ||
  (previous.events.length && out.length < previous.events.length * MIN_RATIO && !args.has('--force'))
) {
  const msg = `Refusing to publish: ${out.length} events vs ${previous.events.length} before (minimum ${Math.round(MIN_RATIO * 100)}%). Re-run with --force if the drop is real.`;
  console.error(msg);
  summary(`### ❌ Programme not published\n\n${msg}\n`);
  process.exit(1);
}

// Fingerprint of the programme itself, so the app can tell real changes from re-checks.
const hash = createHash('sha256')
  .update(JSON.stringify({ venues: outVenues, events: out }))
  .digest('hex')
  .slice(0, 16);
const generated = new Date().toISOString();
writeJSON(
  OUT,
  {
    generated,
    hash,
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
  hash,
  events: out.length,
  venues: outVenues.length,
  venuesBeforeMerge: usedVenues.length,
  byDay: Object.fromEntries(Object.entries(byDay).sort()),
  mergedVenues: dedup.merged,
  sharedSpots: spots,
  manualFixes: outVenues.filter((v) => v.geo.startsWith('manual')).map((v) => ({ id: v.id, name: v.name })),
});

splitData();

// Validation report
const perDay = Object.entries(byDay)
  .sort()
  .map(([d, n]) => `${d.slice(8)}: ${n}`)
  .join(' · ');
const changedList =
  Object.entries(changed)
    .filter(([, n]) => n)
    .map(([f, n]) => `${f} ${n}`)
    .join(', ') || 'none';
const contentChanged = hash !== previous.hash;
console.log(`\n${out.length} events at ${outVenues.length} venues → public/data/ade-2026.json`);
console.log('Per day:', perDay);
console.log(`Venues: ${usedVenues.length} records → ${outVenues.length} after merging duplicates`);
for (const m of dedup.merged) console.log(`  merged ${m.removed.join(', ')} into ${m.kept} ${m.name}`);
console.log(`Shared spots (one pin with a chooser): ${spots.length}`);
for (const sp of spots) console.log(`  ${sp.address}: ${sp.venues.join(' · ')}`);
for (const [k, list] of Object.entries(report)) {
  console.log(`${k}: ${list.length}`);
  for (const x of list.slice(0, 20)) console.log(`  - ${x}`);
}
console.log(`\nDiff vs previous: +${added.length} added, -${removed.length} removed`);
for (const e of added.slice(0, 15)) console.log(`  + ${e.id} ${e.start} ${e.title}`);
for (const e of removed.slice(0, 15)) console.log(`  - ${e.id} ${e.start} ${e.title}`);
console.log('  changed fields:', changedList);
if (newlySoldOut.length) console.log(`  newly sold out: ${newlySoldOut.map((e) => e.title).join('; ')}`);
console.log(contentChanged ? `Programme changed (hash ${hash}).` : 'Programme unchanged since the last run.');

const list = (items, fmt) =>
  items
    .slice(0, 25)
    .map((x) => `- ${fmt(x)}`)
    .join('\n') + (items.length > 25 ? `\n- … and ${items.length - 25} more` : '');
summary(
  [
    `### ${contentChanged ? '✅ Programme updated' : '✅ Programme checked — no changes'}`,
    '',
    `**${out.length} events** at **${outVenues.length} venues** · ${perDay}`,
    '',
    `Venues: ${usedVenues.length} records → ${outVenues.length} after merging duplicates${
      dedup.merged.length ? ` (${dedup.merged.map((m) => m.name).join(', ')})` : ''
    } · ${spots.length} shared spots shown as one pin`,
    '',
    `Changes vs the last run: **+${added.length}** added, **−${removed.length}** removed, ${newlySoldOut.length} newly sold out, ${changedLineups.length} line-ups changed · fields: ${changedList}`,
    added.length ? `\n**Added**\n${list(added, (e) => `${e.start} — ${e.title}`)}` : '',
    removed.length ? `\n**Removed**\n${list(removed, (e) => `${e.start} — ${e.title}`)}` : '',
    newlySoldOut.length
      ? `\n**Newly sold out**\n${list(newlySoldOut, (e) => `${e.start} — ${e.title}`)}`
      : '',
    report.unlocated.length ||
    report.noVenue.length ||
    report.outsideBbox.length ||
    report.badOverrides.length
      ? `\n**Needs attention** (not on the map — add to \`scripts/manual-fixes.json\`)\n${list(
          [...report.unlocated, ...report.noVenue, ...report.outsideBbox, ...report.badOverrides],
          (x) => x,
        )}`
      : '',
    '',
  ].join('\n'),
);
