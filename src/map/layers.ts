import type { ExpressionSpecification, Map as MlMap } from 'maplibre-gl';
import type { VenuePin } from '../lib/store.svelte';

export const FONT_BOLD = ['Noto Sans Bold'];
export const FONT = ['Noto Sans Regular'];

export const COLORS = {
  light: { pin: '#121212', halo: '#ffffff', text: '#ffffff', label: '#121212', labelHalo: '#ffffff' },
  dark: { pin: '#f4f4f0', halo: '#000000', text: '#000000', label: '#f4f4f0', labelHalo: '#000000' },
  accent: '#ffd400',
  live: '#00c987',
  soldOut: '#8a8a8a',
  resale: '#2f86f0',
};

export const HOODS: [string, number, number][] = [
  ['Centrum', 4.894, 52.3725],
  ['Jordaan', 4.88, 52.3765],
  ['De Pijp', 4.894, 52.3545],
  ['Oost', 4.93, 52.3605],
  ['Noord', 4.925, 52.393],
  ['NDSM', 4.893, 52.4025],
  ['Westerpark', 4.872, 52.3875],
  ['Sloterdijk', 4.838, 52.3885],
  ['Zuid', 4.872, 52.343],
  ['Zuidoost', 4.948, 52.312],
];

export function pinsGeoJSON(
  pins: VenuePin[],
  coords: Map<string, [number, number]>,
  selectedId: string | null,
  /** A search is active: matching venues get labels at every zoom, others fade further. */
  searching = false,
  /** Sold-out filter set to "check TicketSwap": sold-out venues get the resale colour. */
  resale = false,
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: pins.map((p) => ({
      type: 'Feature',
      id: Number(p.venue.id),
      properties: {
        id: p.venue.id,
        name: p.venue.name,
        count: p.count,
        // While searching, the badge counts matching parties rather than all parties.
        label: searching ? (p.matched > 1 ? String(p.matched) : '') : p.count > 1 ? String(p.count) : '',
        dim: p.matched === 0,
        hl: searching && p.matched > 0,
        searching,
        soldOut: p.soldOutAll,
        resale: resale && p.soldOutAll,
        live: p.live,
        fav: p.fav,
        selected: p.venue.id === selectedId,
      },
      geometry: { type: 'Point', coordinates: coords.get(p.venue.id) ?? [p.venue.lng, p.venue.lat] },
    })),
  };
}

function radius(selectedScale = 1): ExpressionSpecification {
  const stop = (multi: number, single: number): ExpressionSpecification => [
    '*',
    ['case', ['get', 'selected'], selectedScale, ['get', 'hl'], 1.15, 1],
    ['case', ['>', ['get', 'count'], 1], multi, single],
  ];
  return ['interpolate', ['linear'], ['zoom'], 11, stop(6, 3.5), 14, stop(10, 6), 17, stop(13, 9)];
}

const opacity: ExpressionSpecification = [
  'case',
  ['get', 'dim'],
  ['case', ['get', 'searching'], 0.15, 0.3],
  1,
];

/** Add (or re-add after a style switch) all app sources and layers. */
export function addAppLayers(map: MlMap, theme: 'light' | 'dark') {
  const c = COLORS[theme];
  const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

  map.addSource('hoods', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: HOODS.map(([name, lng, lat]) => ({
        type: 'Feature',
        properties: { name },
        geometry: { type: 'Point', coordinates: [lng, lat] },
      })),
    },
  });
  map.addLayer({
    id: 'hood-labels',
    type: 'symbol',
    source: 'hoods',
    maxzoom: 13.6,
    layout: {
      'text-field': ['upcase', ['get', 'name']],
      'text-font': FONT_BOLD,
      'text-size': 12,
      'text-letter-spacing': 0.15,
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': c.label,
      'text-opacity': 0.45,
      'text-halo-color': c.labelHalo,
      'text-halo-width': 1.5,
    },
  });

  map.addSource('area', { type: 'geojson', data: empty });
  map.addLayer({
    id: 'area-fill',
    type: 'fill',
    source: 'area',
    paint: { 'fill-color': COLORS.accent, 'fill-opacity': 0.14 },
  });
  map.addLayer({
    id: 'area-line',
    type: 'line',
    source: 'area',
    paint: {
      'line-color': theme === 'dark' ? COLORS.accent : '#a08500',
      'line-width': 2,
      'line-dasharray': [2, 1.5],
    },
  });

  // Plan B: walking radius (soft circle) and its starting point.
  map.addSource('planb', { type: 'geojson', data: empty });
  map.addLayer({
    id: 'planb-fill',
    type: 'fill',
    source: 'planb',
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'fill-color': '#2f7cff', 'fill-opacity': theme === 'dark' ? 0.1 : 0.07 },
  });
  map.addLayer({
    id: 'planb-line',
    type: 'line',
    source: 'planb',
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'line-color': '#2f7cff', 'line-width': 1.5, 'line-opacity': 0.6, 'line-dasharray': [3, 2] },
  });
  map.addLayer({
    id: 'planb-origin',
    type: 'circle',
    source: 'planb',
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': 6,
      'circle-color': '#2f7cff',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  });

  map.addSource('venues', { type: 'geojson', data: empty });
  map.addLayer({
    id: 'pins',
    type: 'circle',
    source: 'venues',
    layout: { 'circle-sort-key': ['case', ['get', 'selected'], 3, ['get', 'dim'], 0, ['get', 'fav'], 2, 1] },
    paint: {
      'circle-radius': radius(1.35),
      // Selected venue and search matches share the accent colour.
      'circle-color': [
        'case',
        ['any', ['get', 'selected'], ['get', 'hl']],
        COLORS.accent,
        ['get', 'resale'],
        COLORS.resale,
        ['get', 'soldOut'],
        COLORS.soldOut,
        ['get', 'live'],
        COLORS.live,
        c.pin,
      ],
      'circle-opacity': opacity,
      // A dark ring keeps yellow matches readable on the light basemap (favourites too).
      'circle-stroke-color': ['case', ['get', 'hl'], '#000000', ['get', 'fav'], COLORS.accent, c.halo],
      'circle-stroke-width': [
        'case',
        ['get', 'fav'],
        3,
        ['any', ['get', 'selected'], ['get', 'hl']],
        2.5,
        1.5,
      ],
      'circle-stroke-opacity': opacity,
    },
  });
  map.addLayer({
    id: 'pin-count',
    type: 'symbol',
    source: 'venues',
    filter: ['!=', ['get', 'label'], ''],
    minzoom: 12.2,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': FONT_BOLD,
      'text-size': ['interpolate', ['linear'], ['zoom'], 12, 9, 17, 12],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'symbol-sort-key': ['case', ['get', 'dim'], 0, 1],
    },
    paint: {
      'text-color': ['case', ['any', ['get', 'selected'], ['get', 'hl'], ['get', 'live']], '#000000', c.text],
      'text-opacity': opacity,
    },
  });
  map.addLayer({
    id: 'pin-labels',
    type: 'symbol',
    source: 'venues',
    layout: {
      // Names from zoom 14; search matches are labelled at every zoom.
      'text-field': ['step', ['zoom'], ['case', ['get', 'hl'], ['get', 'name'], ''], 14, ['get', 'name']],
      'text-font': FONT_BOLD,
      'text-size': 11.5,
      'text-anchor': 'left',
      'text-offset': [1.1, 0],
      'text-max-width': 10,
      'text-optional': true,
      'symbol-sort-key': [
        'case',
        ['get', 'selected'],
        0,
        ['get', 'hl'],
        1,
        ['get', 'dim'],
        3,
        ['-', 2, ['/', ['get', 'count'], 100]],
      ],
    },
    paint: {
      'text-color': c.label,
      'text-halo-color': c.labelHalo,
      'text-halo-width': 1.5,
      'text-opacity': ['case', ['get', 'dim'], 0.35, 1],
    },
  });

  map.addSource('me', { type: 'geojson', data: empty });
  map.addLayer({
    id: 'me',
    type: 'circle',
    source: 'me',
    paint: {
      'circle-radius': 7,
      'circle-color': '#2f7cff',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2.5,
    },
  });
}

// ---------------------------------------------------------------------------------------
// Pulse mode (ported from prototypes/city-pulse-prototype.html). One point per venue; the
// per-frame state lives in feature-state: count (parties live), w (fade-weighted live
// amount), soon (0/1), flash (ripple 1 → 0).

export const PULSE_LAYERS = [
  'pulse-idle',
  'pulse-soon',
  'pulse-glow',
  'pulse-core',
  'pulse-ripple',
  'pulse-labels',
];
/** Normal-map layers hidden while Pulse is on. */
export const NORMAL_LAYERS = [
  'pins',
  'pin-count',
  'pin-labels',
  'area-fill',
  'area-line',
  'planb-fill',
  'planb-line',
  'planb-origin',
];

const P = {
  idle: '#4a4a52',
  soon: '#6ad1ff',
  glow: '#ffb000',
  core: '#ffd400',
  label: '#f2f2ef',
};

const state = (k: string): ExpressionSpecification => ['coalesce', ['feature-state', k], 0];
const isLive: ExpressionSpecification = ['>', state('count'), 0];
/** Core radius in px at zoom 12.6: 2.5 + 3·sqrt(w), as in the prototype. */
const coreR: ExpressionSpecification = ['+', 2.5, ['*', 3, ['sqrt', state('w')]]];

/** Radius scaled with zoom like the prototype: ×2^(0.6·(zoom − 12.6)). */
function zoomed(r: ExpressionSpecification | number): ExpressionSpecification {
  const at = (z: number): ExpressionSpecification => ['*', Math.pow(2, 0.6 * (z - 12.6)), r];
  return ['interpolate', ['exponential', Math.pow(2, 0.6)], ['zoom'], 11, at(11), 18, at(18)];
}

export function pulseGeoJSON(
  venues: { id: string; name: string }[],
  coords: Map<string, [number, number]>,
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: venues.map((v, i) => ({
      type: 'Feature',
      id: i,
      properties: { i, id: v.id, name: v.name },
      geometry: { type: 'Point', coordinates: coords.get(v.id) ?? [0, 0] },
    })),
  };
}

export function addPulseLayers(map: MlMap, visible: boolean) {
  const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
  const visibility = visible ? 'visible' : 'none';
  map.addSource('pulse', { type: 'geojson', data: empty });
  map.addSource('pulse-labels', { type: 'geojson', data: empty });

  map.addLayer({
    id: 'pulse-idle',
    type: 'circle',
    source: 'pulse',
    layout: { visibility },
    paint: {
      'circle-radius': zoomed(1.8),
      'circle-color': P.idle,
      'circle-opacity': ['case', ['any', isLive, ['>', state('soon'), 0]], 0, 1],
    },
  });
  map.addLayer({
    id: 'pulse-soon',
    type: 'circle',
    source: 'pulse',
    layout: { visibility },
    paint: {
      'circle-radius': zoomed(4),
      'circle-opacity': 0,
      'circle-stroke-color': P.soon,
      'circle-stroke-width': 1.5,
      'circle-stroke-opacity': ['case', ['all', ['!', isLive], ['>', state('soon'), 0]], 0.9, 0],
    },
  });
  map.addLayer({
    id: 'pulse-glow',
    type: 'circle',
    source: 'pulse',
    layout: { visibility },
    paint: {
      'circle-radius': zoomed(['*', 2.6, coreR]),
      'circle-color': P.glow,
      'circle-blur': 1,
      'circle-opacity': ['case', isLive, ['min', 0.8, ['+', 0.3, ['*', 0.12, state('w')]]], 0],
    },
  });
  map.addLayer({
    id: 'pulse-core',
    type: 'circle',
    source: 'pulse',
    layout: { visibility },
    paint: {
      'circle-radius': zoomed(coreR),
      'circle-color': P.core,
      'circle-opacity': ['case', isLive, 1, 0],
    },
  });
  map.addLayer({
    id: 'pulse-ripple',
    type: 'circle',
    source: 'pulse',
    layout: { visibility },
    paint: {
      // Expands from the core by up to 18 px (at zoom 12.6) as the flash decays.
      'circle-radius': zoomed(['+', coreR, ['*', 18, ['-', 1, state('flash')]]]),
      'circle-opacity': 0,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
      'circle-stroke-opacity': ['case', isLive, ['*', 0.9, state('flash')], 0],
    },
  });
  map.addLayer({
    id: 'pulse-labels',
    type: 'symbol',
    source: 'pulse-labels',
    minzoom: 13.2,
    layout: {
      visibility,
      'text-field': ['upcase', ['get', 'name']],
      'text-font': FONT_BOLD,
      'text-size': 11,
      'text-anchor': 'left',
      'text-offset': [1, 0],
      'text-max-width': 14,
      'text-optional': true,
      'symbol-sort-key': ['-', ['get', 'count']],
    },
    paint: { 'text-color': P.label, 'text-halo-color': '#000000', 'text-halo-width': 1.2 },
  });
}
