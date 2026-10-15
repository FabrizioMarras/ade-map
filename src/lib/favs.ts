import { overlaps } from './time';
import type { AdeEvent } from './types';

/** For each favourite, the other favourites it overlaps in time. */
export function clashes(events: AdeEvent[]): Map<number, AdeEvent[]> {
  const sorted = [...events].sort((a, b) => a.startMs - b.startMs);
  const out = new Map<number, AdeEvent[]>();
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length && sorted[j].startMs < sorted[i].endMs; j++) {
      if (!overlaps(sorted[i], sorted[j])) continue;
      for (const [a, b] of [
        [sorted[i], sorted[j]],
        [sorted[j], sorted[i]],
      ]) {
        if (!out.has(a.id)) out.set(a.id, []);
        out.get(a.id)!.push(b);
      }
    }
  }
  return out;
}
