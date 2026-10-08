/**
 * TicketSwap (fan-to-fan resale) deep links. TicketSwap has no public API and scraping is not
 * allowed, so the app only links to its search, or to a specific URL set in the data.
 * Search format verified in a browser: https://www.ticketswap.com/search?query=<terms>
 */
export const TICKETSWAP_SEARCH = 'https://www.ticketswap.com/search?query=';

/** Search terms longer than this are cut at a word boundary (long titles find nothing). */
export const MAX_QUERY = 60;

const SEPARATORS = /\s+(?:[-–—|]|\/\/)\s+|\s*\|\s*/;

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

/**
 * Turn a party title into TicketSwap search terms: drop bracketed suffixes, the subtitle,
 * venue mentions and "ADE", strip emoji/symbols, collapse whitespace and cap the length.
 */
export function ticketswapQuery(title: string, opts: { venue?: string; subtitle?: string } = {}): string {
  const venue = fold(opts.venue ?? '');
  const subtitle = fold(opts.subtitle ?? '');
  const isNoise = (seg: string) => {
    const f = fold(seg);
    return !f || f === 'ade' || f === 'ade2026' || (venue && f === venue) || (subtitle && f === subtitle);
  };

  let t = title
    // Bracketed suffixes: "(Day 1)", "[techno set]", "{…}"; then any unmatched bracket.
    .replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, ' ')
    .replace(/[()[\]{}]/g, ' ')
    // Emoji and symbols (®, ™, pictographs) and invisible joiners.
    .replace(/\p{Extended_Pictographic}|\p{So}|\u200d|\ufe0f/gu, ' ');

  // "… @ Venue" / "… at Venue" (only when it names this venue, or ADE).
  t = t.replace(/\s+(?:@|at)\s+([^|–—-]+)$/i, (m, place: string) => (isNoise(place) ? ' ' : m));
  t = t.replace(/\s+@\s+ADE\b/i, ' ');

  const parts = t.split(SEPARATORS).filter((p) => !isNoise(p));
  let q = (parts.length ? parts : [t]).join(' ').replace(/\s+/g, ' ').trim();
  q = q.replace(/^[\s:,.;+&-]+|[\s:,.;+&-]+$/g, '');
  if (!q) q = (opts.venue ?? title).trim();

  if (q.length > MAX_QUERY) {
    const cut = q.slice(0, MAX_QUERY + 1);
    const space = cut.lastIndexOf(' ');
    q = (space > 20 ? cut.slice(0, space) : cut.slice(0, MAX_QUERY)).replace(/[\s:,.;+&-]+$/, '');
  }
  return q;
}

/** The TicketSwap link for a party: a URL set in the data wins over a search. */
export function ticketswapUrl(e: {
  title: string;
  subtitle?: string;
  ticketswapUrl?: string;
  venue?: { name: string };
}): string {
  if (e.ticketswapUrl) return e.ticketswapUrl;
  return (
    TICKETSWAP_SEARCH +
    encodeURIComponent(ticketswapQuery(e.title, { venue: e.venue?.name, subtitle: e.subtitle }))
  );
}
