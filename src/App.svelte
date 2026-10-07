<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchGenerated, loadData, loadDescriptions } from './lib/data';
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
  // Once shown, keep the list mounted so collapsing the sheet doesn't throw it away.
  let listShown = $state(false);
  const listVisible = $derived(listShown || app.wide || app.sheet !== 'collapsed');
  $effect(() => {
    if (listVisible) listShown = true;
  });
  const venueCount = $derived(app.pins.filter((p) => p.matched > 0).length);

  const padding = $derived({
    top: 120,
    bottom: app.wide ? 0 : sheetVisible,
    left: app.wide ? 400 : 0,
    right: 56, // the map control stack
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

  onMount(() => {
    load();

    // Offer a reload when a newer programme is published while the app stays open.
    const check = async () => {
      if (!app.data || document.visibilityState !== 'visible') return;
      const generated = await fetchGenerated();
      if (generated && generated !== app.data.generated) {
        toast = {
          text: 'Updated programme available',
          action: { label: 'Reload', run: () => location.reload() },
        };
      }
    };
    const timer = setInterval(check, 20 * 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
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

  function load() {
    app.error = null;
    loadData()
      .then((d) => {
        app.data = d;
        loadDescriptions()
          .then((m) => (app.descriptions = m))
          .catch(() => {
            /* descriptions are optional; the detail view simply omits them */
          });
      })
      .catch((e) => {
        app.error = e instanceof Error ? e.message : String(e);
        if (!app.wide && app.sheet === 'collapsed') app.sheet = 'half';
      });
  }

  const asOf = $derived(
    app.data
      ? new Date(app.data.generated).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          timeZone: 'Europe/Amsterdam',
        })
      : '',
  );

  // When the sheet switches view, move focus to its heading if focus was inside the sheet
  // (e.g. after activating a card with the keyboard), so screen readers announce the change.
  let focusWasInSheet = false;
  $effect.pre(() => {
    void app.chooser;
    void app.selectedEventId;
    void app.selectedVenueId;
    // Runs before the DOM update, while the activated element still exists.
    const active = document.activeElement;
    focusWasInSheet = !!active?.closest('.sheet') && !active.closest('.sheet-head');
  });
  $effect(() => {
    void app.chooser;
    void app.selectedEventId;
    void app.selectedVenueId;
    if (focusWasInSheet) (document.querySelector('.sheet-head h2') as HTMLElement | null)?.focus();
  });

  // Searching moves the map to the matches: fly to a single venue or frame them all.
  // Debounced so the map doesn't jump on every keystroke.
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const q = app.query.trim();
    const venueIds = [...new Set(app.results.map((e) => e.venueId))];
    clearTimeout(searchTimer);
    if (!q || !venueIds.length || app.selectedEventId || app.selectedVenueId) return;
    searchTimer = setTimeout(() => {
      if (venueIds.length === 1) mapView?.flyToVenue(venueIds[0]);
      else fitResults();
    }, 450);
    return () => clearTimeout(searchTimer);
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
          <h2 tabindex="-1">Pick a venue<span class="sub">{app.chooser.length} venues here</span></h2>
        {:else if app.selectedEvent}
          <button class="icon-btn" aria-label="Back" onclick={() => app.back()}><Icon name="back" /></button>
          <h2 tabindex="-1">{app.selectedEvent.venue.name}<span class="sub">Party details</span></h2>
          <button class="icon-btn" aria-label="Close" onclick={() => app.close()}
            ><Icon name="close" /></button
          >
        {:else if app.selectedVenue}
          <button class="icon-btn" aria-label="Back" onclick={() => app.back()}><Icon name="back" /></button>
          <h2 tabindex="-1">{app.selectedVenue.name}<span class="sub">Venue</span></h2>
          <button class="icon-btn" aria-label="Close" onclick={() => app.close()}
            ><Icon name="close" /></button
          >
        {:else if app.area}
          <h2 tabindex="-1" aria-live="polite">
            {plural(app.results.length, 'party', 'parties')} in this area<span class="sub">{dayLabel}</span>
          </h2>
          <button class="btn" onclick={() => app.clearArea()}>Clear area</button>
        {:else}
          <h2 tabindex="-1" aria-live="polite">
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
      <div class="empty" role="alert">
        <p><strong>The programme couldn't be loaded.</strong></p>
        <p>{navigator.onLine ? app.error : 'You appear to be offline.'}</p>
        <button class="btn primary" onclick={load}>Try again</button>
      </div>
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
    {:else if !listVisible}
      <!-- The list is only built once the sheet opens: rendering 300+ cards up front
           costs ~1 s of main thread on a mid-range phone. -->
    {:else if app.listMode === 'venues'}
      <VenueList />
    {:else}
      <PartyList onopen={openFromList} onmessage={(text) => (toast = { text })} />
    {/if}

    {#if app.data && !app.selectedEvent && !app.selectedVenue && !app.chooser}
      <footer class="credits">
        <p>Programme as of {asOf} · refreshed from the ADE site</p>
        <p>
          Data © Amsterdam Dance Event (personal planning only) · Geocoding: PDOK Locatieserver · Map data ©
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>
          contributors · Tiles:
          <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>
        </p>
      </footer>
    {/if}
  </Sheet>
</div>

<style>
  .credits {
    padding: 16px;
    font-size: 13px;
    color: var(--muted);
    border-top: 1px solid var(--line);
  }
  .credits p {
    margin: 0 0 6px;
  }
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
