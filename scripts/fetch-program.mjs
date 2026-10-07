// Program list (ADE Festival, types 8262/8263), one day at a time → scripts/raw/events.json
import { join } from 'node:path';
import { DAYS, RAW, get, writeJSON } from './lib.mjs';

const API = 'https://www.amsterdam-dance-event.nl/api/program/filter/';

const byId = new Map();
for (const day of DAYS) {
  let n = 0;
  for (let page = 1; page < 100; page++) {
    const url = `${API}?type=8262,8263&from=${day}&to=${day}&page=${page}`;
    const res = await get(url, { accept: 'application/json' });
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
    const { data } = await res.json();
    if (!data?.length) break;
    for (const e of data) {
      n++;
      if (!byId.has(e.id)) byId.set(e.id, e);
    }
  }
  console.log(`${day}: ${n} listed`);
}

const events = [...byId.values()];
writeJSON(join(RAW, 'events.json'), events);
console.log(`${events.length} unique events → scripts/raw/events.json`);
