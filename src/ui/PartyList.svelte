<script lang="ts">
  import { activeFilterCount, applyQuery } from '../lib/filter';
  import { plural } from '../lib/format';
  import { groupByHour, nextDay, type Group } from '../lib/group';
  import { matchingArtists, search, tokens } from '../lib/search';
  import { KEYS, readJSON, writeJSON } from '../lib/storage';
  import { app } from '../lib/store.svelte';
  import { festivalDay } from '../lib/time';
  import type { AdeEvent } from '../lib/types';
  import EventCard from './EventCard.svelte';

  let { onopen }: { onopen: (e: AdeEvent) => void } = $props();

  let afterMidnight = $state(readJSON(KEYS.afterMidnight, true));
  const toks = $derived(tokens(app.query));
  const singleDay = $derived(!app.nowMode && app.day !== 'all' && app.day !== 'fav');

  /** Next day's 00:00–05:59 parties that pass the same filters. */
  const lateNight = $derived.by(() => {
    if (!singleDay || !afterMidnight || !app.data) return [];
    const next = app.data.eventsByDay.get(nextDay(app.day)) ?? [];
    return applyQuery(
      next.filter((e) => e.lateNight),
      { filters: app.filters, query: app.query, nowMode: false, now: app.now },
    );
  });

  const groups = $derived.by<Group[]>(() => {
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
    const hits = matchingArtists(e, toks);
    return hits.length ? `With ${hits.join(', ')}` : undefined;
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
      <EventCard event={e} showVenue showDay={!singleDay || g.divider} note={note(e)} {onopen} />
    {/each}
  </section>
{:else}
  <div class="empty">
    <p>No parties match{app.nowMode ? ' right now' : ''}.</p>
    {#if activeFilterCount(app.filters)}
      <button class="btn" onclick={() => app.clearFilters()}>Clear filters</button>
    {/if}
    {#if app.query}
      <button class="btn" onclick={() => (app.query = '')}>Clear search</button>
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
  .group :global(.card) {
    content-visibility: auto;
    contain-intrinsic-size: auto 96px;
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
