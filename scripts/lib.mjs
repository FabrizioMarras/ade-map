// Shared helpers for the data pipeline (Node 20+, native fetch).
import { mkdirSync, readFileSync, existsSync, writeFileSync, statSync } from 'node:fs';
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

/**
 * Fetch text through a file cache. The ADE site sends no ETag/Last-Modified, so a
 * cached copy is reused while younger than `maxAgeHours` (unless --refresh).
 */
export async function cachedText(url, file, maxAgeHours = 12) {
  const path = join(CACHE, file);
  if (!REFRESH && existsSync(path) && (Date.now() - statSync(path).mtimeMs) / 3.6e6 < maxAgeHours) {
    return { text: readFileSync(path, 'utf8'), cached: true };
  }
  const res = await get(url);
  if (!res.ok) return { text: null, status: res.status, cached: false };
  const text = await res.text();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  return { text, cached: false };
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
