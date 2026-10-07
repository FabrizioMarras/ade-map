import type { StyleSpecification } from 'maplibre-gl';
import { BASEMAP_URL } from '../lib/data';

/** Bundled OSM extract: integer coords, lng = x/scale + origin[0], lat = y/scale + origin[1]. */
interface Basemap {
  origin: [number, number];
  scale: number;
  layers: Record<string, number[][][] | number[][][][]>;
  polyLayers: string[];
}

export const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

export interface Palette {
  bg: string;
  water: string;
  park: string;
  road1: string;
  road2: string;
  rail: string;
}

const PALETTES: Record<'light' | 'dark', Palette> = {
  light: {
    bg: '#f2f3f0',
    water: '#c6d8e4',
    park: '#dfe8d6',
    road1: '#ffffff',
    road2: '#fbfbfa',
    rail: '#c9c9c9',
  },
  dark: {
    bg: '#0b0c0e',
    water: '#18232e',
    park: '#121a14',
    road1: '#33363b',
    road2: '#24272b',
    rail: '#2b2b2b',
  },
};

function signedArea(ring: [number, number][]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return a;
}

/** Convert the compact basemap into GeoJSON, rewinding holes so MapLibre cuts them out. */
export function basemapToGeoJSON(b: Basemap): Record<string, GeoJSON.FeatureCollection> {
  const [ox, oy] = b.origin;
  const pt = (c: number[]): [number, number] => [c[0] / b.scale + ox, c[1] / b.scale + oy];
  const out: Record<string, GeoJSON.FeatureCollection> = {};
  for (const [name, items] of Object.entries(b.layers)) {
    const features: GeoJSON.Feature[] = [];
    if (b.polyLayers.includes(name)) {
      for (const poly of items as number[][][][]) {
        const rings = poly.filter((r) => r.length >= 4).map((r) => r.map(pt));
        if (!rings.length) continue;
        const outerCw = signedArea(rings[0]) > 0;
        const fixed = rings.map((r, i) => ((signedArea(r) > 0 === outerCw) === (i === 0) ? r : r.reverse()));
        features.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: fixed } });
      }
    } else {
      for (const line of items as number[][][]) {
        if (line.length < 2) continue;
        features.push({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: line.map(pt) },
        });
      }
    }
    out[name] = { type: 'FeatureCollection', features };
  }
  return out;
}

let cache: Promise<Record<string, GeoJSON.FeatureCollection>> | null = null;

export async function fallbackStyle(theme: 'light' | 'dark'): Promise<StyleSpecification> {
  cache ??= fetch(BASEMAP_URL)
    .then((r) => r.json())
    .then(basemapToGeoJSON);
  const geo = await cache;
  const p = PALETTES[theme];
  const src = (name: string) => ({
    type: 'geojson' as const,
    data: geo[name],
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });
  return {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      water: src('water'),
      park: src('park'),
      canal: src('canal'),
      road1: src('road1'),
      road2: src('road2'),
      rail: src('rail'),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': p.bg } },
      { id: 'park', type: 'fill', source: 'park', paint: { 'fill-color': p.park } },
      { id: 'water', type: 'fill', source: 'water', paint: { 'fill-color': p.water } },
      {
        id: 'canal',
        type: 'line',
        source: 'canal',
        paint: { 'line-color': p.water, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 17, 6] },
      },
      {
        id: 'rail',
        type: 'line',
        source: 'rail',
        paint: { 'line-color': p.rail, 'line-width': 1, 'line-dasharray': [3, 2] },
      },
      {
        id: 'road2',
        type: 'line',
        source: 'road2',
        paint: { 'line-color': p.road2, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 17, 5] },
      },
      {
        id: 'road1',
        type: 'line',
        source: 'road1',
        paint: { 'line-color': p.road1, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 17, 8] },
      },
    ],
  };
}

export const REMOTE_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

/** Fetch the remote style ourselves so a failure (offline, outage) falls back to the bundled basemap. */
export async function loadStyle(
  theme: 'light' | 'dark',
): Promise<{ style: StyleSpecification; remote: boolean }> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    const res = await fetch(REMOTE_STYLES[theme], { signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(String(res.status));
    return { style: (await res.json()) as StyleSpecification, remote: true };
  } catch {
    return { style: await fallbackStyle(theme), remote: false };
  }
}
