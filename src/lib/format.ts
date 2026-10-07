import type { AdeEvent } from './types';

export function icsUrl(id: number): string {
  return `https://www.amsterdam-dance-event.nl/en/events/calendar/${id}.ics`;
}

/** The ADE site drops spaces between sentences ("event.No industry") — put them back. */
export function cleanDescription(s: string): string {
  return s.replace(/([a-z0-9][.!?])(?=[A-Z])/g, '$1 ').trim();
}

/** Chips for cards: genres first, then the event type. */
export function cardTags(e: AdeEvent, max = 3): string[] {
  return [...e.facets.genre, ...e.facets.type].slice(0, max);
}

export function plural(n: number, word: string, many = word + 's'): string {
  return `${n} ${n === 1 ? word : many}`;
}
