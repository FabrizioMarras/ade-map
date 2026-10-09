// Decides whether a run of the refresh-data workflow should rebuild the programme.
//
// GitHub runs scheduled workflows late and irregularly (hours apart when busy), so the gate
// looks at how old the published programme is instead of at the clock: before ADE week a
// programme older than 20 h is refreshed, during the week (19–26 Oct) one older than 90 min,
// and from 27 Oct on nothing is refreshed. A manual run always goes ahead.
//
// Usage: node scripts/refresh-due.mjs [meta.json] [--manual]
// Prints the decision and appends `due=true|false` to $GITHUB_OUTPUT when set.

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HOUR = 3_600_000;
const WEEK_FROM = '2026-10-19';
const STOP_FROM = '2026-10-27';

/** "YYYY-MM-DD" in Amsterdam. */
export function amsterdamDate(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(date);
}

/** Maximum age (ms) of the published programme before a run refreshes it; null = never. */
export function maxAge(now) {
  const day = amsterdamDate(now);
  if (day >= STOP_FROM) return null;
  if (day >= WEEK_FROM) return 1.5 * HOUR;
  return 20 * HOUR;
}

/**
 * @param {{ generated?: string | null, now: Date, manual?: boolean }} o
 * @returns {{ due: boolean, reason: string }}
 */
export function refreshDue({ generated, now, manual = false }) {
  if (manual) return { due: true, reason: 'manual run' };
  const limit = maxAge(now);
  if (limit === null) return { due: false, reason: 'festival over' };
  const at = generated ? Date.parse(generated) : NaN;
  if (!Number.isFinite(at)) return { due: true, reason: 'no published programme' };
  const age = now.getTime() - at;
  const mins = Math.round(age / 60_000);
  return age > limit
    ? { due: true, reason: `programme is ${mins} min old (limit ${limit / 60_000} min)` }
    : { due: false, reason: `programme is ${mins} min old (limit ${limit / 60_000} min)` };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  let generated = null;
  if (file && existsSync(file)) {
    try {
      generated = JSON.parse(readFileSync(file, 'utf8')).generated ?? null;
    } catch {
      /* unreadable: treated as missing, so the run refreshes */
    }
  }
  const { due, reason } = refreshDue({ generated, now: new Date(), manual: args.includes('--manual') });
  console.log(`Published programme generated ${generated ?? '(none)'}: ${reason} → due=${due}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `due=${due}\n`);
}
