<script lang="ts">
  import { Map as MlMap, Marker, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl';
  import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { onDestroy, onMount } from 'svelte';
  import { CENTRE, MAX_BOUNDS, bbox, spreadDuplicates, type LngLat } from '../lib/geo';
  import { app } from '../lib/store.svelte';
  import { loadStyle } from './basemap';
  import { addAppLayers, pinsGeoJSON } from './layers';

  interface Props {
    /** Venues under a tap (one or several overlapping). */
    onpick: (venueIds: string[]) => void;
    /** Padding that the sheet/panel covers, so fly-to centres in the visible part. */
    padding: { top: number; bottom: number; left: number; right: number };
  }

  let { onpick, padding }: Props = $props();

  let container: HTMLDivElement;
  let map: MlMap | undefined = $state();
  let styleReady = $state(false);
  let styleTheme: 'light' | 'dark' | null = null;
  let usingFallback = $state(false);

  const coords = $derived(app.data ? spreadDuplicates(app.data.venues) : new Map<string, LngLat>());
  const reducedMotion =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  setWorkerUrl(workerUrl);

  onMount(() => {
    const m = new MlMap({
      container,
      style: { version: 8, sources: {}, layers: [] },
      center: CENTRE,
      zoom: 13,
      minZoom: 11,
      maxZoom: 18,
      maxBounds: MAX_BOUNDS,
      dragRotate: false,
      pitchWithRotate: false,
      attributionControl: { compact: true },
    });
    map = m;
    // Handle for end-to-end tests (project venue coordinates to screen pixels).
    (window as unknown as { __adeMap?: MlMap }).__adeMap = m;
    m.touchZoomRotate.disableRotation();
    m.keyboard.disableRotation();
    m.on('style.load', () => {
      addAppLayers(map!, styleTheme ?? 'light');
      styleReady = true;
    });
    map.on('click', (e) => {
      const r = 16;
      const { x, y } = e.point;
      const feats = map!.queryRenderedFeatures(
        [
          [x - r, y - r],
          [x + r, y + r],
        ],
        { layers: ['pins'] },
      );
      const ids = [...new Set(feats.map((f) => String(f.properties.id)))];
      // Prefer pins that are not faded, closest first.
      const scored = ids
        .map((id) => {
          const f = feats.find((g) => String(g.properties.id) === id)!;
          const p = map!.project((f.geometry as GeoJSON.Point).coordinates as LngLat);
          return { id, d: Math.hypot(p.x - x, p.y - y), dim: !!f.properties.dim };
        })
        .filter((s) => s.d <= r)
        .sort((a, b) => Number(a.dim) - Number(b.dim) || a.d - b.d);
      if (scored.length) onpick(scored.map((s) => s.id));
    });
    for (const layer of ['pins']) {
      map.on('mouseenter', layer, () => (map!.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', layer, () => (map!.getCanvas().style.cursor = ''));
    }
  });

  onDestroy(() => {
    map?.remove();
  });

  // Live venues pulse with CSS-animated markers: the animation runs on the compositor,
  // so the map itself never has to repaint for it.
  const pulseMarkers = new Map<string, Marker>();
  $effect(() => {
    const live = app.pins.filter((p) => p.live && p.matched > 0);
    if (!map) return;
    const keep = new Set(live.map((p) => p.venue.id));
    for (const [id, mk] of pulseMarkers) {
      if (!keep.has(id)) {
        mk.remove();
        pulseMarkers.delete(id);
      }
    }
    for (const p of live) {
      if (pulseMarkers.has(p.venue.id)) continue;
      // Marker positions its element with a transform, so animate an inner ring.
      const el = document.createElement('div');
      el.className = 'pulse';
      el.appendChild(document.createElement('span'));
      const c = coords.get(p.venue.id) ?? [p.venue.lng, p.venue.lat];
      pulseMarkers.set(p.venue.id, new Marker({ element: el }).setLngLat(c).addTo(map));
    }
  });

  // Load or switch the basemap whenever the effective theme changes.
  $effect(() => {
    const theme = app.theme;
    if (!map || theme === styleTheme) return;
    styleTheme = theme;
    loadStyle(theme).then(({ style, remote }) => {
      if (styleTheme !== theme || !map) return;
      usingFallback = !remote;
      styleReady = false;
      map.setStyle(style, { diff: false });
    });
  });

  // Push pin data whenever the result set or selection changes.
  $effect(() => {
    const data = pinsGeoJSON(app.pins, coords, app.focusVenueId);
    if (!map || !styleReady) return;
    (map.getSource('venues') as GeoJSONSource | undefined)?.setData(data);
  });

  export function flyToVenue(id: string) {
    const c = coords.get(id);
    if (!map || !c) return;
    map.flyTo({ center: c, zoom: Math.max(map.getZoom(), 15), padding, duration: reducedMotion ? 0 : 800 });
  }

  export function fitTo(points: LngLat[]) {
    if (!map || !points.length) return;
    const duration = reducedMotion ? 0 : 600;
    if (points.length === 1) {
      return map.flyTo({ center: points[0], zoom: Math.max(map.getZoom(), 15), padding, duration });
    }
    const pad = (n: number) => n + 40;
    map.fitBounds(bbox(points), {
      padding: {
        top: pad(padding.top),
        bottom: pad(padding.bottom),
        left: pad(padding.left),
        right: pad(padding.right),
      },
      maxZoom: 16,
      duration,
    });
  }

  export function showMe(lngLat: LngLat) {
    if (!map) return;
    (map.getSource('me') as GeoJSONSource | undefined)?.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: lngLat },
    });
    map.flyTo({
      center: lngLat,
      zoom: Math.max(map.getZoom(), 15),
      padding,
      duration: reducedMotion ? 0 : 800,
    });
  }

  export function getMap() {
    return map;
  }
</script>

<div class="map" bind:this={container} data-fallback={usingFallback || undefined}></div>

<style>
  .map {
    position: absolute;
    inset: 0;
  }
  .map :global(.pulse) {
    pointer-events: none;
  }
  .map :global(.pulse span) {
    display: block;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 3px solid var(--live);
    animation: pulse 1.6s ease-out infinite;
  }
  @keyframes pulse {
    from {
      transform: scale(0.4);
      opacity: 0.9;
    }
    to {
      transform: scale(1.4);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .map :global(.pulse span) {
      animation: none;
      transform: scale(0.85);
      opacity: 0.7;
    }
  }
  :global(.maplibregl-ctrl-attrib) {
    font-size: 11px;
  }
</style>
