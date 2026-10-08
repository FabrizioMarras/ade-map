// Venues (from the event pages) → coordinates via PDOK Locatieserver → scripts/raw/venues.json
import { join } from 'node:path';
import { CACHE, RAW, REFRESH, ROOT, get, isMain, readJSON, readManualFixes, writeJSON } from './lib.mjs';

const PDOK = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';
const BOUNDS = { minLat: 52.28, maxLat: 52.45, minLng: 4.72, maxLng: 5.05 };

export const fold = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

/** Free-text ADE address → "Street 12[a], Amsterdam" (or null if there is no street + number). */
export function normaliseAddress(address, venueName = '') {
  let parts = address
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .filter(
      (p) => !/^amsterdam$/i.test(p) && !/^\d{4}\s?[a-z]{2}$/i.test(p) && !/^(the )?netherlands$/i.test(p),
    );
  // Drop a leading venue-name part ("Paradiso, Weteringschans 6-8").
  if (parts.length > 1 && fold(parts[0]) === fold(venueName)) parts = parts.slice(1);
  // "Rhoneweg, 6" / "Camperstraat, 26 h" → "Rhoneweg 6" / "Camperstraat 26h"
  if (parts.length > 1 && /^\d+\s?[a-z]?(-\d+)?$/i.test(parts[1])) {
    parts = [`${parts[0]} ${parts[1].replace(/\s+/g, '')}`, ...parts.slice(2)];
  }
  let street = parts.find((p) => /\d/.test(p) && /[a-z]{3}/i.test(p)) ?? parts[0] ?? '';
  // "2 Linnaeusstraat" → "Linnaeusstraat 2"
  const lead = /^(\d+[a-z]?)\s+(.+)$/i.exec(street);
  if (lead) street = `${lead[2]} ${lead[1]}`;
  street = street.replace(/\s+/g, ' ').trim();
  return /\d/.test(street) ? `${street}, Amsterdam` : null;
}

export function validHit(query, doc) {
  const m = /POINT\(([\d.]+) ([\d.]+)\)/.exec(doc?.centroide_ll ?? '');
  if (!m) return null;
  const lng = +m[1];
  const lat = +m[2];
  if (lat < BOUNDS.minLat || lat > BOUNDS.maxLat || lng < BOUNDS.minLng || lng > BOUNDS.maxLng) return null;
  const qStreet = fold(query.replace(/\s*\d.*$/, ''));
  if (!fold(doc.weergavenaam).startsWith(qStreet)) return null;
  return { lat, lng, geo: doc.weergavenaam };
}

async function pdok(query) {
  const url = `${PDOK}?q=${encodeURIComponent(query)}&fq=type:adres&fq=gemeentenaam:Amsterdam&rows=1&fl=weergavenaam,centroide_ll,score`;
  const res = await get(url, { accept: 'application/json' });
  if (!res.ok) throw new Error(`PDOK HTTP ${res.status}`);
  return (await res.json()).response?.docs?.[0] ?? null;
}

if (isMain(import.meta.url)) {
  const events = readJSON(join(RAW, 'events.json'), null);
  const details = readJSON(join(RAW, 'details.json'), null);
  if (!events || !details) throw new Error('Run fetch-program and fetch-event-pages first');
  const manual = new Map(readManualFixes().venues.map((v) => [v.id, v]));
  const cachePath = join(CACHE, 'geocode.json');
  const cache = REFRESH ? {} : readJSON(cachePath, {});

  // One record per venue id; name from the program list, address from the event page.
  const venues = new Map();
  for (const e of events) {
    const d = details[e.id];
    if (!d?.venueId) continue;
    if (!venues.has(d.venueId)) {
      venues.set(d.venueId, {
        id: d.venueId,
        name: e.venue?.title || d.venueName,
        address: d.address,
        url: d.venueUrl,
      });
    } else if (!venues.get(d.venueId).address && d.address) venues.get(d.venueId).address = d.address;
  }

  // Last known good coordinates, reused when PDOK can't resolve an unchanged address.
  const previous = new Map(
    readJSON(join(ROOT, 'public/data/ade-2026.json'), { venues: [] }).venues.map((v) => [v.id, v]),
  );
  const misses = [];
  const reused = [];
  const out = [];
  for (const v of venues.values()) {
    const fix = manual.get(v.id);
    if (fix) {
      out.push({ ...v, lat: fix.lat, lng: fix.lng, geo: fix.note || 'manual' });
      continue;
    }
    const q = normaliseAddress(v.address ?? '', v.name);
    let hit = q ? cache[q] : null;
    if (q && hit === undefined) {
      hit = validHit(q, await pdok(q));
      cache[q] = hit;
      await new Promise((r) => setTimeout(r, 120)); // gentle on PDOK
    }
    const prev = previous.get(v.id);
    if (hit) out.push({ ...v, ...hit });
    else if (prev && prev.address === v.address) {
      out.push({ ...v, lat: prev.lat, lng: prev.lng, geo: prev.geo });
      reused.push(v);
    } else misses.push({ ...v, query: q });
  }
  writeJSON(cachePath, cache);
  writeJSON(join(RAW, 'venues.json'), out);
  console.log(
    `${out.length} venues located (${manual.size} manual, ${reused.length} kept from the previous build), ${misses.length} misses`,
  );
  for (const v of reused)
    console.log(`  ~ ${v.id} ${v.name} — "${v.address}" (PDOK miss, previous coordinates kept)`);
  for (const m of misses)
    console.log(`  ? ${m.id} ${m.name} — "${m.address}" → ${m.query ?? 'no street/number'}`);
  writeJSON(join(RAW, 'geocode-misses.json'), misses);
}
