<script lang="ts">
  import { activeFilterCount, applyQuery } from '../lib/filter';
  import { plural } from '../lib/format';
  import { clashes, exportFavs, importFavs } from '../lib/favs';
  import { listLink, listTitle } from '../lib/share';
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

  function note(e: AdeEvent): string | undefined {
    const parts: string[] = [];
    const hits = matchingArtists(e, toks);
    if (hits.length) parts.push(`With ${hits.join(', ')}`);
    const clash = app.favs.has(e.id) ? clashMap.get(e.id) : undefined;
    if (clash?.length) parts.push(`⚠ Clashes with ${clash.map((c) => c.title).join(', ')}`);
    return parts.join(' · ') || undefined;
  }

  async function doExport() {
    const blob = exportFavs(app.favs);
    try {
      await navigator.clipboard.writeText(blob);
      onmessage(`Copied ${plural(app.favs.size, 'favourite')} to the clipboard`);
    } catch {
      window.prompt('Copy your list:', blob);
    }
  }

  /** Share My list as a link; asks once for an optional name ("Fabrizio's list"). */
  async function shareList() {
    let name = readJSON<string | null>(KEYS.name, null);
    if (name === null) {
      const typed = window.prompt('Your name, shown to people you share your list with (optional):', '');
      if (typed === null) return; // cancelled
      name = typed.trim().slice(0, 40);
      writeJSON(KEYS.name, name);
    }
    const ids = [...app.listEvents].sort((a, b) => a.startMs - b.startMs).map((e) => e.id);
    const { url, included } = listLink(ids, name);
    await app.share(url, listTitle(name));
    if (included < ids.length) {
      onmessage(`Link holds the first ${included} of ${ids.length} parties (link length limit)`);
    }
  }

  function doImport() {
    const text = window.prompt('Paste an exported list (ADE2026-FAVS:…)');
    if (!text || !app.data) return;
    const ids = importFavs(text, (id) => app.data!.eventsById.has(id));
    if (!ids.length) return onmessage('No parties found in that text');
    const before = app.favs.size;
    app.setFavs(new Set([...app.favs, ...ids]));
    onmessage(`Added ${plural(app.favs.size - before, 'party', 'parties')} to your list`);
  }

  function toggleAfterMidnight() {
    afterMidnight = !afterMidnight;
    writeJSON(KEYS.afterMidnight, afterMidnight);
  }
</script>

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
    <button class="btn primary" disabled={!app.favs.size} onclick={shareList}>Share list</button>
    <button class="btn" disabled={!app.favs.size} onclick={doExport}>Export list</button>
    <button class="btn" onclick={doImport}>Import list</button>
  </div>
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
