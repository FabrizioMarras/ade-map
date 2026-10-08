// Shared helpers for the data pipeline (Node 20+, native fetch).
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CACHE = join(ROOT, 'scripts/.cache');
export const RAW = join(ROOT, 'scripts/raw');
export const UA = 'ADE-2026-Map/1.0 (personal festival planner; low-rate, cached requests)';
export const DAYS = ['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'];

export const args = new Set(process.argv.slice(2));
export const REFRESH = args.has('--refresh');

export function readJSON(path, fallback) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback;
}

export function writeJSON(path, value, pretty = true) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, pretty ? 2 : 0) + (pretty ? '\n' : ''));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** GET with a descriptive User-Agent and a few retries on transient failures. */
export async function get(url, { accept = '*/*', tries = 3 } = {}) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept } });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      if (i >= tries) throw e;
      await sleep(1000 * i * i);
    }
  }
}

// When each cached file was fetched. Kept in an index rather than relying on file mtimes,
// which don't survive every cache restore (e.g. GitHub Actions' cache).
const FETCHED_INDEX = join(CACHE, 'fetched.json');
let fetchedAt = null;
function fetchedIndex() {
  fetchedAt ??= readJSON(FETCHED_INDEX, {});
  return fetchedAt;
}
export function saveFetchedIndex() {
  if (fetchedAt) writeJSON(FETCHED_INDEX, fetchedAt, false);
}

/**
 * Fetch text through a file cache. The ADE site sends no ETag/Last-Modified, so a cached
 * copy is reused while younger than `maxAgeHours` (unless --refresh). If a fetch fails,
 * the last good copy is used (`stale: true`) rather than losing the page.
 */
export async function cachedText(url, file, maxAgeHours = 12) {
  const path = join(CACHE, file);
  const index = fetchedIndex();
  const have = existsSync(path);
  const at = index[file] ?? (have ? statSync(path).mtimeMs : 0);
  if (!REFRESH && have && (Date.now() - at) / 3.6e6 < maxAgeHours) {
    return { text: readFileSync(path, 'utf8'), cached: true };
  }
  let status;
  try {
    const res = await get(url);
    status = res.status;
    if (res.ok) {
      const text = await res.text();
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
      index[file] = Date.now();
      return { text, cached: false };
    }
  } catch (e) {
    status = e.message;
  }
  if (have) return { text: readFileSync(path, 'utf8'), cached: true, stale: true, status };
  return { text: null, status, cached: false };
}

/** Current Europe/Amsterdam wall-clock time, encoded as if UTC (same as the app's time.ts). */
export function amsterdamNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t) => +(parts.find((p) => p.type === t)?.value ?? 0);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
}

/** "2026-10-21 14:00:00.000000" → wall-clock ms */
export function parseWall(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s ?? '');
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : NaN;
}

/** Append markdown to the GitHub Actions run summary (no-op locally). */
export function summary(md) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
}

/** Run `fn` over `items` with at most `n` in flight. */
export async function pool(items, n, fn, label = '') {
  let i = 0;
  let done = 0;
  const results = new Array(items.length);
  const worker = async () => {
    while (i < items.length) {
      const k = i++;
      results[k] = await fn(items[k], k);
      done++;
      if (label && process.stdout.isTTY) process.stdout.write(`\r${label} ${done}/${items.length}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  if (label && process.stdout.isTTY) process.stdout.write('\n');
  return results;
}

/** True when the calling module is the script Node was started with. */
export function isMain(metaUrl) {
  return !!process.argv[1] && metaUrl === pathToFileURL(process.argv[1]).href;
}

/** scripts/manual-fixes.json: `{ venues: [...], events: { id: {...} } }` (older files: just the venue array). */
export function readManualFixes() {
  const raw = readJSON(join(ROOT, 'scripts/manual-fixes.json'), {});
  return Array.isArray(raw)
    ? { venues: raw, events: {} }
    : { venues: raw.venues ?? [], events: raw.events ?? {} };
}
