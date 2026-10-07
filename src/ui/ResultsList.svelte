<script lang="ts">
  import { activeFilterCount } from '../lib/filter';
  import { plural } from '../lib/format';
  import { matchingArtists, search, tokens } from '../lib/search';
  import { app } from '../lib/store.svelte';
  import type { AdeEvent } from '../lib/types';
  import EventCard from './EventCard.svelte';

  let { onopen }: { onopen: (e: AdeEvent) => void } = $props();

  const toks = $derived(tokens(app.query));
  const sorted = $derived(app.nowMode ? [...app.results].sort((a, b) => a.startMs - b.startMs) : app.results);
  const multiDay = $derived(app.nowMode || app.day === 'all' || app.day === 'fav');
  /** Matches on other days, so a search on one day doesn't hide them silently. */
  const elsewhere = $derived(
    app.data && toks.length && !multiDay
      ? search(app.data.events, app.query).filter((e) => e.day !== app.day).length
      : 0,
  );

  function note(e: AdeEvent): string | undefined {
    const hits = matchingArtists(e, toks);
    return hits.length ? `With ${hits.join(', ')}` : undefined;
  }
</script>

{#each sorted as e (e.id)}
  <EventCard event={e} showVenue showDay={multiDay} note={note(e)} {onopen} />
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
