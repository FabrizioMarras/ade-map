import { describe, expect, it } from 'vitest';
import { HOODS, buildInsights, loadGenreOf, nearestHood } from '../../scripts/build-insights.mjs';
import { splitFacets } from '../../src/lib/facets';
import { computeState, pulseEvents } from '../../src/lib/pulse';
import {
  at23Sentence,
  clusterSentence,
  freeSentence,
  genreSentence,
  hourlySentence,
  sizeSentence,
  type Insights,
} from '../../src/insights/sentences';
import { data, raw } from './fixture';

const genreOf = await loadGenreOf();
const ins = buildInsights(raw, genreOf) as Insights;

describe('build-insights', () => {
  it("uses the app's genre table", () => {
    for (const e of raw.events.slice(0, 300))
      expect(genreOf(e.interests)).toEqual(splitFacets(e.interests).genre);
  });

  it('counts live parties like the app (Pulse) does', () => {
    expect(ins.hourly.counts).toHaveLength(117); // Wed 12:00 → Mon 08:00, hourly
    const events = pulseEvents(data.events, data.venues);
    const fri23 = 2 * 1440 + 23 * 60;
    const total = Object.values(ins.at23[2]).reduce((a, b) => a + b, 0);
    expect(total).toBe(computeState(events, data.venues.length, fri23).nLive);
    // The hourly series at Fri 23:00 is the same number.
    expect(ins.hourly.counts[(fri23 - 12 * 60) / 60]).toBe(total);
  });

  it('assigns every venue to one of the ten neighbourhoods', () => {
    expect(nearestHood(4.8966, 52.3662)).toBe('Centrum'); // Rembrandtplein
    expect(nearestHood(4.8943, 52.4012)).toBe('NDSM');
    expect(ins.genreByHood.reduce((n, g) => n + g.total, 0)).toBe(raw.events.length);
    expect(ins.hoods).toEqual(HOODS.map((h) => h[0]));
  });

  it('splits free/paid and venue sizes per day without losing parties', () => {
    ins.days.forEach((d, k) => {
      const n = data.eventsByDay.get(d.key)!.length;
      expect(ins.freeByDay[k].free + ins.freeByDay[k].paid).toBe(n);
      const tagged = Object.values(ins.sizeByDay[k].counts).reduce((a, b) => a + b, 0);
      expect(tagged + ins.sizeByDay[k].untagged).toBe(n);
    });
  });

  it('finds the half-hour peak near Rembrandtplein', () => {
    expect(ins.clusters.map((c) => c.name)).toEqual(['Rembrandtplein', 'Noord', 'Zuidoost']);
    expect(ins.clusters[0].peak).toBeGreaterThan(ins.clusters[1].peak);
  });
});

describe('insight sentences come from the numbers', () => {
  it('say what the data says', () => {
    expect(hourlySentence(ins)).toContain(String(Math.max(...ins.hourly.counts)));
    expect(at23Sentence(ins)).toContain('Centrum');
    expect(clusterSentence(ins)).toContain(`Up to ${ins.clusters[0].peak} parties`);
    expect(freeSentence(ins)).toContain(String(ins.freeByDay.reduce((n, d) => n + d.free, 0)));
    expect(genreSentence(ins)).toMatch(/^House is the most common genre in \d+ of \d+ neighbourhoods/);
    expect(sizeSentence(ins)).toMatch(/^Intimate venues host the most/);
  });

  it('change when the data changes (nothing hard-coded)', () => {
    const changed: Insights = structuredClone(ins);
    changed.hourly.counts = changed.hourly.counts.map((c) => c * 2);
    changed.clusters[0].peak = 99;
    changed.freeByDay[0] = { free: 50, paid: 50 };
    expect(hourlySentence(changed)).toContain(String(Math.max(...ins.hourly.counts) * 2));
    expect(clusterSentence(changed)).toContain('Up to 99 parties');
    expect(freeSentence(changed)).toContain('50% (Wed 21)');
  });
});
