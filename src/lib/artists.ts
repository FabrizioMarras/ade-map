import { normalise, tokens } from './search';
import type { AdeEvent } from './types';

export interface Artist {
  /** Normalised name without the country suffix: the index key. */
  key: string;
  /** Display name, e.g. "Charlotte Adigéry" (as first listed, suffix removed). */
  name: string;
  /** Their parties, by start time. */
  eventIds: number[];
}

const COUNTRY = /\s*\(([A-Z]{2,3}(?:\s*[/,&]\s*[A-Z]{2,3})*)\)\s*$/u;

/** "Charlotte Adigéry (BE)" → name "Charlotte Adigéry", country "BE" (repeated suffixes too). */
export function parseArtist(raw: string): { name: string; country: string } {
  let name = raw.trim();
  let country = '';
  for (let m = COUNTRY.exec(name); m; m = COUNTRY.exec(name)) {
    country ||= m[1].replace(/\s+/g, '');
    name = name.slice(0, m.index).trim();
  }
  return { name, country };
}

export function stripCountry(raw: string): string {
  return parseArtist(raw).name;
}

/**
 * Artist name → their parties. Country suffixes are de-duplicated: "Casa Mata" and
 * "Casa Mata (FR)" are one artist. When the same name appears with different countries
 * ("Bomber (US)", "Bomber (IT)") those are different artists and stay apart.
 */
export function buildArtistIndex(events: AdeEvent[]): Map<string, Artist> {
  const sorted = [...events].sort((a, b) => a.startMs - b.startMs || a.id - b.id);
  const countries = new Map<string, Set<string>>();
  for (const e of sorted) {
    for (const raw of e.lineup) {
      const { name, country } = parseArtist(raw);
      const base = normalise(name);
      if (!base) continue;
      if (!countries.has(base)) countries.set(base, new Set());
      if (country) countries.get(base)!.add(country);
    }
  }
  const index = new Map<string, Artist>();
  for (const e of sorted) {
    for (const raw of e.lineup) {
      const { name, country } = parseArtist(raw);
      const base = normalise(name);
      if (!base) continue;
      const ambiguous = countries.get(base)!.size > 1;
      const key = ambiguous && country ? `${base} ${normalise(country)}` : base;
      let a = index.get(key);
      if (!a) {
        a = { key, name: ambiguous && country ? `${name} (${country})` : name, eventIds: [] };
        index.set(key, a);
      }
      if (!a.eventIds.includes(e.id)) a.eventIds.push(e.id);
    }
  }
  return index;
}

/**
 * Artists matching a search: every query token must start a word of the name. Artists with
 * the most sets first, then alphabetical.
 */
export function searchArtists(index: Map<string, Artist>, query: string, limit = 5): Artist[] {
  const toks = tokens(query);
  if (!toks.length || toks.join('').length < 2) return [];
  const out: Artist[] = [];
  for (const a of index.values()) {
    const words = ' ' + a.key + ' ';
    if (toks.every((t) => words.includes(' ' + t))) out.push(a);
  }
  return out
    .sort((a, b) => b.eventIds.length - a.eventIds.length || a.name.localeCompare(b.name))
    .slice(0, limit);
}
