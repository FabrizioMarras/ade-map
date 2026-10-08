<script lang="ts">
  import { FACET_LABELS, TIME_LABELS } from '../lib/facets';
  import {
    FILTER_FACETS,
    activeFilterCount,
    facetCounts,
    type FilterFacet,
    type SoldOutMode,
  } from '../lib/filter';
  import { plural } from '../lib/format';
  import { app } from '../lib/store.svelte';
  import Icon from './Icon.svelte';

  let { open = $bindable(false) }: { open: boolean } = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  let showAll = $state<Record<string, boolean>>({});
  const LIMIT = 16;
  const SOLD_OUT_OPTIONS: [SoldOutMode, string][] = [
    ['all', 'Show all'],
    ['hide', 'Hide sold out'],
    ['resale', 'Sold out, check TicketSwap'],
  ];

  const counts = $derived(open ? facetCounts(app.scopeEvents, app.filters) : null);
  const order: FilterFacet[] = ['time', 'genre', 'type', 'venueType', 'area'];

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });

  function options(k: FilterFacet): [string, number][] {
    const m = counts?.[k] ?? new Map<string, number>();
    // Keep selected tags visible even when their count dropped to zero.
    for (const t of app.filters[k]) if (!m.has(t)) m.set(t, 0);
    const list = [...m.entries()];
    if (k === 'time') {
      const keys = Object.keys(TIME_LABELS);
      return list.sort((a, b) => keys.indexOf(a[0]) - keys.indexOf(b[0]));
    }
    return list.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }

  function toggle(k: FilterFacet, tag: string) {
    const cur = app.filters[k];
    app.filters[k] = cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag];
  }
  /** Chip labels longer than this may wrap on a 360px phone, so they are drawn as boxes. */
  const WRAP_AT = 30;
</script>

<dialog bind:this={dialog} onclose={() => (open = false)} aria-labelledby="filters-title">
  <div class="head">
    <h2 id="filters-title">Filters</h2>
    <button class="icon-btn" aria-label="Close filters" onclick={() => (open = false)}
      ><Icon name="close" /></button
    >
  </div>

  <div class="body">
    <div class="toggles">
      <label class="switch">
        <input type="checkbox" bind:checked={app.filters.free} />
        <span>Free events only</span>
      </label>
    </div>

    <fieldset>
      <legend>Sold-out parties</legend>
      <div class="chips" role="radiogroup" aria-label="Sold-out parties">
        {#each SOLD_OUT_OPTIONS as [mode, label] (mode)}
          <button
            class="chip"
            class:wrap={label.length > WRAP_AT}
            role="radio"
            aria-checked={app.filters.soldOut === mode}
            onclick={() => (app.filters.soldOut = mode)}>{label}</button
          >
        {/each}
      </div>
    </fieldset>

    {#each order.filter((k) => FILTER_FACETS.includes(k)) as k (k)}
      {@const opts = options(k)}
      {#if opts.length}
        <fieldset>
          <legend>{FACET_LABELS[k]}</legend>
          <div class="chips">
            {#each showAll[k] ? opts : opts.slice(0, LIMIT) as [tag, n] (tag)}
              {@const label = k === 'time' ? TIME_LABELS[tag] : tag}
              <button
                class="chip"
                class:wrap={label.length > WRAP_AT}
                aria-pressed={app.filters[k].includes(tag)}
                disabled={n === 0 && !app.filters[k].includes(tag)}
                onclick={() => toggle(k, tag)}
              >
                {label}
                <span class="n tnum">{n}</span>
              </button>
            {/each}
          </div>
          {#if opts.length > LIMIT}
            <button class="more" onclick={() => (showAll[k] = !showAll[k])}>
              {showAll[k] ? 'Show fewer' : `Show all ${opts.length}`}
            </button>
          {/if}
        </fieldset>
      {/if}
    {/each}
  </div>

  <div class="foot">
    <button class="btn" disabled={!activeFilterCount(app.filters)} onclick={() => app.clearFilters()}
      >Clear all</button
    >
    <button class="btn primary" onclick={() => (open = false)}>
      Show {plural(app.results.length, 'party', 'parties')}
    </button>
  </div>
</dialog>

<style>
  dialog {
    border: 0;
    padding: 0;
    width: 100%;
    max-width: 560px;
    height: 100%;
    max-height: 100%;
    margin: 0 auto;
    background: var(--surface);
    color: var(--fg);
    display: none;
    flex-direction: column;
  }
  dialog[open] {
    display: flex;
  }
  dialog::backdrop {
    background: rgb(0 0 0 / 0.5);
  }
  @media (min-width: 900px) {
    dialog {
      height: auto;
      max-height: 85vh;
      margin: auto;
      border-radius: var(--r-box);
    }
  }
  .head {
    display: flex;
    align-items: center;
    padding: calc(var(--safe-top) + 6px) 8px 6px 16px;
    border-bottom: 1px solid var(--line);
  }
  h2 {
    flex: 1;
    margin: 0;
    font-family: var(--font-display);
    font-size: 26px;
    text-transform: uppercase;
  }
  .body {
    flex: 1;
    overflow-y: auto;
    padding: 8px 16px 16px;
  }
  .toggles {
    display: flex;
    flex-direction: column;
  }
  .switch {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: var(--tap);
    font-weight: 600;
  }
  .switch input {
    width: 22px;
    height: 22px;
    accent-color: var(--fg);
  }
  fieldset {
    border: 0;
    margin: 12px 0 0;
    padding: 0;
  }
  legend {
    padding: 0 0 8px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    min-height: 40px;
    padding: 0 12px;
    border-radius: var(--r-pill);
    border: 1px solid var(--line);
    background: var(--surface);
    font-size: 15px;
    white-space: nowrap;
  }
  /* A label long enough to wrap on a phone is a box, never a two-line pill. */
  .chip.wrap {
    border-radius: var(--r-box);
    padding: 8px 12px;
    white-space: normal;
    overflow-wrap: anywhere;
    text-align: left;
  }
  .chip[aria-pressed='true'],
  .chip[aria-checked='true'] {
    background: var(--fg);
    color: var(--surface);
    border-color: var(--fg);
  }
  .chip:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .n {
    font-size: 13px;
    opacity: 0.75;
  }
  .more {
    margin-top: 6px;
    min-height: var(--tap);
    border: 0;
    background: none;
    font-weight: 700;
    text-decoration: underline;
    padding: 0;
  }
  .foot {
    display: flex;
    gap: 8px;
    justify-content: space-between;
    padding: 10px 16px calc(var(--safe-bottom) + 10px);
    border-top: 1px solid var(--line);
  }
  .foot .primary {
    flex: 1;
    justify-content: center;
  }
</style>
