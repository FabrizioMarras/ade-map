/** The shape of public/data/insights.json (written by scripts/build-insights.mjs). */
export interface Insights {
  generated: string;
  events: number;
  venues: number;
  days: { key: string; label: string }[];
  hourly: { start: string; stepMinutes: number; counts: number[] };
  hoods: string[];
  at23: Record<string, number>[];
  genres: string[];
  genreByHood: { hood: string; total: number; counts: Record<string, number> }[];
  freeByDay: { free: number; paid: number }[];
  sizes: string[];
  sizeByDay: { counts: Record<string, number>; untagged: number }[];
  clusters: { name: string; peak: number; peakAt: string | null; parties: number }[];
  clusterRadiusM: number;
  method: { neighbourhood: string; live: string };
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Fri 23 at 23:00" for a wall-clock "YYYY-MM-DD HH:mm" plus `i` steps of `stepMinutes`. */
export function hourLabel(start: string, i: number, stepMinutes = 60): string {
  const t0 = Date.UTC(
    +start.slice(0, 4),
    +start.slice(5, 7) - 1,
    +start.slice(8, 10),
    +start.slice(11, 13),
    +start.slice(14, 16),
  );
  const d = new Date(t0 + i * stepMinutes * 60_000);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} at ${d.toISOString().slice(11, 16)}`;
}

const pct = (n: number, d: number) => (d ? Math.round((100 * n) / d) : 0);
const argmax = <T>(xs: T[], f: (x: T) => number) => xs.reduce((best, x) => (f(x) > f(best) ? x : best));
const list = (xs: string[]) =>
  xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

/** Live parties per hour: when the festival peaks. */
export function hourlySentence(i: Insights): string {
  const { counts, start, stepMinutes } = i.hourly;
  const max = Math.max(...counts);
  const at = counts.indexOf(max);
  // Busiest moment of each day (by the day the hour falls on).
  const perDay = i.days.map((d) => {
    const vals = counts.filter((_, k) => hourLabel(start, k, stepMinutes).startsWith(d.label));
    return { label: d.label, max: Math.max(0, ...vals) };
  });
  const quiet = argmax(perDay, (d) => -d.max);
  return `Live parties peak at ${max} at once on ${hourLabel(start, at, stepMinutes)}; the quietest day, ${quiet.label}, never goes above ${quiet.max}.`;
}

/** Neighbourhoods at 23:00: which one leads each night. */
export function at23Sentence(i: Insights): string {
  const leaders = i.at23.map((counts, d) => {
    const hood = argmax(i.hoods, (h) => counts[h] ?? 0);
    const total = i.hoods.reduce((n, h) => n + (counts[h] ?? 0), 0);
    return { day: i.days[d].label, hood, n: counts[hood] ?? 0, share: pct(counts[hood] ?? 0, total) };
  });
  const top = leaders[0].hood;
  const busiest = argmax(leaders, (l) => l.n);
  if (leaders.every((l) => l.hood === top)) {
    const shares = leaders.map((l) => l.share);
    return `At 23:00 ${top} has the most parties every night — ${Math.min(...shares)}–${Math.max(...shares)}% of all parties running, peaking at ${busiest.n} on ${busiest.day}.`;
  }
  return `At 23:00 the busiest neighbourhood changes: ${leaders.map((l) => `${l.hood} on ${l.day}`).join(', ')}.`;
}

/** Genre mix: the leading genre per neighbourhood. */
export function genreSentence(i: Insights): string {
  const withParties = i.genreByHood.filter((g) => g.total > 0);
  const leaders = withParties.map((g) => ({
    hood: g.hood,
    genre: argmax(i.genres, (x) => g.counts[x] ?? 0),
  }));
  const main = argmax(i.genres, (x) => leaders.filter((l) => l.genre === x).length);
  const others = leaders.filter((l) => l.genre !== main);
  const lead = `${main} is the most common genre in ${leaders.length - others.length} of ${leaders.length} neighbourhoods`;
  if (!others.length) return `${lead}.`;
  // Group the exceptions by genre: "Techno leads in Sloterdijk, Zuid and Zuidoost".
  const byGenre = new Map<string, string[]>();
  for (const o of others) byGenre.set(o.genre, [...(byGenre.get(o.genre) ?? []), o.hood]);
  return `${lead}; ${list([...byGenre].map(([g, hoods]) => `${g} leads in ${list(hoods)}`))}.`;
}

/** Free vs paid by day. */
export function freeSentence(i: Insights): string {
  const shares = i.freeByDay.map((d, k) => ({
    day: i.days[k].label,
    share: pct(d.free, d.free + d.paid),
    free: d.free,
  }));
  const hi = argmax(shares, (s) => s.share);
  const lo = argmax(shares, (s) => -s.share);
  const total = i.freeByDay.reduce((n, d) => n + d.free, 0);
  return `${total} parties are free: between ${lo.share}% (${lo.day}) and ${hi.share}% (${hi.day}) of each day's programme.`;
}

/** Venue size mix by day. */
export function sizeSentence(i: Insights): string {
  const [first] = i.sizes;
  const leads = i.sizeByDay.every((d) => i.sizes.every((s) => (d.counts[s] ?? 0) <= (d.counts[first] ?? 0)));
  const large = i.sizes.find((s) => /large/i.test(s));
  const largeDay = large
    ? argmax(
        i.sizeByDay.map((d, k) => ({ k, n: d.counts[large] ?? 0 })),
        (x) => x.n,
      )
    : null;
  const tagged = i.sizeByDay.reduce((n, d) => n + i.sizes.reduce((m, s) => m + (d.counts[s] ?? 0), 0), 0);
  const all = tagged + i.sizeByDay.reduce((n, d) => n + d.untagged, 0);
  const parts = [
    leads
      ? `${first} venues host the most size-tagged parties every day`
      : `The size mix shifts during the week`,
    largeDay && large ? `large venues peak on ${i.days[largeDay.k].label} with ${largeDay.n}` : '',
  ].filter(Boolean);
  return `${parts.join('; ')} (${pct(tagged, all)}% of parties are at a venue ADE tags by size).`;
}

/** Clustering: parties starting in the same half hour close together. */
export function clusterSentence(i: Insights): string {
  const [first, ...rest] = i.clusters;
  const km = i.clusterRadiusM >= 1000 ? `${i.clusterRadiusM / 1000} km` : `${i.clusterRadiusM} m`;
  return `Up to ${first.peak} parties start in the same half hour within ${km} of ${first.name}, against ${list(
    rest.map((c) => `${c.peak} in ${c.name}`),
  )}.`;
}
