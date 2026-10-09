<script lang="ts">
  import { FACET_LABELS } from '../lib/facets';
  import { cleanDescription, icsUrl } from '../lib/format';
  import { directionsUrls } from '../lib/geo';
  import { canShare, eventLink } from '../lib/share';
  import { sellsTickets, ticketswapUrl } from '../lib/ticketswap';
  import { app } from '../lib/store.svelte';
  import { status, statusLabel, timeRange } from '../lib/time';
  import type { AdeEvent, FacetKey } from '../lib/types';
  import Icon from './Icon.svelte';
  import Star from './Star.svelte';

  interface Props {
    event: AdeEvent;
    onvenue: (venueId: string) => void;
  }

  let { event, onvenue }: Props = $props();

  let imageFailed = $state(false);
  let expanded = $state(false);
  let descEl: HTMLParagraphElement | undefined = $state();
  let clamped = $state(false);

  const st = $derived(status(event, app.now));
  const resaleUrl = $derived(ticketswapUrl(event));
  const dirs = $derived(directionsUrls(event.venue.lat, event.venue.lng, event.venue.name));
  const description = $derived(cleanDescription(app.descriptions?.get(event.id) ?? event.description ?? ''));
  const tagGroups = $derived(
    (['genre', 'type', 'time', 'venueType', 'area', 'other'] as FacetKey[])
      .map((k) => ({ key: k, label: FACET_LABELS[k], tags: event.facets[k] }))
      .filter((g) => g.tags.length),
  );

  $effect(() => {
    void event.id;
    imageFailed = false;
    expanded = false;
  });

  $effect(() => {
    void description;
    if (descEl) clamped = descEl.scrollHeight > descEl.clientHeight + 2;
  });
</script>

<article class="detail">
  {#if event.image && !imageFailed}
    <div class="media">
      <img src={event.image} alt="" loading="lazy" decoding="async" onerror={() => (imageFailed = true)} />
    </div>
  {/if}

  <header>
    <div class="title-row">
      <h3 class="title">{event.title}</h3>
      <Star id={event.id} title={event.title} size={28} />
    </div>
    {#if event.subtitle}<p class="subtitle">{event.subtitle}</p>{/if}
    <p class="when tnum">{timeRange(event)}</p>
    <p class="status" data-status={st}>
      {#if event.soldOut}<span class="soldout">Sold out</span>&nbsp;·&nbsp;{/if}{statusLabel(event, app.now)}
    </p>
  </header>

  <button class="venue" onclick={() => onvenue(event.venueId)}>
    <Icon name="pin" />
    <span><strong>{event.venue.name}</strong><span class="addr">{event.venue.address}</span></span>
  </button>

  <div class="actions">
    {#if event.soldOut}
      <a class="btn primary" href={resaleUrl} target="_blank" rel="noopener"
        ><Icon name="ticket" />Check TicketSwap</a
      >
    {:else if event.ticketUrl}
      <a class="btn primary" href={event.ticketUrl} target="_blank" rel="noopener"
        ><Icon name="ticket" /><span class="label">{event.ticketText || 'Buy tickets'}</span></a
      >
    {/if}
    <a class="btn" href={event.url} target="_blank" rel="noopener"><Icon name="external" />ADE page</a>
    <a class="btn" href={icsUrl(event.id)}><Icon name="calendar" />Add to calendar</a>
    <a class="btn" href={dirs.google} target="_blank" rel="noopener"><Icon name="route" />Directions</a>
    <button class="btn" onclick={() => app.share(eventLink(event.id), event.title)}
      ><Icon name="share" />{canShare ? 'Share' : 'Copy link'}</button
    >
  </div>
  {#if event.soldOut}
    <p class="notice resale-note">Resale via TicketSwap · prices capped</p>
  {:else if sellsTickets(event)}
    <p class="notice resale-note">
      <a href={resaleUrl} target="_blank" rel="noopener">Resale on TicketSwap</a>
    </p>
  {/if}

  {#if event.lineup.length}
    <h4 class="section-title">Line-up</h4>
    <ul class="lineup">
      {#each event.lineup as a, i (i)}<li>{a}</li>{/each}
    </ul>
  {/if}

  {#if description}
    <h4 class="section-title">About</h4>
    <p class="desc" class:open={expanded} bind:this={descEl}>{description}</p>
    {#if clamped || expanded}
      <button class="more" onclick={() => (expanded = !expanded)}
        >{expanded ? 'Show less' : 'Read more'}</button
      >
    {/if}
  {/if}

  {#each tagGroups as g (g.key)}
    <h4 class="section-title">{g.label}</h4>
    <ul class="chips">
      {#each g.tags as t (t)}<li>{t}</li>{/each}
    </ul>
  {/each}
</article>

<style>
  .media {
    aspect-ratio: 16 / 9;
    background: var(--surface-2);
    overflow: hidden;
  }
  .media img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  header {
    padding: 14px 16px 4px;
  }
  .title-row {
    display: flex;
    gap: 4px;
    align-items: flex-start;
  }
  .title {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-family: var(--font-display);
    font-size: 30px;
    line-height: 1.02;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }
  .subtitle {
    margin: 6px 0 0;
    font-size: 17px;
    font-weight: 600;
  }
  .when {
    margin: 10px 0 0;
    font-size: 18px;
    font-weight: 700;
  }
  .status {
    margin: 2px 0 0;
    color: var(--muted);
  }
  .status[data-status='live'] {
    color: var(--live);
    font-weight: 700;
  }
  .soldout {
    font-weight: 700;
    color: var(--fg);
  }
  .venue {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    width: calc(100% - 32px);
    margin: 10px 16px 0;
    padding: 10px 12px;
    text-align: left;
    border: 1px solid var(--line);
    border-radius: var(--r-box);
    background: var(--surface-2);
  }
  .venue span {
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow-wrap: anywhere;
  }
  .addr {
    color: var(--muted);
    font-size: 14px;
  }
  .resale-note {
    margin: 0 16px 8px;
  }
  .resale-note a {
    color: var(--fg);
    font-weight: 600;
  }
  .lineup {
    list-style: none;
    margin: 0;
    padding: 0 16px;
    display: flex;
    flex-wrap: wrap;
    gap: 2px 14px;
    font-weight: 600;
  }
  .desc {
    margin: 0 16px;
    display: -webkit-box;
    -webkit-line-clamp: 5;
    line-clamp: 5;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .desc.open {
    display: block;
  }
  .more {
    margin: 4px 16px 0;
    padding: 8px 0;
    min-height: var(--tap);
    border: 0;
    background: none;
    font-weight: 700;
    text-decoration: underline;
  }
  .chips {
    list-style: none;
    margin: 0;
    padding: 0 16px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chips li {
    font-size: 14px;
    padding: 3px 10px;
    border-radius: var(--r-pill);
    background: var(--chip);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
