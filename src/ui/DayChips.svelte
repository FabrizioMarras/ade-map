<script lang="ts">
  import type { DayScope } from '../lib/hash';
  import { app } from '../lib/store.svelte';
  import { DAYS } from '../lib/time';

  // The days, then All. (My list is a tab in the bottom navigation.)
  const chips: { key: DayScope; label: string }[] = [
    ...DAYS.map((d) => ({ key: d.key, label: d.short })),
    { key: 'all', label: 'All' },
  ];

  let row: HTMLDivElement | undefined = $state();

  /** Scroll the selected chip into view (e.g. Sun 25 on a phone during the festival). */
  function keepSelectedInView(smooth: boolean) {
    const el = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!row || !el) return;
    const left = el.offsetLeft - row.offsetLeft;
    const right = left + el.offsetWidth;
    if (left < row.scrollLeft || right > row.scrollLeft + row.clientWidth) {
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      row.scrollTo({ left: Math.max(0, left - 24), behavior: smooth && !reduced ? 'smooth' : 'auto' });
    }
  }

  // When the day changes.
  $effect(() => {
    void app.day;
    void app.nowMode;
    keepSelectedInView(true);
  });

  // And whenever the row or the chips change size: the first check can run before the row is
  // laid out on a slow device, and the web font arrives later and resizes the chips.
  $effect(() => {
    if (!row) return;
    const ro = new ResizeObserver(() => keepSelectedInView(false));
    ro.observe(row);
    for (const chip of row.children) ro.observe(chip);
    return () => ro.disconnect();
  });
</script>

<div class="days" role="group" aria-label="Day" bind:this={row}>
  {#each chips as c (c.key)}
    <button
      class="day-chip"
      aria-pressed={!app.nowMode && !app.sharedList && app.day === c.key}
      onclick={() => {
        app.closePlanB();
        app.nowMode = false;
        app.setDay(c.key);
      }}
    >
      {c.label}
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
