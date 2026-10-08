<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchMeta, loadData, loadDescriptions, programmeChanged } from './lib/data';
  import { plural } from './lib/format';
  import { app } from './lib/store.svelte';
  import { asOfLabel, festivalDay } from './lib/time';
  import MapView from './map/Map.svelte';
  import { activeFilterCount } from './lib/filter';
  import type { AdeEvent } from './lib/types';
  import EventDetail from './ui/EventDetail.svelte';
  import Brand from './ui/Brand.svelte';
  import FilterSheet from './ui/FilterSheet.svelte';
  import MapControls from './ui/MapControls.svelte';
  import PlanBList from './ui/PlanBList.svelte';
  import NightPlan from './ui/NightPlan.svelte';
  import ArtistView from './ui/ArtistView.svelte';
  import { dueReminders, notify, reminderText } from './lib/reminders';
  import { eventLink } from './lib/share';
  import ManualLink from './ui/ManualLink.svelte';
  import PulseDeck from './ui/PulseDeck.svelte';
  import { WALK_M_PER_MIN, circlePolygon } from './lib/planb';
  import { inValidBounds } from './lib/geo';
  import Sparkline from './ui/Sparkline.svelte';
  import { histogram, pulseEvents } from './lib/pulse';
  import Toast from './ui/Toast.svelte';
  import PartyList from './ui/PartyList.svelte';
  import VenueList from './ui/VenueList.svelte';
  import TopBar from './ui/TopBar.svelte';
  import NavTabs from './ui/NavTabs.svelte';
  import MoreSheet from './ui/MoreSheet.svelte';
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

  // Pulse mode: the deck replaces the sheet, which only comes back for a tapped venue.
  const pulseData = $derived(app.data ? pulseEvents(app.data.events, app.data.venues) : []);
  const bins = $derived(histogram(pulseData));
  let deckHeight = $state(0);
  const sheetShown = $derived(!app.pulseOn || !!app.selectedVenue || !!app.selectedEvent);
  // Bottom navigation: a tab bar on phones (not in Pulse, which has its own deck).
  const tabBar = $derived(!app.wide && !app.pulseOn);
  let tabBarHeight = $state(0);
  const tabInset = $derived(tabBar ? tabBarHeight : 0);
  const bottomCover = $derived(
    app.pulseOn && !(sheetShown && !app.wide) ? deckHeight : app.wide ? 0 : sheetVisible + tabInset,
  );

  const padding = $derived({
    top: 134, // top bar incl. the brand slot
    bottom: bottomCover,
    left: app.wide && sheetShown ? 400 : 0, // the side panel (hidden in Pulse)
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

    // Chrome offers installation through an event; keep it for the More sheet.
    const onInstallable = (e: Event) => {
      e.preventDefault();
      app.installPrompt = e as typeof app.installPrompt;
    };
    const onInstalled = () => (app.installPrompt = null);
    window.addEventListener('beforeinstallprompt', onInstallable);
    window.addEventListener('appinstalled', onInstalled);

    // Offer a reload when a newer programme is published while the app stays open.
    const check = async () => {
      if (!app.data || document.visibilityState !== 'visible') return;
      const meta = await fetchMeta();
      if (!meta) return;
      if (programmeChanged(app.data, meta)) {
        toast = {
          text: 'Updated programme available',
          action: { label: 'Reload', run: () => location.reload() },
        };
      } else if (meta.generated > (app.checkedAt ?? app.data.generated)) {
        // Re-checked with no changes: the programme on screen is current as of now.
        app.checkedAt = meta.generated;
      }
    };
    const timer = setInterval(check, 20 * 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('beforeinstallprompt', onInstallable);
      window.removeEventListener('appinstalled', onInstalled);
    };
  });

  $effect(() => {
    document.documentElement.dataset.theme = app.theme;
  });

  // Keep the focused venue in view whenever it changes. Not in Pulse: the venue was tapped
  // on screen, and leaving Pulse should find the map where it was.
  let lastFocus: string | null = null;
  $effect(() => {
    const id = app.focusVenueId;
    if (!app.data || !mapView || id === lastFocus) return;
    lastFocus = id;
    if (id && !app.pulseOn) mapView.flyToVenue(id);
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
        app.resolveLinkDay(); // #e= / #v= links without a day
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

  const asOf = $derived(app.data ? asOfLabel(app.checkedAt ?? app.data.generated, app.now) : '');

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

  /** Plan B: from the user's location, or the map centre if that isn't available. */
  let planBLocating = $state(false);
  function startPlanB() {
    const fromCentre = () => {
      const c = mapView?.getCenter();
      if (c) app.startPlanB(c, 'centre');
    };
    if (!('geolocation' in navigator)) return fromCentre();
    planBLocating = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        planBLocating = false;
        const { latitude: lat, longitude: lng } = pos.coords;
        if (inValidBounds(lat, lng)) app.startPlanB([lng, lat], 'location');
        else {
          toast = { text: 'You seem to be outside Amsterdam — using the map centre' };
          fromCentre();
        }
      },
      () => {
        planBLocating = false;
        fromCentre();
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }

  // Frame the walking radius whenever Plan B starts or widens.
  let lastPlanB = '';
  $effect(() => {
    const pb = app.planB;
    const key = pb ? `${pb.origin}|${pb.minutes}` : '';
    if (key && key !== lastPlanB) mapView?.fitTo(circlePolygon(pb!.origin, pb!.minutes * WALK_M_PER_MIN, 16));
    lastPlanB = key;
  });

  // An artist sheet opens framed on the venues of their sets.
  let lastArtist = '';
  $effect(() => {
    const key = app.artist?.key ?? '';
    if (key && key !== lastArtist && mapView) {
      const pts = app.artistEvents.map((e) => [e.venue.lng, e.venue.lat] as [number, number]);
      queueMicrotask(() => mapView?.fitTo(pts));
    }
    lastArtist = key;
  });

  // The night plan opens framed on its stops (and re-frames when the night changes).
  let lastNight = '';
  $effect(() => {
    const key = app.nightPlan ? `${app.nightPlan.night}|${app.nightStops.map((e) => e.id).join()}` : '';
    if (key && key !== lastNight && mapView) {
      const pts = app.nightStops.map((e) => [e.venue.lng, e.venue.lat] as [number, number]);
      queueMicrotask(() => mapView?.fitTo(pts));
    }
    lastNight = key;
  });

  // A shared list opens framed on its venues (they're often spread across the city).
  let lastShared = '';
  $effect(() => {
    const key = app.sharedList && app.data && mapView ? app.sharedList.ids.join() : '';
    if (key && key !== lastShared) queueMicrotask(fitResults);
    lastShared = key;
  });

  // Reminders: every clock tick (30 s), notify for starred parties starting within 30 min.
  $effect(() => {
    const now = app.now;
    if (!app.reminders || !app.data || typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    const data = app.data;
    const starred = [...app.favs].map((id) => data.eventsById.get(id)).filter((e) => !!e);
    const due = dueReminders(starred, now, app.reminded);
    if (!due.length) return;
    app.markReminded(due.map((e) => e.id));
    for (const e of due) {
      const { title, body } = reminderText(e, now);
      notify(title, body, eventLink(e.id), `ade2026-${e.id}`).catch(() => {});
    }
  });

  // Messages from components (e.g. "Link copied") go to the toast.
  $effect(() => {
    if (app.message) {
      toast = { text: app.message };
      app.message = null;
    }
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
    if (app.moreOpen) app.moreOpen = false;
    else if (app.drawMode) app.drawMode = null;
    else if (app.selectedEventId || app.selectedVenueId || app.chooser) app.back();
    else if (app.artist) app.closeArtist();
    else if (app.nightPlan) app.closeNightPlan();
    else if (app.planB) app.closePlanB();
    else if (app.sharedList) app.closeSharedList();
    else if (app.pulseOn) app.exitPulse();
    else if (app.area) app.clearArea();
  }
</script>

<svelte:window {onkeydown} />

<div class="app">
  <MapView
    bind:this={mapView}
    onpick={(ids) => app.pick(ids)}
    onpulsepick={(id) => app.openVenue(id)}
    {padding}
  />
  <TopBar onfilters={() => (filtersOpen = true)} />
  <Brand />
  <FilterSheet bind:open={filtersOpen} />
  <MapControls
    bottom={app.wide && !app.pulseOn ? 12 : bottomCover}
    onlocate={(p) => mapView?.showMe(p)}
    onfit={fitResults}
    onplanb={() => (app.planB ? app.closePlanB() : startPlanB())}
    {planBLocating}
    onmessage={(text) => (toast = { text })}
  />
  {#if app.manualLink}
    <ManualLink url={app.manualLink} onclose={() => (app.manualLink = null)} />
  {/if}
  {#if toast}
    <Toast text={toast.text} action={toast.action} onclose={() => (toast = null)} />
  {/if}

  {#if app.pulseOn && app.data}
    <PulseDeck events={pulseData} {bins} bind:height={deckHeight} />
  {/if}

  {#if sheetShown}
    <Sheet
      bind:this={sheet}
      bind:snap={app.sheet}
      bind:visible={sheetVisible}
      wide={app.wide}
      peek={app.pulseOn ? 56 : 90}
      inset={tabInset}
    >
      {#snippet top()}
        {#if app.wide && !app.pulseOn}<NavTabs variant="row" />{/if}
        {#if !app.pulseOn && app.data}<Sparkline {bins} />{/if}
      {/snippet}
      {#snippet header()}
        <div class="sheet-head">
          {#if app.chooser}
            <button class="icon-btn" aria-label="Back" onclick={() => app.back()}><Icon name="back" /></button
            >
            <h2 tabindex="-1">Pick a venue<span class="sub">{app.chooser.length} venues here</span></h2>
          {:else if app.selectedEvent}
            <button class="icon-btn" aria-label="Back" onclick={() => app.back()}><Icon name="back" /></button
            >
            <h2 tabindex="-1">{app.selectedEvent.venue.name}<span class="sub">Party details</span></h2>
            <button class="icon-btn" aria-label="Close" onclick={() => app.close()}
              ><Icon name="close" /></button
            >
          {:else if app.selectedVenue}
            <button class="icon-btn" aria-label="Back" onclick={() => app.back()}><Icon name="back" /></button
            >
            <h2 tabindex="-1">{app.selectedVenue.name}<span class="sub">Venue</span></h2>
            <button class="icon-btn" aria-label="Close" onclick={() => app.close()}
              ><Icon name="close" /></button
            >
          {:else if app.artist}
            <button class="icon-btn" aria-label="Back" onclick={() => app.closeArtist()}
              ><Icon name="back" /></button
            >
            <h2 tabindex="-1" aria-live="polite">
              {app.artist.name}<span class="sub"
                >{plural(app.artistEvents.length, 'set')} · {plural(
                  new Set(app.artistEvents.map((e) => e.day)).size,
                  'day',
                )}</span
              >
            </h2>
          {:else if app.nightPlan}
            <h2 tabindex="-1" aria-live="polite">
              Plan my night<span class="sub">{plural(app.nightStops.length, 'party', 'parties')} starred</span
              >
            </h2>
            <button class="btn" onclick={() => app.closeNightPlan()}>Close</button>
          {:else if app.planB}
            <h2 tabindex="-1" aria-live="polite">
              Plan B<span class="sub"
                >{plural(app.planBItems.length, 'party', 'parties')} within {app.planB.minutes} min walk</span
              >
            </h2>
            <button class="btn" onclick={() => app.closePlanB()}>Close</button>
          {:else if app.sharedList}
            <h2 tabindex="-1" aria-live="polite">
              Shared list<span class="sub"
                >{plural(app.results.length, 'party', 'parties')} · shared with you</span
              >
            </h2>
            <button class="btn" onclick={() => app.closeSharedList()}>Close</button>
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
      {:else if app.artist}
        <ArtistView onopen={openFromList} />
      {:else if app.nightPlan}
        <NightPlan onopen={openFromList} />
      {:else if app.planB}
        <PlanBList onopen={openFromList} />
      {:else if app.sharedList}
        {#if app.sharedBanner}
          <div class="shared-banner" role="region" aria-label="Shared list">
            <p>
              <strong>Shared list</strong> · {plural(app.results.length, 'party', 'parties')}
            </p>
            <div class="actions">
              <button
                class="btn primary"
                onclick={() => {
                  const added = app.saveSharedList();
                  toast = { text: `Added ${plural(added, 'party', 'parties')} to your list` };
                }}>Save to my list</button
              >
              <button class="btn" onclick={() => (app.sharedBanner = false)}>Just look</button>
            </div>
          </div>
        {/if}
        <PartyList onopen={openFromList} onmessage={(text) => (toast = { text })} />
      {:else if !listVisible}
        <!-- The list is only built once the sheet opens: rendering 300+ cards up front
           costs ~1 s of main thread on a mid-range phone. -->
      {:else if app.listMode === 'venues'}
        <VenueList />
      {:else}
        <PartyList onopen={openFromList} onmessage={(text) => (toast = { text })} />
      {/if}
    </Sheet>
  {/if}

  {#if tabBar}
    <NavTabs variant="bar" bind:height={tabBarHeight} />
  {/if}
  {#if app.moreOpen && !app.pulseOn}
    <MoreSheet bottom={tabInset} {asOf} />
  {/if}
</div>

<style>
  .shared-banner {
    margin: 12px 16px 4px;
    padding: 12px 14px 4px;
    border-radius: var(--radius);
    background: var(--surface-2);
    border: 1px solid var(--line);
  }
  .shared-banner p {
    margin: 0;
  }
  .shared-banner .actions {
    padding: 10px 0;
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
