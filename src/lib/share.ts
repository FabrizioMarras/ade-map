/**
 * Shareable links: `#e=<id>` (party), `#v=<id>` (venue) and `#list=<payload>&by=<name>`
 * (a My list). The list payload is base64url of the event ids in base36, comma-separated.
 */

/** Shared-list links must stay under this many characters (old browsers, chat apps). */
export const MAX_URL = 2000;

function toBase64Url(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  return atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
}

export function encodeList(ids: number[]): string {
  return toBase64Url(ids.map((id) => id.toString(36)).join(','));
}

/** Decodes a list payload; invalid input gives an empty list rather than an error. */
export function decodeList(payload: string): number[] {
  try {
    const ids = fromBase64Url(payload)
      .split(',')
      .map((s) => parseInt(s, 36))
      .filter((n) => Number.isSafeInteger(n) && n > 0);
    return [...new Set(ids)];
  } catch {
    return [];
  }
}

/** The app's address without the hash (works on any GitHub Pages sub-path). */
export function appBase(loc: Pick<Location, 'origin' | 'pathname'> = location): string {
  return loc.origin + loc.pathname;
}

export const eventLink = (id: number, base = appBase()) => `${base}#e=${id}`;
export const venueLink = (id: string, base = appBase()) => `${base}#v=${encodeURIComponent(id)}`;

/**
 * Link to a list of events, optionally with the sharer's name. Ids are sorted by start
 * (pass them in that order); if the link would exceed MAX_URL, the list is cut and
 * `included` says how many made it.
 */
export function listLink(ids: number[], by = '', base = appBase()): { url: string; included: number } {
  const name = by.trim().slice(0, 40);
  const make = (n: number) => {
    const p = new URLSearchParams({ list: encodeList(ids.slice(0, n)) });
    if (name) p.set('by', name);
    return `${base}#${p.toString()}`;
  };
  let n = ids.length;
  let url = make(n);
  while (url.length >= MAX_URL && n > 1) {
    n = Math.floor(n * 0.9);
    url = make(n);
  }
  return { url, included: n };
}

/** Merge shared ids into favourites: known events only, no duplicates. */
export function mergeIntoList(
  current: Iterable<number>,
  incoming: number[],
  known: (id: number) => boolean,
): { ids: Set<number>; added: number } {
  const ids = new Set(current);
  const before = ids.size;
  for (const id of incoming) if (known(id)) ids.add(id);
  return { ids, added: ids.size - before };
}

/** "Fabrizio's list" / "Shared list" */
export function listTitle(by?: string): string {
  const name = by?.trim();
  if (!name) return 'Shared list';
  return name.endsWith('s') ? `${name}' list` : `${name}'s list`;
}

/** True where the system share sheet exists (most phones); the button then says "Share". */
export const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

export type ShareResult = 'shared' | 'copied' | 'manual' | 'cancelled';

/**
 * Share a link: the system share sheet when available (phones), otherwise copy it to the
 * clipboard; if that fails too, the caller shows the link for copying by hand.
 */
export async function shareOrCopy(url: string, title: string): Promise<ShareResult> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
      // Fall through to copying (e.g. share not allowed in this context).
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'manual';
  }
}
