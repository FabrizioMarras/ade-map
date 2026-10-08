<script lang="ts">
  import { cardTags } from '../lib/format';
  import { app } from '../lib/store.svelte';
  import { shortRange, status } from '../lib/time';
  import type { AdeEvent } from '../lib/types';
  import Star from './Star.svelte';

  interface Props {
    event: AdeEvent;
    showVenue?: boolean;
    showDay?: boolean;
    note?: string;
    /** A warning about this party (a clash in My list), shown as a box. */
    clash?: string;
    /** Show sold out as 'Sold out · TicketSwap' (Plan B, or the TicketSwap filter mode). */
    resale?: boolean;
    onopen?: (e: AdeEvent) => void;
  }

  let { event, showVenue = false, showDay = false, note, clash, resale = false, onopen }: Props = $props();
  const st = $derived(status(event, app.now));
</script>

<article class="card" class:ended={st === 'ended'}>
  <button class="main" onclick={() => (onopen ? onopen(event) : app.openEvent(event.id))}>
    <span class="time tnum">
      {#if showDay}<span class="day">{event.day.slice(8)}</span>{/if}
      {shortRange(event)}
      {#if st === 'live'}<span class="live">Live</span>{:else if st === 'soon'}<span class="soon">Soon</span
        >{/if}
    </span>
    <span class="title">{event.title}</span>
    {#if showVenue}<span class="venue">{event.venue.name}</span>{/if}
    {#if note}<span class="note">{note}</span>{/if}
    {#if clash}<span class="note clash">{clash}</span>{/if}
    <span class="tags">
      {#if event.soldOut && (resale || app.filters.soldOut === 'resale')}<span class="tag resale"
          >Sold out · TicketSwap</span
        >{:else if event.soldOut}<span class="tag soldout">Sold out</span>{/if}
      {#if event.free}<span class="tag free">Free</span>{/if}
      {#each cardTags(event) as t (t)}<span class="tag">{t}</span>{/each}
    </span>
  </button>
  <Star id={event.id} title={event.title} />
</article>

<style>
  .card {
    display: flex;
    align-items: stretch;
    border-bottom: 1px solid var(--line);
  }
  .card :global(.star) {
    align-self: flex-start;
    margin: 6px 4px 0 0;
  }
  /* Ended: muted colours rather than opacity, so text keeps ≥ 4.5:1 contrast. */
  .card.ended .title,
  .card.ended .venue {
    color: var(--muted);
  }
  .card.ended .tag {
    background: none;
    border: 1px solid var(--line);
    color: var(--muted);
  }
  .main {
    flex: 1;
    min-width: 0;
    text-align: left;
    background: none;
    border: 0;
    padding: 12px 8px 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-height: var(--tap);
  }
  .main:hover {
    background: var(--surface-2);
  }
  .time {
    font-size: 14px;
    color: var(--muted);
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .day {
    font-weight: 700;
    color: var(--fg);
  }
  .live,
  .soon {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--live);
  }
  .soon {
    color: var(--muted);
  }
  .title {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 20px;
    line-height: 1.1;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }
  .venue {
    font-size: 15px;
    font-weight: 600;
  }
  .note {
    font-size: 14px;
    color: var(--muted);
  }
  .clash {
    align-self: flex-start;
    max-width: 100%;
    margin: 4px 0 2px;
    padding: 12px;
    border-radius: var(--r-box);
    border: 1px solid var(--line);
    background: var(--surface-2);
    color: var(--fg);
    overflow-wrap: anywhere;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 2px;
  }
  .tag {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    padding: 1px 7px;
    border-radius: var(--r-pill);
    background: var(--chip);
  }
  .tag.resale {
    background: var(--resale);
    color: var(--resale-ink);
    font-weight: 700;
  }
  .tag.soldout {
    background: var(--soldout);
    color: var(--surface);
    font-weight: 700;
  }
  .tag.free {
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 700;
  }
</style>
