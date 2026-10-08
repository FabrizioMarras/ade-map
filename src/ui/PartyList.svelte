<script lang="ts">
  import { activeFilterCount, applyQuery } from '../lib/filter';
  import { plural } from '../lib/format';
  import { clashes, exportFavs, importFavs } from '../lib/favs';
  import { downloadIcs, eventsToIcs } from '../lib/ics';
  import { searchArtists } from '../lib/artists';
  import { listLink } from '../lib/share';
  import { groupByDay, groupByHour, nextDay, type Group } from '../lib/group';
  import { matchingArtists, search, tokens } from '../lib/search';
  import { KEYS, readJSON, writeJSON } from '../lib/storage';
  import { app } from '../lib/store.svelte';
  import { festivalDay } from '../lib/time';
  import type { AdeEvent } from '../lib/types';
  import EventCard from './EventCard.svelte';

  interface Props {
    onopen: (e: AdeEvent) => void;
    onmessage: (text: string) => void;
  }

  let { onopen, onmessage }: Props = $props();

  let afterMidnight = $state(readJSON(KEYS.afterMidnight, true));
  const toks = $derived(tokens(app.query));
  const sharedMode = $derived(!app.nowMode && !!app.sharedList);
  const singleDay = $derived(!app.nowMode && !sharedMode && app.day !== 'all' && app.day !== 'fav');
  const favMode = $derived(!app.nowMode && !sharedMode && app.day === 'fav');
  const clashMap = $derived(
    clashes(app.data ? [...app.favs].map((id) => app.data!.eventsById.get(id)!).filter(Boolean) : []),
  );

  /** Next day's 00:00–05:59 parties that pass the same filters. */
  const lateNight = $derived.by(() => {
    if (!singleDay || !afterMidnight || !app.data) return [];
    const next = app.data.eventsByDay.get(nextDay(app.day)) ?? [];
    const late = applyQuery(
      next.filter((e) => e.lateNight),
      { filters: app.filters, query: app.query, nowMode: false, now: app.now },
    );
    return app.area ? late.filter((e) => app.inArea(e)) : late;
  });

  const groups = $derived.by<Group[]>(() => {
    if (favMode || sharedMode) return groupByDay(app.listEvents);
    const g = groupByHour(app.listEvents, !singleDay);
    if (lateNight.length) g.push({ key: 'after', label: 'After midnight', events: lateNight, divider: true });
    return g;
  });

  const elsewhere = $derived(
    app.data && toks.length && singleDay
      ? search(app.data.events, app.query).filter((e) => e.day !== app.day).length
      : 0,
  );
  const nextLabel = $derived(singleDay ? festivalDay(nextDay(app.day))?.short : undefined);

  /** Artists matching the search: tap one for all their sets across the week. */
  const artists = $derived(toks.length ? searchArtists(app.artistIndex, app.query) : []);

  function note(e: AdeEvent): string | undefined {
    const parts: string[] = [];
    const hits = matchingArtists(e, toks);
    if (hits.length) parts.push(`With ${hits.join(', ')}`);
    const clash = app.favs.has(e.id) ? clashMap.get(e.id) : undefined;
    if (clash?.length) parts.push(`⚠ Clashes with ${clash.map((c) => c.title).join(', ')}`);
    return parts.join(' · ') || undefined;
  }

  /**
   * Share My list as a link. No dialogs or awaits before app.share: the share sheet needs the
   * tap's user activation, so it must be called straight from the click.
   */
  function shareList() {
    const ids = [...app.listEvents].sort((a, b) => a.startMs - b.startMs).map((e) => e.id);
    const { url, included } = listLink(ids);
    void app.share(url, 'Shared list');
    if (included < ids.length) {
      onmessage(`Link holds the first ${included} of ${ids.length} parties (link length limit)`);
    }
  }

  function exportCalendar() {
    const starred = [...app.favs].map((id) => app.data?.eventsById.get(id)).filter((e) => !!e);
    if (!starred.length) return;
    downloadIcs(eventsToIcs(starred));
    onmessage(`Calendar with ${plural(starred.length, 'party', 'parties')} downloaded`);
  }

  const notificationsSupported = typeof Notification !== 'undefined';

  async function toggleReminders(on: boolean) {
    if (!on) return app.setReminders(false);
    if (!notificationsSupported) return onmessage('Notifications are not supported in this browser');
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      app.setReminders(true);
      onmessage('Reminders on: 30 minutes before each starred party');
    } else {
      app.setReminders(false);
      onmessage('Notifications are blocked for this site');
    }
  }

  /** Export / Import as inline panels (no browser pop-ups). */
  let transfer = $state<'export' | 'import' | null>(null);
  let pasted = $state('');
  let exportField: HTMLInputElement | undefined = $state();
  const exportText = $derived(exportFavs(app.favs));

  async function copyExport() {
    exportField?.select();
    try {
      await navigator.clipboard.writeText(exportText);
      onmessage(`Copied ${plural(app.favs.size, 'favourite')} to the clipboard`);
    } catch {
      onmessage('Select the text and copy it');
    }
  }

  function doImport() {
    if (!app.data) return;
    const ids = importFavs(pasted, (id) => app.data!.eventsById.has(id));
    if (!ids.length) return onmessage('No parties found in that text');
    const before = app.favs.size;
    app.setFavs(new Set([...app.favs, ...ids]));
    onmessage(`Added ${plural(app.favs.size - before, 'party', 'parties')} to your list`);
    pasted = '';
    transfer = null;
  }

  function toggleAfterMidnight() {
    afterMidnight = !afterMidnight;
    writeJSON(KEYS.afterMidnight, afterMidnight);
  }
</script>

{#if artists.length}
  <section class="artists" aria-label="Artists">
    <h3 class="hour">Artists</h3>
    <ul>
      {#each artists as a (a.key)}
        <li>
          <button onclick={() => app.openArtist(a.key)}>
            <span class="aname">{a.name}</span>
            <span class="sets">{plural(a.eventIds.length, 'set')}</span>
          </button>
        </li>
      {/each}
    </ul>
  </section>
{/if}

{#each groups as g (g.key)}
  <section class="group">
    <h3 class="hour tnum" class:divider={g.divider}>
      {g.label}
      {#if g.divider && nextLabel}<span>from {nextLabel}</span>{/if}
    </h3>
    {#each g.events as e (e.id)}
      <EventCard
        event={e}
        showVenue
        showDay={(!singleDay && !favMode && !sharedMode) || g.divider}
        note={note(e)}
        {onopen}
      />
    {/each}
  </section>
{:else}
  <div class="empty">
    {#if sharedMode}
      <p>None of these parties are in the programme any more.</p>
    {:else if favMode && !app.favs.size}
      <p>Your list is empty. Tap ☆ on any party to add it.</p>
    {:else}
      <p>No parties match{app.nowMode ? ' right now' : ''}.</p>
    {/if}
    {#if activeFilterCount(app.filters)}
      <button class="btn" onclick={() => app.clearFilters()}>Clear filters</button>
    {/if}
    {#if app.query}
      <button class="btn" onclick={() => (app.query = '')}>Clear search</button>
    {/if}
    {#if app.area}
      <button class="btn" onclick={() => app.clearArea()}>Clear area</button>
    {/if}
  </div>
{/each}

{#if elsewhere}
  <div class="empty">
    <button class="btn" onclick={() => app.setDay('all')}>
      {plural(elsewhere, 'more match', 'more matches')} on other days
    </button>
  </div>
{/if}

{#if favMode}
  <div class="actions transfer">
    <button class="btn primary" disabled={!app.starredNights.length} onclick={() => app.openNightPlan()}
      >Plan my night</button
    >
    <button class="btn" disabled={!app.favs.size} onclick={shareList}>Share list</button>
    <button class="btn" disabled={!app.favs.size} onclick={exportCalendar}>Calendar (.ics)</button>
    <button
      class="btn"
      disabled={!app.favs.size}
      aria-expanded={transfer === 'export'}
      onclick={() => (transfer = transfer === 'export' ? null : 'export')}>Export list</button
    >
    <button
      class="btn"
      aria-expanded={transfer === 'import'}
      onclick={() => (transfer = transfer === 'import' ? null : 'import')}>Import list</button
    >
  </div>
  <div class="reminders">
    <label class="setting">
      <input
        type="checkbox"
        checked={app.reminders}
        disabled={!notificationsSupported}
        onchange={(e) => toggleReminders(e.currentTarget.checked)}
      />
      Remind me 30 minutes before each starred party
    </label>
    <p class="fine">
      Reminders show while the app is open or running in the background — most reliable on Android with the
      app installed. On iPhone they need the app added to the Home Screen (iOS 16.4+), and closed apps may
      miss them.
    </p>
  </div>
  {#if transfer === 'export'}
    <div class="transfer-panel">
      <label for="export-text">Your list as text — copy it to another device and import it there</label>
      <div class="row">
        <input
          id="export-text"
          bind:this={exportField}
          readonly
          value={exportText}
          onfocus={(e) => e.currentTarget.select()}
        />
        <button class="btn primary" onclick={copyExport}>Copy</button>
      </div>
    </div>
  {:else if transfer === 'import'}
    <div class="transfer-panel">
      <label for="import-text">Paste an exported list (ADE2026-FAVS:…) or party links</label>
      <textarea id="import-text" rows="3" bind:value={pasted} placeholder="ADE2026-FAVS:…"></textarea>
      <div class="row end">
        <button class="btn" onclick={() => ((transfer = null), (pasted = ''))}>Cancel</button>
        <button class="btn primary" disabled={!pasted.trim()} onclick={doImport}>Import</button>
      </div>
    </div>
  {/if}
{/if}

{#if singleDay && nextLabel}
  <label class="setting">
    <input type="checkbox" checked={afterMidnight} onchange={toggleAfterMidnight} />
    Show {nextLabel} after-midnight parties at the end
  </label>
{/if}

<style>
  .hour {
    position: sticky;
    top: 0;
    z-index: 1;
    margin: 0;
    padding: 6px 16px;
    background: var(--surface-2);
    font-size: 14px;
    font-weight: 700;
    border-bottom: 1px solid var(--line);
  }
  .hour.divider {
    background: var(--fg);
    color: var(--surface);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .hour span {
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    margin-left: 6px;
  }
  .artists ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .artists button {
    width: 100%;
    min-height: var(--tap);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    border: 0;
    border-bottom: 1px solid var(--line);
    background: none;
    text-align: left;
  }
  .artists button:hover {
    background: var(--surface-2);
  }
  .aname {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 19px;
    text-transform: uppercase;
  }
  .sets {
    color: var(--muted);
    font-size: 14px;
    white-space: nowrap;
  }
  .reminders {
    margin: 0 0 8px;
  }
  .fine {
    margin: -4px 16px 0 46px;
    font-size: 13px;
    color: var(--muted);
  }
  .transfer-panel {
    margin: 0 16px 12px;
    padding: 12px;
    border-radius: var(--radius);
    background: var(--surface-2);
    border: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .transfer-panel label {
    font-size: 14px;
    color: var(--muted);
  }
  .transfer-panel .row {
    display: flex;
    gap: 8px;
  }
  .transfer-panel .row.end {
    justify-content: flex-end;
  }
  .transfer-panel input,
  .transfer-panel textarea {
    flex: 1;
    min-width: 0;
    min-height: var(--tap);
    padding: 8px 10px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--surface);
    color: var(--fg);
    font: 15px/1.3 var(--font-body);
  }
  .transfer {
    justify-content: center;
  }
  .setting {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: var(--tap);
    padding: 8px 16px;
    font-size: 14px;
    color: var(--muted);
  }
  .setting input {
    width: 20px;
    height: 20px;
    accent-color: var(--fg);
  }
</style>
