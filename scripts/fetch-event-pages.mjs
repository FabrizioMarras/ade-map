// Event detail pages → scripts/raw/details.json (line-up, venue, address, tickets, tags, description, image)
import { parse } from 'node-html-parser';
import { join } from 'node:path';
import { RAW, cachedText, isMain, pool, readJSON, writeJSON } from './lib.mjs';

const CONCURRENCY = 6;

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
  const rows = await pool(
    events,
    CONCURRENCY,
    async (e) => {
      const { text: html, cached, status } = await cachedText(e.url, `pages/${e.id}.html`);
      if (!cached) fetched++;
      if (!html) {
        failures.push({ id: e.id, url: e.url, status });
        return null;
      }
      return [e.id, parseEventPage(html)];
    },
    'pages',
  );
  const details = Object.fromEntries(rows.filter(Boolean));
  writeJSON(join(RAW, 'details.json'), details);
  console.log(
    `${Object.keys(details).length} pages parsed (${fetched} fetched, ${events.length - fetched} from cache)` +
      (failures.length ? `, ${failures.length} failed` : ''),
  );
  for (const f of failures) console.log(`  ! ${f.status ?? 'error'} ${f.url}`);
}
