<script lang="ts">
  import { directionsUrls } from '../lib/geo';
  import { plural } from '../lib/format';
  import { app } from '../lib/store.svelte';
  import { formatT, toMinutes } from '../lib/pulse';
  import { canShare, venueLink } from '../lib/share';
  import { festivalDay } from '../lib/time';
  import type { Venue } from '../lib/types';
  import EventCard from './EventCard.svelte';
  import Icon from './Icon.svelte';

  let { venue }: { venue: Venue } = $props();

  const all = $derived(app.data?.eventsByVenue.get(venue.id) ?? []);
  const matched = $derived(new Set(app.results.map((e) => e.id)));
  const inScope = $derived(
    app.day === 'all' || app.day === 'fav' ? all : all.filter((e) => e.day === app.day),
  );
  /** In Pulse mode: only the parties running at the Pulse clock time. */
  const pulseLive = $derived(
    app.pulseOn
      ? all.filter((e) => toMinutes(e.startMs) <= app.pulseT && app.pulseT < toMinutes(e.endMs))
      : [],
  );
  const shown = $derived(app.pulseOn ? pulseLive : inScope.filter((e) => matched.has(e.id)));
  const hidden = $derived(app.pulseOn ? 0 : inScope.length - shown.length);
  const otherDays = $derived(
    app.pulseOn || app.day === 'all' || app.day === 'fav' ? [] : all.filter((e) => e.day !== app.day),
  );
  const dirs = $derived(directionsUrls(venue.lat, venue.lng, venue.name));
  const dayLabel = $derived(festivalDay(app.day)?.short ?? 'all days');
</script>

<div class="venue">
  <p class="address">{venue.address}</p>
  <div class="actions">
    <a class="btn" href={dirs.google} target="_blank" rel="noopener"><Icon name="route" />Google Maps</a>
    <a class="btn" href={dirs.apple} target="_blank" rel="noopener"><Icon name="route" />Apple Maps</a>
    <a class="btn" href={venue.url} target="_blank" rel="noopener"><Icon name="external" />ADE venue page</a>
    <button class="btn" onclick={() => app.share(venueLink(venue.id), venue.name)}
      ><Icon name="share" />{canShare ? 'Share' : 'Copy link'}</button
    >
  </div>

  {#if app.pulseOn}
    <h3 class="section-title">
      {plural(shown.length, 'party', 'parties')} live · {formatT(Math.round(app.pulseT))}
    </h3>
  {:else}
    <h3 class="section-title">{plural(shown.length, 'party', 'parties')} · {dayLabel}</h3>
  {/if}
  {#each shown as e (e.id)}
    <EventCard event={e} showDay={app.pulseOn || app.day === 'all' || app.day === 'fav'} />
  {:else}
    <p class="empty">
      {#if app.pulseOn}Nothing running here at {formatT(Math.round(app.pulseT))}.{:else}No parties here on {dayLabel}{hidden
          ? ' that match your filters'
          : ''}.{/if}
    </p>
  {/each}
  {#if hidden && shown.length}
    <p class="hint">{plural(hidden, 'more party', 'more parties')} hidden by filters or search.</p>
  {/if}

  {#if otherDays.length}
    <h3 class="section-title">Other days</h3>
    {#each otherDays as e (e.id)}
      <EventCard event={e} showDay />
    {/each}
  {/if}
</div>

<style>
  .address {
    margin: 10px 16px 0;
    color: var(--muted);
  }
  .hint {
    margin: 8px 16px;
    font-size: 14px;
    color: var(--muted);
  }
</style>
