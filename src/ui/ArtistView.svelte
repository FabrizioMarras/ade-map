<script lang="ts">
  import { groupByDay } from '../lib/group';
  import { app } from '../lib/store.svelte';
  import type { AdeEvent } from '../lib/types';
  import EventCard from './EventCard.svelte';

  let { onopen }: { onopen: (e: AdeEvent) => void } = $props();

  const groups = $derived(groupByDay(app.artistEvents));
</script>

<div class="artist">
  {#each groups as g (g.key)}
    <section>
      <h3 class="hour">{g.label}</h3>
      {#each g.events as e (e.id)}
        <EventCard event={e} showVenue {onopen} />
      {/each}
    </section>
  {:else}
    <p class="empty">No sets found.</p>
  {/each}
</div>

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
</style>
