import '../app.css';
import './insights.css';
import { applyStoredTheme } from '../lib/theme';
import { asOfLabel, nowWall, parseWall } from '../lib/time';
import {
  at23Sentence,
  clusterSentence,
  freeSentence,
  genreSentence,
  hourLabel,
  hourlySentence,
  sizeSentence,
  type Insights,
} from './sentences';

// Same light/dark behaviour as the app (stored preference, else dark 18:00–07:00).
// --- tiny DOM helpers (all text goes through textContent) ---------------------------------
type Attrs = Record<string, string | number | undefined>;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: (Node | string)[]) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) e.setAttribute(k, String(v));
  for (const k of kids) e.append(k);
  return e;
}
const SVGNS = 'http://www.w3.org/2000/svg';
function svg(tag: string, attrs: Attrs = {}, text?: string) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) e.setAttribute(k, String(v));
  if (text !== undefined) e.textContent = text;
  return e;
}

/** A chart card: title, the chart, its sentence directly underneath, then notes and table. */
function card(title: string, sentence: string, chart: Node, ...rest: Node[]) {
  return el(
    'section',
    { class: 'card' },
    el('h2', {}, title),
    chart,
    el('p', { class: 'say' }, sentence),
    ...rest,
  );
}

function tableView(head: string[], rows: (string | number)[][]) {
  const thead = el('thead', {}, el('tr', {}, ...head.map((h) => el('th', { scope: 'col' }, h))));
  const tbody = el(
    'tbody',
    {},
    ...rows.map((r) =>
      el(
        'tr',
        {},
        ...r.map((c, i) => (i === 0 ? el('th', { scope: 'row' }, String(c)) : el('td', {}, String(c)))),
      ),
    ),
  );
  return el(
    'details',
    {},
    el('summary', {}, 'Show table'),
    el('div', { class: 'scroll' }, el('table', { class: 'data' }, thead, tbody)),
  );
}

/** Tooltip positioned inside a chart container. */
function tooltip(container: HTMLElement) {
  const tip = el('div', { class: 'tip', role: 'status' });
  tip.hidden = true;
  container.append(tip);
  return {
    show(x: number, y: number, value: string, label: string) {
      tip.replaceChildren(el('strong', {}, value), label);
      tip.hidden = false;
      const w = container.clientWidth;
      const tw = tip.offsetWidth;
      tip.style.left = `${Math.min(Math.max(0, x - tw / 2), w - tw)}px`;
      tip.style.top = `${Math.max(0, y - tip.offsetHeight - 10)}px`;
    },
    hide() {
      tip.hidden = true;
    },
  };
}

// --- 1. Parties live per hour (single series: line + area, crosshair tooltip) --------------
function hourlyChart(i: Insights) {
  const { counts, start, stepMinutes } = i.hourly;
  const wrap = el('div', { class: 'chart' });
  const tip = tooltip(wrap);
  let cur = counts.indexOf(Math.max(...counts));
  let drawnWidth = 0;

  // Drawn at the container's real width (and again on resize) so text stays 12px on phones.
  const draw = (W: number) => {
    drawnWidth = W;
    const H = 240;
    const m = { t: 10, r: 8, b: 26, l: 34 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const max = Math.max(...counts);
    const yMax = Math.ceil(max / 50) * 50;
    const x = (k: number) => m.l + (k / (counts.length - 1)) * iw;
    const y = (v: number) => m.t + ih - (v / yMax) * ih;

    const root = svg('svg', {
      viewBox: `0 0 ${W} ${H}`,
      width: W,
      height: H,
      role: 'img',
      'aria-label': hourlySentence(i),
    });
    const grid = svg('g', { class: 'grid' });
    for (let v = 0; v <= yMax; v += 50) {
      grid.append(svg('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }));
      root.append(svg('text', { x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end' }, String(v)));
    }
    root.prepend(grid);
    // Midnight separators and day labels (data starts Wed 12:00, hourly).
    const t0Hour = +start.slice(11, 13);
    const axis = svg('g', { class: 'axis' });
    for (let k = 0; k < counts.length; k++) {
      const hour = (t0Hour + (k * stepMinutes) / 60) % 24;
      if (hour === 0) axis.append(svg('line', { x1: x(k), x2: x(k), y1: m.t, y2: m.t + ih }));
      if (hour === 12)
        root.append(
          svg(
            'text',
            { x: x(k), y: H - 6, 'text-anchor': 'middle' },
            hourLabel(start, k, stepMinutes).slice(0, 6),
          ),
        );
    }
    root.append(axis);
    const pts = counts.map((v, k) => `${x(k)},${y(v)}`).join(' ');
    root.append(
      svg('polygon', { class: 'area', points: `${x(0)},${y(0)} ${pts} ${x(counts.length - 1)},${y(0)}` }),
    );
    root.append(svg('polyline', { class: 'line', points: pts }));
    // Label the peak (selective direct label).
    const peak = counts.indexOf(max);
    root.append(svg('circle', { class: 'dot', cx: x(peak), cy: y(max), r: 4 }));
    root.append(svg('text', { x: x(peak) + 8, y: y(max) + 4 }, `${max}`));
    // During the festival: where "now" is on the week, in Pulse's live orange.
    const nowK = (nowWall() - parseWall(start)) / (stepMinutes * 60_000);
    if (nowK >= 0 && nowK <= counts.length - 1) {
      const k0 = Math.floor(nowK);
      const v = counts[k0] + (counts[Math.min(k0 + 1, counts.length - 1)] - counts[k0]) * (nowK - k0);
      root.append(svg('line', { class: 'now-line', x1: x(nowK), x2: x(nowK), y1: m.t, y2: m.t + ih }));
      root.append(svg('circle', { class: 'dot live', cx: x(nowK), cy: y(v), r: 5 }));
      root.append(svg('text', { x: x(nowK) + 6, y: m.t + ih - 6 }, 'now')); // bottom: clear of the peak label
    }

    const cross = svg('line', { class: 'cross', y1: m.t, y2: m.t + ih, visibility: 'hidden' });
    const dot = svg('circle', { class: 'dot', r: 4, visibility: 'hidden' });
    root.append(cross, dot);
    const hit = svg('rect', { x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent', tabindex: 0 });
    root.append(hit);

    wrap.querySelector('svg')?.remove();
    wrap.prepend(root);
    const showAt = (k: number) => {
      cur = Math.max(0, Math.min(counts.length - 1, k));
      const px = x(cur);
      const py = y(counts[cur]);
      for (const e of [cross]) {
        e.setAttribute('x1', String(px));
        e.setAttribute('x2', String(px));
        e.setAttribute('visibility', 'visible');
      }
      dot.setAttribute('cx', String(px));
      dot.setAttribute('cy', String(py));
      dot.setAttribute('visibility', 'visible');
      tip.show(px, py, `${counts[cur]} parties live`, hourLabel(start, cur, stepMinutes));
    };
    const hide = () => {
      cross.setAttribute('visibility', 'hidden');
      dot.setAttribute('visibility', 'hidden');
      tip.hide();
    };
    hit.addEventListener('pointermove', (e) => {
      const r = root.getBoundingClientRect();
      const sx = ((e.clientX - r.left) / r.width) * W;
      showAt(Math.round(((sx - m.l) / iw) * (counts.length - 1)));
    });
    hit.addEventListener('pointerleave', hide);
    hit.addEventListener('focus', () => showAt(cur));
    hit.addEventListener('blur', hide);
    hit.addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (step) {
        e.preventDefault();
        showAt(cur + step);
      }
    });
  };
  draw(860);
  new ResizeObserver(() => {
    const w = Math.round(wrap.clientWidth);
    if (w && Math.abs(w - drawnWidth) > 4) draw(w);
  }).observe(wrap);

  const rows = counts.map((v, k) => [hourLabel(start, k, stepMinutes), v]);
  return card(
    'Parties live, hour by hour',
    hourlySentence(i),
    wrap,
    el('p', { class: 'note' }, 'Use the arrow keys on the chart to step through the hours.'),
    tableView(['Time', 'Parties live'], rows),
  );
}

// --- Heatmap (HTML table, sequential blue) ---------------------------------------------------
/** Relative luminance of a #rrggbb colour (WCAG). */
function luminance(hex: string): number {
  const c = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Black or white, whichever contrasts more with the cell (the ramp runs both ways by theme). */
function inkFor(bgHex: string): string {
  const l = luminance(bgHex);
  return (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? '#000000' : '#ffffff';
}

function heatColor(v: number, max: number): { bg: string; ink: string } {
  const css = getComputedStyle(document.documentElement);
  if (!max || v <= 0) return { bg: 'var(--h0)', ink: 'var(--muted)' };
  const step = Math.min(6, 1 + Math.floor((v / max) * 5.999));
  const hex = css.getPropertyValue(`--h${step}`).trim();
  return { bg: `var(--h${step})`, ink: /^#[0-9a-f]{6}$/i.test(hex) ? inkFor(hex) : 'var(--fg)' };
}

function heatmap(
  rows: string[],
  cols: string[],
  value: (r: string, c: number) => number,
  fmt: (v: number) => string,
  label: (r: string, c: number, v: number) => string,
) {
  const values = rows.flatMap((r) => cols.map((_, c) => value(r, c)));
  const max = Math.max(...values);
  const thead = el(
    'thead',
    {},
    el('tr', {}, el('th', {}, ''), ...cols.map((c) => el('th', { scope: 'col' }, c))),
  );
  const tbody = el(
    'tbody',
    {},
    ...rows.map((r) =>
      el(
        'tr',
        {},
        el('th', { scope: 'row' }, r),
        ...cols.map((_, c) => {
          const v = value(r, c);
          const { bg, ink } = heatColor(v, max);
          const td = el('td', { title: label(r, c, v), tabindex: 0, 'aria-label': label(r, c, v) }, fmt(v));
          td.style.background = bg;
          td.style.color = ink;
          return td;
        }),
      ),
    ),
  );
  return el('div', { class: 'scroll' }, el('table', { class: 'heat' }, thead, tbody));
}

function at23Chart(i: Insights) {
  const days = i.days.map((d) => d.label);
  return card(
    'Where the parties are at 23:00',
    at23Sentence(i),
    heatmap(
      i.hoods,
      days,
      (h, d) => i.at23[d][h] ?? 0,
      (v) => String(v),
      (h, d, v) => `${h}, ${days[d]} 23:00: ${v} parties`,
    ),
    el('p', { class: 'note' }, i.method.neighbourhood),
  );
}

function genreChart(i: Insights) {
  const byHood = new Map(i.genreByHood.map((g) => [g.hood, g]));
  const share = (h: string, c: number) => {
    const g = byHood.get(h);
    return g && g.total ? Math.round((100 * (g.counts[i.genres[c]] ?? 0)) / g.total) : 0;
  };
  return card(
    'Genre mix by neighbourhood',
    genreSentence(i),
    heatmap(
      i.hoods.filter((h) => (byHood.get(h)?.total ?? 0) > 0),
      i.genres,
      share,
      (v) => `${v}%`,
      (h, c, v) => `${h}: ${v}% of ${byHood.get(h)?.total ?? 0} parties are ${i.genres[c]}`,
    ),
    el(
      'p',
      { class: 'note' },
      'Share of each neighbourhood’s parties tagged with the genre (a party can carry several genres).',
    ),
  );
}

// --- Stacked horizontal bars (categorical, legend + labels that fit + tooltip) ---------------
function stacked(
  i: Insights,
  series: string[],
  colors: string[],
  inks: string[],
  values: (d: number) => number[],
  extra?: (d: number) => string,
) {
  const totals = i.days.map((_, d) => values(d).reduce((a, b) => a + b, 0));
  const max = Math.max(...totals);
  const legend = el(
    'div',
    { class: 'legend' },
    ...series.map((s, k) => {
      const sw = el('i');
      sw.style.background = colors[k];
      return el('span', {}, sw, s);
    }),
  );
  const grid = el('div', { class: 'bars' });
  const wrap = el('div', { class: 'chart' }, legend, grid);
  const tip = tooltip(wrap);
  i.days.forEach((day, d) => {
    const vals = values(d);
    const track = el('div', { class: 'track' });
    track.style.width = `${(totals[d] / max) * 100}%`;
    vals.forEach((v, k) => {
      if (!v) return;
      const pctOfDay = Math.round((100 * v) / totals[d]);
      const seg = el('div', {
        class: 'seg',
        role: 'img',
        tabindex: 0,
        'aria-label': `${day.label}, ${series[k]}: ${v} (${pctOfDay}%)`,
      });
      seg.style.flex = `${v} 0 0`;
      seg.style.background = colors[k];
      // Label ink from the resolved segment colour (passes contrast in both themes).
      const hex = getComputedStyle(document.documentElement)
        .getPropertyValue(colors[k].replace(/^var\((--[\w-]+)\)$/, '$1'))
        .trim();
      seg.style.color = /^#[0-9a-f]{6}$/i.test(hex) ? inkFor(hex) : inks[k];
      // Label only when it fits (measured after layout).
      requestAnimationFrame(() => {
        if (seg.clientWidth >= String(v).length * 8 + 12) seg.textContent = String(v);
      });
      const show = () => {
        const r = seg.getBoundingClientRect();
        const w = wrap.getBoundingClientRect();
        tip.show(
          r.left - w.left + r.width / 2,
          r.top - w.top,
          `${v} parties (${pctOfDay}%)`,
          `${series[k]} · ${day.label}`,
        );
      };
      seg.addEventListener('pointerenter', show);
      seg.addEventListener('focus', show);
      seg.addEventListener('pointerleave', tip.hide);
      seg.addEventListener('blur', tip.hide);
      track.append(seg);
    });
    grid.append(
      el('span', { class: 'day' }, day.label),
      el('div', {}, track),
      el('span', { class: 'total' }, extra ? extra(d) : String(totals[d])),
    );
  });
  return wrap;
}

function freeChart(i: Insights) {
  const chart = stacked(
    i,
    ['Free', 'Paid'],
    ['var(--pri-fill)', 'var(--neutral-2)'],
    ['#000000', '#000000'],
    (d) => [i.freeByDay[d].free, i.freeByDay[d].paid],
  );
  return card(
    'Free vs paid, by day',
    freeSentence(i),
    chart,
    tableView(
      ['Day', 'Free', 'Paid', 'Free share'],
      i.freeByDay.map((d, k) => [
        i.days[k].label,
        d.free,
        d.paid,
        `${Math.round((100 * d.free) / (d.free + d.paid))}%`,
      ]),
    ),
  );
}

function sizeChart(i: Insights) {
  const chart = stacked(
    i,
    i.sizes,
    ['var(--pri-fill)', 'var(--neutral-1)', 'var(--neutral-2)', 'var(--neutral-3)'],
    ['#000000', '#000000', '#000000', '#000000'],
    (d) => i.sizes.map((s) => i.sizeByDay[d].counts[s] ?? 0),
    (d) =>
      `${i.sizes.reduce((n, s) => n + (i.sizeByDay[d].counts[s] ?? 0), 0)} (+${i.sizeByDay[d].untagged} untagged)`,
  );
  return card(
    'Venue size, by day',
    sizeSentence(i),
    chart,
    el(
      'p',
      { class: 'note' },
      'Only parties at venues ADE tags as intimate, mid-size, large or warehouse; the rest are counted as untagged.',
    ),
    tableView(
      ['Day', ...i.sizes, 'Untagged'],
      i.sizeByDay.map((d, k) => [i.days[k].label, ...i.sizes.map((s) => d.counts[s] ?? 0), d.untagged]),
    ),
  );
}

// --- 6. Clustering: three stat tiles --------------------------------------------------------
function clusterTiles(i: Insights) {
  const tiles = el(
    'div',
    { class: 'tiles' },
    ...i.clusters.map((c, k) =>
      el(
        'div',
        { class: k === 0 ? 'tile lead' : 'tile' },
        el('div', { class: 'label' }, `Within ${i.clusterRadiusM / 1000} km of ${c.name}`),
        el('div', { class: 'value' }, String(c.peak)),
        el(
          'div',
          { class: 'sub' },
          c.peakAt
            ? `parties starting in the same half hour (${hourLabel(c.peakAt, 0)}) · ${c.parties} in total`
            : 'no parties nearby',
        ),
      ),
    ),
  );
  return card('Clusters: same half hour, same neighbourhood', clusterSentence(i), tiles);
}

async function main() {
  applyStoredTheme();
  const root = document.getElementById('insights')!;
  try {
    const res = await fetch('../data/insights.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(String(res.status));
    const i = (await res.json()) as Insights;
    const asOf = asOfLabel(i.generated);
    const year = new Date().getFullYear();
    root.replaceChildren(
      el('a', { class: 'back', href: '../' }, '← Back to the map'),
      el('h1', {}, 'Insights'),
      el('p', { class: 'asof' }, `Programme as of ${asOf}`),
      el(
        'p',
        { class: 'lede' },
        `How ${i.events} festival parties at ${i.venues} venues spread across Amsterdam and across the week — for organisers planning where and when to put a night on.`,
      ),
      hourlyChart(i),
      at23Chart(i),
      clusterTiles(i),
      genreChart(i),
      freeChart(i),
      sizeChart(i),
      // The app's credits footer.
      el(
        'footer',
        { class: 'credits' },
        el('p', {}, `Programme as of ${asOf} · updated automatically from the ADE site`),
        el(
          'p',
          {},
          'Data © Amsterdam Dance Event (personal planning only) · Geocoding: PDOK Locatieserver · Map data © ',
          el(
            'a',
            { href: 'https://www.openstreetmap.org/copyright', target: '_blank', rel: 'noopener' },
            'OpenStreetMap',
          ),
          ' contributors · Tiles: ',
          el('a', { href: 'https://openfreemap.org', target: '_blank', rel: 'noopener' }, 'OpenFreeMap'),
        ),
        el('p', {}, i.method.live, ' ', i.method.neighbourhood),
        el(
          'p',
          { class: 'copyright' },
          `© ${year} FM Consulting · `,
          el(
            'a',
            { href: 'https://fabriziomarras.com', target: '_blank', rel: 'noopener' },
            'fabriziomarras.com',
          ),
        ),
      ),
    );
  } catch (e) {
    root.replaceChildren(
      el('p', { class: 'error' }, `The insights couldn't be loaded (${e instanceof Error ? e.message : e}).`),
      el('a', { href: '../' }, 'Back to the map'),
    );
  }
  root.removeAttribute('aria-busy');
}

main();
