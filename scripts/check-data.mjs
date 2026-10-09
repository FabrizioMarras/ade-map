// Sanity check of a programme before a data-only deploy (no test suite runs on that path):
// the files parse, there are events, and every event sits at a venue the map can place.
//
// Usage: node scripts/check-data.mjs [dir]   (default public/data); exits 1 on a problem.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Problems found in `dir` (empty when the programme looks deployable). */
export function checkData(dir) {
  const problems = [];
  const read = (name) => {
    try {
      return JSON.parse(readFileSync(join(dir, name), 'utf8'));
    } catch (e) {
      problems.push(`${name}: ${e.code === 'ENOENT' ? 'missing' : `does not parse (${e.message})`}`);
      return null;
    }
  };
  const meta = read('ade-2026.meta.json');
  const core = read('ade-2026.core.json');
  const text = read('ade-2026.text.json');

  if (meta && !(meta.events > 0)) problems.push(`meta.json: events is ${meta.events}`);
  if (text && (typeof text.descriptions !== 'object' || text.descriptions === null))
    problems.push('text.json: no descriptions');
  if (core) {
    if (!Array.isArray(core.events) || !Array.isArray(core.venues)) {
      problems.push('core.json: no events or venues');
      return problems;
    }
    if (meta && core.events.length !== meta.events)
      problems.push(`core.json has ${core.events.length} events, meta.json says ${meta.events}`);
    if (meta && core.generated !== meta.generated)
      problems.push(`core.json generated ${core.generated}, meta.json ${meta.generated}`);
    const venues = new Map(core.venues.map((v) => [v.id, v]));
    const unplaced = [];
    for (const e of core.events) {
      const v = venues.get(e.venueId);
      if (!v || !Number.isFinite(v.lat) || !Number.isFinite(v.lng)) unplaced.push(e.id);
    }
    if (unplaced.length)
      problems.push(
        `${unplaced.length} events without a venue with coordinates: ${unplaced.slice(0, 10).join(', ')}`,
      );
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] ?? 'public/data';
  const problems = checkData(dir);
  if (problems.length) {
    console.error(`Programme in ${dir} failed the sanity check:`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  const meta = JSON.parse(readFileSync(join(dir, 'ade-2026.meta.json'), 'utf8'));
  console.log(`Programme OK: ${meta.events} events at ${meta.venues} venues, generated ${meta.generated}`);
}
