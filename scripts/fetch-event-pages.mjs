// Event detail pages → scripts/raw/details.json (line-up, venue, address, tickets, tags, description, image)
import { parse } from 'node-html-parser';
import { join } from 'node:path';
import {
  RAW,
  adeRequestCount,
  amsterdamNow,
  cachedText,
  isMain,
  parseWall,
  pool,
  readJSON,
  recordRequests,
  saveFetchedIndex,
  writeJSON,
} from './lib.mjs';

const CONCURRENCY = 3; // gentle on the ADE site
const HOUR = 3_600_000;

/**
 * How old a cached event page may be. Line-ups change most for parties that are about to
 * happen: those starting within 12 h (or on now) are re-read when 6 h old, other upcoming
 * parties daily. A party that ended more than 6 h ago is never re-read (only read once, if it
 * was never cached). Sold-out flags, times and new events come from the list, read every run.
 */
export function pageMaxAgeHours(event, now = amsterdamNow()) {
  const start = parseWall(event.start_date_time?.date);
  const end = parseWall(event.end_date_time?.date) || start;
  if (end < now - 6 * HOUR) return Infinity;
  return start - now < 12 * HOUR ? 6 : 24;
}

const text = (el) =>
  (el?.text ?? '')
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
const decode = (s) => parse(`<p>${s}</p>`).text;

export function parseEventPage(html, lineupFallback = []) {
  const root = parse(html, { blockTextElements: { script: false, style: false } });
  const uniq = (xs) => [...new Set(xs.filter(Boolean))];

  const lineup = uniq(root.querySelectorAll('a.link__line-up').map(text));
  const venueLink = root.querySelector('.ade-info-bar__data-link[href*="/venues/"]');
  const venueHref = venueLink?.getAttribute('href') ?? '';
  const venueId = /\/venues\/[^/]+\/(\d+)\/?/.exec(venueHref)?.[1] ?? null;
  const address = text(root.querySelector('.ade-info-bar__data-link[href*="google.com/maps"]'));
  const ticket = root.querySelector('a.ade-info-bar__button');
  const tags = uniq(root.querySelectorAll('.ade-info-bar__data-link[href*="category"]').map(text));
  const image = root.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? '';

  const main = root.querySelector('main') ?? root;
  let paras = main
    .querySelectorAll('p')
    .map((p) =>
      decode(p.innerHTML.replace(/<br\s*\/?>/gi, ' '))
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((t) => t.length > 40);
  const lu = (lineup.length ? lineup : lineupFallback).join(' / ');
  if (paras.length && lu && paras[0] === lu) paras = paras.slice(1);
  const description = paras.join('\n\n').slice(0, 900);

  return {
    venueId,
    venueUrl: venueHref ? new URL(venueHref, 'https://www.amsterdam-dance-event.nl').href : '',
    venueName: text(venueLink),
    address,
    lineup,
    ticketUrl: ticket?.getAttribute('href') ?? '',
    ticketText: text(ticket),
    tags,
    image,
    description,
  };
}

if (isMain(import.meta.url)) {
  const events = readJSON(join(RAW, 'events.json'), null);
  if (!events) throw new Error('Run scripts/fetch-program.mjs first');
  let fetched = 0;
  const failures = [];
  const stale = [];
  const now = amsterdamNow();
  const rows = await pool(
    events,
    CONCURRENCY,
    async (e) => {
      const r = await cachedText(e.url, `pages/${e.id}.html`, pageMaxAgeHours(e, now));
      const { text: html, cached, status } = r;
      if (!cached) fetched++;
      if (r.stale) stale.push({ id: e.id, url: e.url, status });
      if (!html) {
        failures.push({ id: e.id, url: e.url, status });
        return null;
      }
      return [e.id, parseEventPage(html)];
    },
    'pages',
  );
  saveFetchedIndex();
  recordRequests('pages', adeRequestCount());
  const details = Object.fromEntries(rows.filter(Boolean));
  writeJSON(join(RAW, 'details.json'), details);
  console.log(
    `${Object.keys(details).length} pages parsed (${fetched} fetched, ${events.length - fetched} from cache)` +
      (failures.length ? `, ${failures.length} failed` : ''),
  );
  console.log(`${adeRequestCount()} page requests to the ADE site`);
  for (const f of failures) console.log(`  ! ${f.status ?? 'error'} ${f.url}`);
  if (stale.length)
    console.log(`${stale.length} pages could not be refreshed; their last good copy was used`);
  for (const f of stale.slice(0, 20)) console.log(`  ~ ${f.status ?? 'error'} ${f.url}`);
}
