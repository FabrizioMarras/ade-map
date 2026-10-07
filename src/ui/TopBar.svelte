<script lang="ts">
  import { activeFilterCount } from '../lib/filter';
  import { app } from '../lib/store.svelte';
  import { isFestivalTime } from '../lib/time';
  import DayChips from './DayChips.svelte';
  import Icon from './Icon.svelte';

  let { onfilters }: { onfilters: () => void } = $props();

  const nFilters = $derived(activeFilterCount(app.filters));
  const festival = $derived(isFestivalTime(app.now));
  let input: HTMLInputElement | undefined = $state();
  /** The query when the box gained focus, while the old search is still to be replaced. */
  let focusValue: string | null = null;

  /** Select the previous search so typing replaces it — but never text typed since the tap. */
  function selectOld() {
    if (input && focusValue && input.value === focusValue) input.setSelectionRange(0, input.value.length);
  }

  function cycleTheme() {
    app.setTheme(app.theme === 'dark' ? 'light' : 'dark');
  }
</script>

<header class="top" class:wide={app.wide}>
  <div class="row">
    <label class="search">
      <Icon name="search" size={18} />
      <span class="visually-hidden">Search parties, venues and artists</span>
      <input
        bind:this={input}
        type="search"
        placeholder="Party, venue or artist"
        autocomplete="off"
        enterkeyhint="search"
        bind:value={app.query}
        onkeydown={(e) => e.key === 'Enter' && input?.blur()}
        onfocus={() => {
          focusValue = input?.value ?? null;
          // Next frame too: iOS ignores selection changes made inside the focus event.
          selectOld();
          requestAnimationFrame(selectOld);
        }}
        onclick={() => {
          // The tap that focused the box moves the caret on release; select again.
          selectOld();
          focusValue = null;
        }}
        onblur={() => (focusValue = null)}
        oninput={() => {
          focusValue = null;
          if (app.selectedEventId || app.selectedVenueId || app.chooser) app.close();
        }}
      />
      {#if app.query}
        <button class="clear" aria-label="Clear search" onclick={() => ((app.query = ''), input?.focus())}>
          <Icon name="close" size={16} />
        </button>
      {/if}
    </label>
    <button class="round" aria-label="Filters{nFilters ? ` (${nFilters} active)` : ''}" onclick={onfilters}>
      <Icon name="filter" />
      {#if nFilters}<span class="badge">{nFilters}</span>{/if}
    </button>
    <button
      class="round"
      aria-label={app.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      onclick={cycleTheme}
    >
      <Icon name={app.theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  </div>
  <div class="row">
    {#if festival}
      <button class="now" aria-pressed={app.nowMode} onclick={() => app.setNowMode(!app.nowMode)}>
        <span class="dot"></span>Now
      </button>
    {/if}
    <DayChips />
  </div>
</header>

<style>
  .top {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 15;
    padding: calc(var(--safe-top) + 8px) 10px 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
  }
  .top.wide {
    left: 400px;
    max-width: 760px;
    padding-left: 12px;
  }
  .row {
    display: flex;
    gap: 6px;
    align-items: center;
    pointer-events: auto;
    min-width: 0;
  }
  .search {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    height: var(--tap);
    padding: 0 6px 0 14px;
    border-radius: 999px;
    background: var(--surface);
    box-shadow: var(--shadow);
    color: var(--muted);
  }
  .search:focus-within {
    outline: 3px solid var(--focus);
  }
  input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: none;
    outline: none;
    color: var(--fg);
    font-size: 16px; /* ≥16px avoids iOS zoom-on-focus */
  }
  input::-webkit-search-cancel-button {
    display: none;
  }
  input::placeholder {
    color: var(--muted);
  }
  .clear {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--fg);
  }
  .round {
    position: relative;
    flex: none;
    width: var(--tap);
    height: var(--tap);
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 999px;
    background: var(--surface);
    box-shadow: var(--shadow);
  }
  .badge {
    position: absolute;
    top: -2px;
    right: -2px;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 12px;
    font-weight: 700;
    line-height: 20px;
  }
  .now {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 36px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--surface);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 17px;
    text-transform: uppercase;
    box-shadow: 0 1px 4px rgb(0 0 0 / 0.12);
  }
  .now[aria-pressed='true'] {
    background: var(--live);
    border-color: var(--live);
    color: var(--surface);
  }
  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--live);
  }
  .now[aria-pressed='true'] .dot {
    background: var(--surface);
  }
</style>
