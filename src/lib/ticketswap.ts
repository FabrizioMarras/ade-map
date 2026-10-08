/**
 * TicketSwap (fan-to-fan resale) deep links. TicketSwap has no public API and scraping is not
 * allowed, so the app only links to its search, or to a specific URL set in the data.
 * Search format verified in a browser: https://www.ticketswap.com/search?query=<terms>
 */
export const TICKETSWAP_SEARCH = 'https://www.ticketswap.com/search?query=';

/** Search terms longer than this are cut at a word boundary (long titles find nothing). */
export const MAX_QUERY = 60;
/** TicketSwap matches every word, so the query is the party's core name: a few words at most. */
export const MAX_WORDS = 6;

/** Words a cut query must not end on. */
const CONNECTOR =
  /^(?:x|×|&|\+|and|with|by|feat\.?|ft\.?|b2b|vs\.?|presents?|pres\.?|invites?|of|the|for|at|@|por|de|van|der)$/i;

const SEPARATORS = /\s+(?:[-–—|]|\/\/)\s+|\s*\|\s*/;

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

/**
 * Turn a party title into TicketSwap search terms. TicketSwap only finds events that contain
 * every word searched for, so the query is the party's core name: drop bracketed suffixes, the
 * subtitle, venue mentions, "… for ADE"-style endings and show qualifiers ("Extra show",
 * "Day 2"), keep the name before a tagline (":" or " - ") or a guest list (","), strip
 * emoji/symbols, and cap it at a few words.
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

  // The name comes first: "Name - tagline", "Name | extra" → "Name".
  const parts = t.split(SEPARATORS).filter((p) => !isNoise(p));
  let q = (parts[0] ?? t).replace(/\s+/g, ' ').trim();
  const trim = (x: string) => x.replace(/^[\s:,.;+&-]+|[\s:,.;+&-]+$/g, '');
  // Shorten only while a real name remains.
  const keep = (x: string) => (trim(x).length >= 3 ? trim(x) : q);
  // "Swan Lake Remixed for ADE Extra show" → "Swan Lake Remixed".
  q = keep(q.replace(/\s+(?:for|x|at|@|by|with|during|\+)?\s*\bADE\b.*$/i, ''));
  // Show qualifiers at the end.
  q = keep(q.replace(/\s+(?:extra|special|second|2nd|third|3rd|late|early|bonus)\s+show$/i, ''));
  q = keep(q.replace(/\s+(?:day|part|vol\.?|volume|night)\s*\d+$/i, ''));
  q = keep(q.replace(/\s+(?:sold\s*out|edition)$/i, ''));
  // "DEEWEE: 2manydjs" → "DEEWEE", but "SONA Presents: Reznik" → "SONA Reznik" (the act is the name).
  const colon = q.match(/^(.{4,}?):\s+(.*)$/);
  if (colon) {
    const head = colon[1].match(/^(.+?)\s+(?:presents?|pres\.?|invites?)$/i);
    q = head ? keep(`${head[1]} ${colon[2]}`) : keep(colon[1]);
  }
  // Guest lists: "Copacabana Club with Mary Olivetti & …" → "Copacabana Club".
  q = keep(q.replace(/\s+(?:with|feat\.?|ft\.?|w\/)\s+.*$/i, ''));
  const comma = q.match(/^([^,]+\s[^,]+),\s/);
  if (comma) q = keep(comma[1]);
  // At most a few words, never ending on a connector ("Cord Room x Interzeak x").
  const all = q.split(' ');
  const words = all.slice(0, MAX_WORDS);
  if (all.length > MAX_WORDS) while (words.length > 1 && CONNECTOR.test(words[words.length - 1])) words.pop();
  q = trim(words.join(' '));
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
