<script lang="ts">
  import type { DayScope } from '../lib/hash';
  import { app } from '../lib/store.svelte';
  import { DAYS } from '../lib/time';

  const chips = $derived<{ key: DayScope; label: string; count: number }[]>([
    ...DAYS.map((d) => ({
      key: d.key,
      label: d.short,
      count: app.data?.eventsByDay.get(d.key)?.length ?? 0,
    })),
    { key: 'all', label: 'All', count: app.data?.events.length ?? 0 },
  ]);
</script>

<div class="days" role="group" aria-label="Day">
  {#each chips as c (c.key)}
    <button
      class="chip"
      aria-pressed={!app.nowMode && app.day === c.key}
      onclick={() => {
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
