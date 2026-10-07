<script lang="ts">
  import { onMount } from 'svelte';
  import { loadData } from './lib/data';
  import { plural } from './lib/format';
  import { app } from './lib/store.svelte';
  import { festivalDay } from './lib/time';
  import MapView from './map/Map.svelte';
  import { activeFilterCount } from './lib/filter';
  import type { AdeEvent } from './lib/types';
  import EventDetail from './ui/EventDetail.svelte';
  import FilterSheet from './ui/FilterSheet.svelte';
  import MapControls from './ui/MapControls.svelte';
  import Toast from './ui/Toast.svelte';
  import PartyList from './ui/PartyList.svelte';
  import VenueList from './ui/VenueList.svelte';
  import TopBar from './ui/TopBar.svelte';
  import Icon from './ui/Icon.svelte';
  import Sheet from './ui/Sheet.svelte';
  import VenueChooser from './ui/VenueChooser.svelte';
  import VenueView from './ui/VenueView.svelte';

  let mapView: MapView | undefined = $state();
  let sheet: Sheet | undefined = $state();
  let sheetVisible = $state(0);
  let filtersOpen = $state(false);
  let toast = $state<{ text: string; action?: { label: string; run: () => void } } | null>(null);

  const narrowed = $derived(
    !!app.query.trim() || app.nowMode || activeFilterCount(app.filters) > 0 || !!app.area,
  );
  const venueCount = $derived(app.pins.filter((p) => p.matched > 0).length);

  const padding = $derived({
    top: 120,
    bottom: app.wide ? 0 : sheetVisible,
    left: app.wide ? 400 : 0,
    right: 0,
  });

  const dayLabel = $derived(
    app.nowMode
      ? 'Now'
      : app.day === 'all'
        ? 'All days'
        : app.day === 'fav'
          ? 'My list'
          : (festivalDay(app.day)?.short ?? ''),
  );

  onMount(async () => {
    try {
      app.data = await loadData();
    } catch (e) {
      app.error = e instanceof Error ? e.message : String(e);
    }
  });

  $effect(() => {
    document.documentElement.dataset.theme = app.theme;
  });

  // Keep the focused venue in view whenever it changes.
  let lastFocus: string | null = null;
  $effect(() => {
    const id = app.focusVenueId;
    if (!app.data || !mapView || id === lastFocus) return;
    lastFocus = id;
    if (id) mapView.flyToVenue(id);
  });

  // Reveal the results when a search, filter or Now mode first narrows the list.
  let wasNarrowed = false;
  $effect(() => {
    if (narrowed && !wasNarrowed && !app.wide && app.sheet === 'collapsed') app.sheet = 'half';
    wasNarrowed = narrowed;
  });

  // Frame a freshly drawn area in the visible part of the map.
  let lastArea: unknown = null;
  $effect(() => {
    const area = app.area;
    if (area && area !== lastArea) mapView?.fitTo(area);
    lastArea = area;
  });

  // New content starts at the top of the sheet.
  $effect(() => {
    void app.selectedEventId;
    void app.selectedVenueId;
    sheet?.scrollTop();
  });

  function fitResults() {
    if (app.area) return mapView?.fitTo(app.area);
    const ids = new Set(app.results.map((e) => e.venueId));
    const pts = app.pins
      .filter((p) => ids.has(p.venue.id))
      .map((p) => [p.venue.lng, p.venue.lat] as [number, number]);
    mapView?.fitTo(pts);
  }

  function openFromList(e: AdeEvent) {
    mapView?.flyToVenue(e.venueId);
    app.openEvent(e.id);
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape') return;
    if (app.drawMode) app.drawMode = null;
    else if (app.selectedEventId || app.selectedVenueId || app.chooser) app.back();
    else if (app.area) app.clearArea();
  }
</script>

<svelte:window {onkeydown} />

<div class="app">
  <MapView bind:this={mapView} onpick={(ids) => app.pick(ids)} {padding} />
  <TopBar onfilters={() => (filtersOpen = true)} />
  <FilterSheet bind:open={filtersOpen} />
  <MapControls
    bottom={app.wide ? 12 : sheetVisible}
    onlocate={(p) => mapView?.showMe(p)}
    onfit={fitResults}
    onmessage={(text) => (toast = { text })}
  />
  {#if toast}
    <Toast text={toast.text} action={toast.action} onclose={() => (toast = null)} />
  {/if}

  <Sheet bind:this={sheet} bind:snap={app.sheet} bind:visible={sheetVisible} wide={app.wide}>
    {#snippet header()}
      <div class="sheet-head">
        {#if app.chooser}
          <button class="icon-btn" aria-label="Back" onclick={() => app.back()}><Icon name="back" /></button>
          <h2>Pick a venue<span class="sub">{app.chooser.length} venues here</span></h2>
        {:else if app.selectedEvent}
          <button class="icon-btn" aria-label="Back" onclick={() => app.back()}><Icon name="back" /></button>
          <h2>{app.selectedEvent.venue.name}<span class="sub">Party details</span></h2>
          <button class="icon-btn" aria-label="Close" onclick={() => app.close()}
            ><Icon name="close" /></button
          >
        {:else if app.selectedVenue}
          <button class="icon-btn" aria-label="Back" onclick={() => app.back()}><Icon name="back" /></button>
          <h2>{app.selectedVenue.name}<span class="sub">Venue</span></h2>
          <button class="icon-btn" aria-label="Close" onclick={() => app.close()}
            ><Icon name="close" /></button
          >
        {:else if app.area}
          <h2 aria-live="polite">
            {plural(app.results.length, 'party', 'parties')} in this area<span class="sub">{dayLabel}</span>
          </h2>
          <button class="btn" onclick={() => app.clearArea()}>Clear area</button>
        {:else}
          <h2 aria-live="polite">
            {dayLabel} · {plural(app.results.length, 'party', 'parties')}
          </h2>
          <div class="seg" role="group" aria-label="List view">
            <button
              aria-pressed={app.listMode === 'parties'}
              onclick={() => (app.listMode = 'parties')}
              aria-label="Parties list"><Icon name="list" size={18} /></button
            >
            <button
              aria-pressed={app.listMode === 'venues'}
              onclick={() => (app.listMode = 'venues')}
              aria-label="Venues list ({venueCount})"><Icon name="pin" size={18} /></button
            >
          </div>
        {/if}
      </div>
    {/snippet}

    {#if app.error}
      <p class="empty">{app.error}</p>
    {:else if !app.data}
      <p class="empty">Loading the programme…</p>
    {:else if app.chooser}
      <VenueChooser ids={app.chooser} />
    {:else if app.selectedEvent}
      <EventDetail
        event={app.selectedEvent}
        onvenue={(id) => {
          mapView?.flyToVenue(id);
          if (!app.wide) app.sheet = 'half';
        }}
      />
    {:else if app.selectedVenue}
      <VenueView venue={app.selectedVenue} />
    {:else if app.listMode === 'venues'}
      <VenueList />
    {:else}
      <PartyList onopen={openFromList} onmessage={(text) => (toast = { text })} />
    {/if}
  </Sheet>
</div>

<style>
  .seg {
    display: flex;
    flex: none;
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 2px;
  }
  .seg button {
    width: 44px;
    height: 38px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 999px;
    background: none;
  }
  .seg button[aria-pressed='true'] {
    background: var(--fg);
    color: var(--surface);
  }
  .app {
    position: fixed;
    inset: 0;
  }
</style>
