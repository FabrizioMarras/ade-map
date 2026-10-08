<script lang="ts">
  import type { DayScope } from '../lib/hash';
  import { app } from '../lib/store.svelte';
  import { DAYS } from '../lib/time';

  // My list first (compact "★ 3"), then the days, then All.
  const chips = $derived<{ key: DayScope; label: string }[]>([
    { key: 'fav', label: 'My list' },
    ...DAYS.map((d) => ({ key: d.key, label: d.short })),
    { key: 'all', label: 'All' },
  ]);

  let row: HTMLDivElement | undefined = $state();

  // Keep the selected chip in view (e.g. Sun 25 on a phone during the festival).
  $effect(() => {
    void app.day;
    void app.nowMode;
    const el = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!row || !el) return;
    const left = el.offsetLeft - row.offsetLeft;
    const right = left + el.offsetWidth;
    if (left < row.scrollLeft || right > row.scrollLeft + row.clientWidth) {
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      row.scrollTo({ left: Math.max(0, left - 24), behavior: reduced ? 'auto' : 'smooth' });
    }
  });
</script>

<div class="days" role="group" aria-label="Day" bind:this={row}>
  {#each chips as c (c.key)}
    <button
      class="day-chip"
      class:fav={c.key === 'fav'}
      aria-pressed={!app.nowMode && !app.sharedList && app.day === c.key}
      aria-label={c.key === 'fav' ? `My list (${app.favs.size})` : undefined}
      title={c.key === 'fav' ? 'My list' : undefined}
      onclick={() => {
        app.closePlanB();
        app.nowMode = false;
        app.setDay(c.key);
      }}
    >
      {#if c.key === 'fav'}
        <span aria-hidden="true"
          >★{#if app.favs.size}<span class="n tnum">{app.favs.size}</span>{/if}</span
        >
      {:else}
        {c.label}
      {/if}
    </button>
  {/each}
</div>

<style>
  .days {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    padding: 2px;
  }
  .days::-webkit-scrollbar {
    display: none;
  }
</style>
