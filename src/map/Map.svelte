<script lang="ts">
  import { AttributionControl, Map as MlMap, Marker, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl';
  import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { onDestroy, onMount } from 'svelte';
  import { CENTRE, MAX_BOUNDS, bbox, spreadDuplicates, type LngLat } from '../lib/geo';
  import { app } from '../lib/store.svelte';
  import { loadStyle } from './basemap';
  import { Lasso } from './Lasso';
  import { WALK_M_PER_MIN, circlePolygon } from '../lib/planb';
  import { computeState, pulseEvents } from '../lib/pulse';
  import {
    COLORS,
    NORMAL_LAYERS,
    PULSE_LAYERS,
    addAppLayers,
    addPulseLayers,
    pinsGeoJSON,
    pulseGeoJSON,
  } from './layers';

  interface Props {
    /** Venues under a tap (one or several overlapping). */
    onpick: (venueIds: string[]) => void;
    /** A lit venue was tapped in Pulse mode. */
    onpulsepick: (venueId: string) => void;
    /** Padding that the sheet/panel covers, so fly-to centres in the visible part. */
    padding: { top: number; bottom: number; left: number; right: number };
  }

  let { onpick, onpulsepick, padding }: Props = $props();

  let container: HTMLDivElement;
  let overlay: HTMLCanvasElement;
  let lasso: Lasso | undefined;
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
      boxZoom: false, // shift + drag selects an area instead
      attributionControl: false,
    });
    // Bottom-left, kept above the sheet / Pulse deck (see --ctrl-bottom) so the map credits
    // stay visible; the right side belongs to the control stack.
    // Phones get the compact control, collapsed to its (i) button: MapLibre opens it until the
    // first drag, where it covers the map. Wide screens show the credits in full.
    const narrow = !matchMedia('(min-width: 900px)').matches;
    m.addControl(new AttributionControl({ compact: narrow }), 'bottom-left');
    if (narrow) {
      // MapLibre turns the control compact (and open) once the first credits arrive.
      const collapse = () => {
        const el = m.getContainer().querySelector('.maplibregl-ctrl-attrib.maplibregl-compact');
        if (!el) return;
        el.classList.remove('maplibregl-compact-show');
        m.off('styledata', collapse);
        m.off('sourcedata', collapse);
      };
      m.on('styledata', collapse);
      m.on('sourcedata', collapse);
    }
    map = m;
    // Handle for end-to-end tests (project venue coordinates to screen pixels).
    (window as unknown as { __adeMap?: MlMap }).__adeMap = m;
    m.touchZoomRotate.disableRotation();
    m.keyboard.disableRotation();
    m.on('style.load', () => {
      addAppLayers(map!, styleTheme ?? 'light');
      addPulseLayers(map!, app.pulseOn);
      applied = null; // feature-state is lost with the old style
      styleReady = true;
    });
    lasso = new Lasso({
      map: m,
      canvas: overlay,
      color: () => (app.theme === 'dark' ? COLORS.accent : '#7a6500'),
      ondone: (poly) => app.setArea(poly),
    });
    map.on('click', (e) => {
      if (app.drawMode) return;
      const r = 16;
      const { x, y } = e.point;
      if (app.pulseOn) return pickPulse(x, y, r);
      const feats = map!.queryRenderedFeatures(
        [
          [x - r, y - r],
          [x + r, y + r],
        ],
        { layers: ['pins'] },
      );
      const ids = [...new Set(feats.map((f) => String(f.properties.id)))];
      const members = (id: string) =>
        String(feats.find((g) => String(g.properties.id) === id)?.properties.ids ?? id).split(',');
      // Prefer pins that are not faded, closest first.
      const scored = ids
        .map((id) => {
          const f = feats.find((g) => String(g.properties.id) === id)!;
          const p = map!.project((f.geometry as GeoJSON.Point).coordinates as LngLat);
          return { id, d: Math.hypot(p.x - x, p.y - y), dim: !!f.properties.dim };
        })
        .filter((s) => s.d <= r)
        .sort((a, b) => Number(a.dim) - Number(b.dim) || a.d - b.d);
      // A shared-spot pin expands to all its venues (→ chooser).
      if (scored.length) onpick([...new Set(scored.flatMap((s) => members(s.id)))]);
    });
    for (const layer of ['pins', 'pulse-core']) {
      map.on('mouseenter', layer, () => (map!.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', layer, () => (map!.getCanvas().style.cursor = ''));
    }
  });

  onDestroy(() => {
    cancelAnimationFrame(pulseFrame);
    lasso?.destroy();
    map?.remove();
  });

  // Live venues pulse with CSS-animated markers: the animation runs on the compositor,
  // so the map itself never has to repaint for it. (Not in Pulse mode, which has its own.)
  const pulseMarkers = new Map<string, Marker>();
  $effect(() => {
    const live = app.pulseOn ? [] : app.mapPins.filter((p) => p.live && p.matched > 0);
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
    const theme = app.mapTheme;
    if (!map || theme === styleTheme) return;
    styleTheme = theme;
    loadStyle(theme).then(({ style, remote }) => {
      if (styleTheme !== theme || !map) return;
      usingFallback = !remote;
      styleReady = false;
      map.setStyle(style, { diff: false });
    });
  });

  $effect(() => {
    lasso?.setActive(app.drawMode !== null, app.drawMode ?? 'lasso');
  });

  // ---------------------------------------------------------------- Pulse mode
  const pulseData = $derived(app.data ? pulseEvents(app.data.events, app.data.venues) : []);
  /** Feature-state last applied per venue, to only send changes to MapLibre. */
  let applied: { count: number; w: number; soon: number; flash: number }[] | null = null;
  let pulseFrame = 0;

  // Switch between the normal map and Pulse layers.
  $effect(() => {
    const on = app.pulseOn;
    if (!map || !styleReady) return;
    for (const id of PULSE_LAYERS)
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    for (const id of NORMAL_LAYERS)
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'none' : 'visible');
  });

  // Venue points for Pulse (positions only; the state changes every frame).
  $effect(() => {
    const venues = app.data?.venues;
    if (!map || !styleReady || !venues) return;
    (map.getSource('pulse') as GeoJSONSource | undefined)?.setData(pulseGeoJSON(venues, coords));
    applied = null;
  });

  // Recompute per-venue state when the Pulse clock moves, at most once per frame. Never
  // cancel a pending update: during playback the clock changes every frame, and cancelling
  // would starve the map (it froze while the clock ran). The update draws the latest time.
  $effect(() => {
    void app.pulseT;
    const on = app.pulseOn;
    void pulseData;
    if (!map || !styleReady || !on || pulseFrame) return;
    pulseFrame = requestAnimationFrame(() => {
      pulseFrame = 0;
      if (app.pulseOn) applyPulse(app.pulseT);
    });
  });

  function applyPulse(t: number) {
    const venues = app.data?.venues;
    if (!map || !venues || !map.getSource('pulse')) return;
    const st = computeState(pulseData, venues.length, t);
    applied ??= venues.map(() => ({ count: -1, w: -1, soon: -1, flash: -1 }));
    const labels: GeoJSON.Feature[] = [];
    for (let i = 0; i < venues.length; i++) {
      const next = {
        count: st.count[i],
        w: Math.round(st.weight[i] * 100) / 100,
        soon: st.soon[i],
        // No ripple animation for people who prefer reduced motion: static dots only.
        flash: reducedMotion ? 0 : Math.round(st.flash[i] * 50) / 50,
      };
      const prev = applied[i];
      if (
        prev.count !== next.count ||
        prev.w !== next.w ||
        prev.soon !== next.soon ||
        prev.flash !== next.flash
      ) {
        map.setFeatureState({ source: 'pulse', id: i }, next);
        applied[i] = next;
      }
      if (st.count[i] >= 2) {
        const v = venues[i];
        labels.push({
          type: 'Feature',
          properties: { name: v.name, count: st.count[i] },
          geometry: { type: 'Point', coordinates: coords.get(v.id) ?? [v.lng, v.lat] },
        });
      }
    }
    // The time the map shows (lets tests wait for the drawn state, not just the clock).
    container.dataset.pulseT = String(Math.round(t));
    const key = labels.map((f) => `${f.properties!.name}:${f.properties!.count}`).join('|');
    if (key !== labelKey) {
      labelKey = key;
      (map.getSource('pulse-labels') as GeoJSONSource | undefined)?.setData({
        type: 'FeatureCollection',
        features: labels,
      });
    }
  }
  let labelKey = '';

  /** Tap in Pulse mode: the nearest venue with a party running at the current time. */
  function pickPulse(x: number, y: number, r: number) {
    if (!map) return;
    const feats = map.queryRenderedFeatures(
      [
        [x - r, y - r],
        [x + r, y + r],
      ],
      { layers: ['pulse-core'] },
    );
    const lit = feats
      .filter((f) => (f.state?.count ?? 0) > 0)
      .map((f) => {
        const p = map!.project((f.geometry as GeoJSON.Point).coordinates as LngLat);
        return { id: String(f.properties.id), d: Math.hypot(p.x - x, p.y - y) };
      })
      .sort((a, b) => a.d - b.d);
    if (lit.length) onpulsepick(lit[0].id);
  }

  // Show the selected area (re-applied after a style switch).
  $effect(() => {
    const area = app.area;
    if (!map || !styleReady) return;
    (map.getSource('area') as GeoJSONSource | undefined)?.setData(
      area
        ? { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [area] } }
        : { type: 'FeatureCollection', features: [] },
    );
  });

  // Plan B radius and starting point (re-applied after a style switch).
  $effect(() => {
    const pb = app.planB;
    if (!map || !styleReady) return;
    (map.getSource('planb') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: pb
        ? [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Polygon',
                coordinates: [circlePolygon(pb.origin, pb.minutes * WALK_M_PER_MIN)],
              },
            },
            { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: pb.origin } },
          ]
        : [],
    });
  });

  // Night planner route (re-applied after a style switch).
  $effect(() => {
    const stops = app.nightPlan ? app.nightStops : [];
    if (!map || !styleReady) return;
    const pts = stops.map((s) => [s.venue.lng, s.venue.lat] as LngLat);
    (map.getSource('route') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: [
        ...(pts.length > 1
          ? [
              {
                type: 'Feature' as const,
                properties: {},
                geometry: { type: 'LineString' as const, coordinates: pts },
              },
            ]
          : []),
        ...pts.map((c, k) => ({
          type: 'Feature' as const,
          properties: { n: k + 1 },
          geometry: { type: 'Point' as const, coordinates: c },
        })),
      ],
    });
  });

  export function getCenter(): LngLat | null {
    const c = map?.getCenter();
    return c ? [c.lng, c.lat] : null;
  }

  // Push pin data whenever the result set or selection changes.
  $effect(() => {
    const data = pinsGeoJSON(
      app.mapPins,
      coords,
      app.focusVenueId,
      app.query.trim().length > 0 || !!app.artist,
      app.filters.soldOut === 'resale',
    );
    if (!map || !styleReady) return;
    (map.getSource('venues') as GeoJSONSource | undefined)?.setData(data);
  });

  /**
   * Centre in the part of the map the sheet/panel leaves visible. An offset is used
   * instead of flyTo's `padding`, which MapLibre would keep and add to later fitBounds calls.
   */
  function visibleOffset(): [number, number] {
    return [(padding.left - padding.right) / 2, (padding.top - padding.bottom) / 2];
  }

  export function flyToVenue(id: string) {
    const c = coords.get(id);
    if (!map || !c) return;
    map.flyTo({
      center: c,
      zoom: Math.max(map.getZoom(), 15),
      offset: visibleOffset(),
      duration: reducedMotion ? 0 : 800,
    });
  }

  export function fitTo(points: LngLat[]) {
    if (!map || !points.length) return;
    const duration = reducedMotion ? 0 : 600;
    if (points.length === 1) {
      return map.flyTo({
        center: points[0],
        zoom: Math.max(map.getZoom(), 15),
        offset: visibleOffset(),
        duration,
      });
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
      offset: visibleOffset(),
      duration: reducedMotion ? 0 : 800,
    });
  }

  export function getMap() {
    return map;
  }
</script>

<div
  class="map"
  bind:this={container}
  data-fallback={usingFallback || undefined}
  style:--ctrl-bottom="{padding.bottom}px"
  style:--ctrl-left="{padding.left}px"
></div>
<canvas class="overlay" bind:this={overlay} aria-hidden="true"></canvas>

<style>
  .map {
    position: absolute;
    inset: 0;
  }
  .overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 5;
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
  .map :global(.maplibregl-ctrl-bottom-left) {
    bottom: var(--ctrl-bottom, 0px);
    left: var(--ctrl-left, 0px);
    transition: bottom 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  /* Keep the credits clear of the control column on the right. */
  .map :global(.maplibregl-ctrl-bottom-left .maplibregl-ctrl-attrib) {
    box-sizing: border-box;
    max-width: calc(100vw - var(--ctrl-left, 0px) - 10px - 76px); /* 10px: its own left margin */
  }
  :global(.maplibregl-ctrl-attrib) {
    font-size: 11px;
  }
</style>
