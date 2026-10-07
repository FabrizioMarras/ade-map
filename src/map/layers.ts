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
        label: p.count > 1 ? String(p.count) : '',
        dim: p.matched === 0,
        soldOut: p.soldOutAll,
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
    ['case', ['get', 'selected'], selectedScale, 1],
    ['case', ['>', ['get', 'count'], 1], multi, single],
  ];
  return ['interpolate', ['linear'], ['zoom'], 11, stop(6, 3.5), 14, stop(10, 6), 17, stop(13, 9)];
}

const opacity: ExpressionSpecification = ['case', ['get', 'dim'], 0.3, 1];

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

  map.addSource('venues', { type: 'geojson', data: empty });
  map.addLayer({
    id: 'pins',
    type: 'circle',
    source: 'venues',
    layout: { 'circle-sort-key': ['case', ['get', 'selected'], 3, ['get', 'dim'], 0, ['get', 'fav'], 2, 1] },
    paint: {
      'circle-radius': radius(1.35),
      'circle-color': [
        'case',
        ['get', 'selected'],
        COLORS.accent,
        ['get', 'soldOut'],
        COLORS.soldOut,
        ['get', 'live'],
        COLORS.live,
        c.pin,
      ],
      'circle-opacity': opacity,
      'circle-stroke-color': ['case', ['get', 'fav'], COLORS.accent, c.halo],
      'circle-stroke-width': ['case', ['get', 'fav'], 3, ['get', 'selected'], 2.5, 1.5],
      'circle-stroke-opacity': opacity,
    },
  });
  map.addLayer({
    id: 'pin-count',
    type: 'symbol',
    source: 'venues',
    filter: ['>', ['get', 'count'], 1],
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
      'text-color': ['case', ['any', ['get', 'selected'], ['get', 'live']], '#000000', c.text],
      'text-opacity': opacity,
    },
  });
  map.addLayer({
    id: 'pin-labels',
    type: 'symbol',
    source: 'venues',
    minzoom: 14,
    layout: {
      'text-field': ['get', 'name'],
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
