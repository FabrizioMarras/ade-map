// Merge duplicate venue records: same normalised name (accents, case and punctuation ignored)
// and within 50 m. The record with the most events is kept; the others' events are remapped
// to it and their ids kept as `aliases` (so old #v=<id> links still work).
// Standalone: `node scripts/merge-venues.mjs` applies it to public/data in place.
import { join } from 'node:path';
import { ROOT, isMain, readJSON, writeJSON } from './lib.mjs';
import { splitData } from './split-data.mjs';

export const MERGE_RADIUS_M = 50;

const fold = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

export function distanceM(a, b) {
  const rad = Math.PI / 180;
  const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.hypot(x, y) * 6_371_000;
}

/**
 * @param {{id:string,name:string,lat:number,lng:number,aliases?:string[]}[]} venues
 * @param {{venueId:string}[]} events
 * @returns {{ venues: any[], events: any[], merged: { kept: string, name: string, removed: string[] }[] }}
 */
export function mergeDuplicateVenues(venues, events) {
  const count = new Map();
  for (const e of events) count.set(e.venueId, (count.get(e.venueId) ?? 0) + 1);
  const rank = (v) => [-(count.get(v.id) ?? 0), Number(v.id)];
  const better = (a, b) => {
    const [ca, ia] = rank(a);
    const [cb, ib] = rank(b);
    return ca - cb || ia - ib;
  };

  const byName = new Map();
  for (const v of venues) {
    const k = fold(v.name);
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(v);
  }

  const remap = new Map(); // removed id → kept id
  const merged = [];
  const keptAliases = new Map();
  for (const group of byName.values()) {
    if (group.length < 2) continue;
    const pending = [...group].sort(better);
    while (pending.length) {
      const keep = pending.shift();
      const near = pending.filter((v) => distanceM(keep, v) <= MERGE_RADIUS_M);
      if (!near.length) continue;
      for (const v of near) {
        pending.splice(pending.indexOf(v), 1);
        remap.set(v.id, keep.id);
      }
      const removed = near.map((v) => v.id);
      keptAliases.set(keep.id, [
        ...(keep.aliases ?? []),
        ...removed,
        ...near.flatMap((v) => v.aliases ?? []),
      ]);
      merged.push({ kept: keep.id, name: keep.name, removed });
    }
  }

  return {
    venues: venues
      .filter((v) => !remap.has(v.id))
      .map((v) => (keptAliases.has(v.id) ? { ...v, aliases: keptAliases.get(v.id) } : v)),
    events: events.map((e) => (remap.has(e.venueId) ? { ...e, venueId: remap.get(e.venueId) } : e)),
    merged,
  };
}

/** Groups of venues on the same spot (≈5 m), e.g. several bars at Rembrandtplein 17. */
export function sharedSpots(venues) {
  const groups = new Map();
  for (const v of venues) {
    const k = `${v.lat.toFixed(4)},${v.lng.toFixed(4)}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(v);
  }
  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g) => ({ address: g[0].address, venues: g.map((v) => v.name) }));
}

if (isMain(import.meta.url)) {
  const dir = join(ROOT, 'public/data');
  const data = readJSON(join(dir, 'ade-2026.json'), null);
  const r = mergeDuplicateVenues(data.venues, data.events);
  writeJSON(join(dir, 'ade-2026.json'), { ...data, venues: r.venues, events: r.events }, false);
  const meta = readJSON(join(dir, 'ade-2026.meta.json'), {});
  writeJSON(join(dir, 'ade-2026.meta.json'), {
    ...meta,
    venues: r.venues.length,
    venuesBeforeMerge: data.venues.length,
    mergedVenues: r.merged,
    manualFixes: (meta.manualFixes ?? []).filter((f) => r.venues.some((v) => v.id === f.id)),
    sharedSpots: sharedSpots(r.venues),
  });
  splitData();
  console.log(`${data.venues.length} → ${r.venues.length} venues`);
  for (const m of r.merged) console.log(`  merged ${m.removed.join(', ')} into ${m.kept} ${m.name}`);
}
