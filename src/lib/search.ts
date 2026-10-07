import type { AdeEvent } from './types';

/** Lower-case, strip diacritics and punctuation so "Kölsch" matches "kolsch". */
export function normalise(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function buildSearchText(parts: (string | undefined)[]): string {
  return ' ' + normalise(parts.filter(Boolean).join(' | ')) + ' ';
}

export function tokens(query: string): string[] {
  return normalise(query).split(' ').filter(Boolean);
}

/** Every token must appear (as a word prefix) somewhere in the event's text. */
export function matches(ev: Pick<AdeEvent, 'searchText'>, toks: string[]): boolean {
  for (const t of toks) if (!ev.searchText.includes(' ' + t)) return false;
  return true;
}

/** Line-up entries matching the query, used to explain why an event matched. */
export function matchingArtists(ev: Pick<AdeEvent, 'lineup'>, toks: string[]): string[] {
  if (!toks.length) return [];
  return ev.lineup.filter((a) => {
    const n = ' ' + normalise(a);
    return toks.every((t) => n.includes(' ' + t));
  });
}

export function search<T extends Pick<AdeEvent, 'searchText'>>(events: T[], query: string): T[] {
  const toks = tokens(query);
  if (!toks.length) return events;
  return events.filter((e) => matches(e, toks));
}
