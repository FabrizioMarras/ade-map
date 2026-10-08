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
      class="chip"
      class:fav={c.key === 'fav'}
      aria-pressed={!app.nowMode && app.day === c.key}
      aria-label={c.key === 'fav' ? `My list (${app.favs.size})` : undefined}
      title={c.key === 'fav' ? 'My list' : undefined}
      onclick={() => {
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
  .chip {
    flex: none;
    min-height: 36px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--surface);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 17px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    box-shadow: 0 1px 4px rgb(0 0 0 / 0.12);
  }
  .chip.fav {
    min-width: 44px;
    padding: 0 10px;
  }
  .n {
    margin-left: 5px;
    font-size: 15px;
  }
  .chip[aria-pressed='true'] {
    background: var(--accent);
    color: var(--accent-ink);
    border-color: var(--accent);
  }
  /* Bigger hit area without a bigger chip. */
  .chip {
    position: relative;
  }
  .chip::after {
    content: '';
    position: absolute;
    inset: -4px -2px;
  }
</style>
