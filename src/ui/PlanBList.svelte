<script lang="ts">
  import { app } from '../lib/store.svelte';
  import { hhmm } from '../lib/time';
  import type { AdeEvent } from '../lib/types';
  import EventCard from './EventCard.svelte';

  let { onopen }: { onopen: (e: AdeEvent) => void } = $props();

  const pb = $derived(app.planB!);
  const items = $derived(app.planBItems);

  function note(minutes: number, live: boolean, e: AdeEvent) {
    return `${minutes} min walk · ${live ? 'on now' : `starts ${hhmm(e.startMs)}`}`;
  }
</script>

<div class="planb">
  {#if pb.preview}
    <p class="info preview">
      Plan B works during ADE, 21–25 Oct. Here's what it would show on <b>Fri 23 at 23:30</b>.
    </p>
  {/if}
  <p class="info">
    {pb.source === 'location' ? 'From your location' : 'From the map centre (location unavailable)'} · parties on
    now or starting within the hour, up to {pb.minutes} min walk.
  </p>

  {#each items as i (i.event.id)}
    <EventCard event={i.event} showVenue resale note={note(i.minutes, i.live, i.event)} {onopen} />
  {:else}
    <div class="empty">
      <p>Nothing within {pb.minutes} minutes right now.</p>
      <button class="btn primary" onclick={() => app.widenPlanB()}>Widen to {pb.minutes * 2} min</button>
    </div>
  {/each}
</div>

<style>
  .info {
    margin: 10px 16px 0;
    font-size: 14px;
    color: var(--muted);
  }
  .info.preview {
    padding: 10px 12px;
    margin-bottom: 4px;
    border-radius: 10px;
    background: var(--surface-2);
    color: var(--fg);
  }
  .info + :global(.card) {
    margin-top: 8px;
    border-top: 1px solid var(--line);
  }
</style>
