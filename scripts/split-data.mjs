// Derive the files the app loads from public/data/ade-2026.json:
//   ade-2026.core.json — everything except descriptions (needed for the first paint)
//   ade-2026.text.json — { eventId: description }, fetched in the background
import { join } from 'node:path';
import { ROOT, isMain, readJSON, writeJSON } from './lib.mjs';

export function splitData() {
  const dir = join(ROOT, 'public/data');
  const data = readJSON(join(dir, 'ade-2026.json'), null);
  if (!data) throw new Error('public/data/ade-2026.json is missing');
  const text = {};
  const events = data.events.map(({ description, ...e }) => {
    if (description) text[e.id] = description;
    return e;
  });
  writeJSON(join(dir, 'ade-2026.core.json'), { ...data, events }, false);
  writeJSON(join(dir, 'ade-2026.text.json'), { generated: data.generated, descriptions: text }, false);
  return { events: events.length, descriptions: Object.keys(text).length };
}

if (isMain(import.meta.url)) {
  const r = splitData();
  console.log(`core: ${r.events} events · text: ${r.descriptions} descriptions`);
}
