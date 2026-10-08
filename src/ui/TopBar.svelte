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

<header class="top" class:wide={app.wide && !app.pulseOn}>
  {#if app.pulseOn}
    <!-- Pulse mode: search, filters and day chips make no sense here; explain the map instead. -->
    <div class="pulse-card">
      <h2>Festival pulse</h2>
      <p>
        Drag the timeline or press play. Every dot is a venue: it <b>lights up</b> when a party starts, grows
        with the number of parties running, and <b>fades</b> when they end. Tap a lit venue to see what's on.
      </p>
      <div class="legend" aria-label="Legend">
        <span><i class="dot-live"></i>live now</span>
        <span><i class="dot-soon"></i>starting within the hour</span>
        <span><i class="dot-idle"></i>quiet</span>
      </div>
    </div>
  {:else}
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
            if (app.planB) app.closePlanB();
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
        <button
          class="now"
          aria-pressed={app.nowMode}
          onclick={() => {
            app.closePlanB();
            app.setNowMode(!app.nowMode);
          }}
        >
          <span class="dot"></span>Now
        </button>
      {/if}
      <DayChips />
    </div>
  {/if}
</header>

<style>
  .top {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 15;
    /* 22px: room for the brand badge in the top-right corner (Brand.svelte). */
    padding: calc(var(--safe-top) + 22px) 10px 0;
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
  .pulse-card {
    pointer-events: auto;
    max-width: 400px;
    padding: 10px 14px;
    border-radius: 10px;
    background: rgba(16, 16, 20, 0.88);
    backdrop-filter: blur(8px);
    border: 1px solid #2a2a31;
    color: #f2f2ef;
  }
  .pulse-card h2 {
    margin: 0 0 4px;
    font: 700 22px/1 var(--font-display);
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }
  .pulse-card p {
    margin: 0;
    font-size: 13.5px;
    color: #b4b4ad;
  }
  .pulse-card b {
    color: #f2f2ef;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin-top: 8px;
    font-size: 12.5px;
    color: #b4b4ad;
  }
  .legend span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .legend i {
    display: inline-block;
    border-radius: 50%;
  }
  .dot-live {
    width: 10px;
    height: 10px;
    background: #ffb000;
    box-shadow: 0 0 8px #ffb000;
  }
  .dot-soon {
    width: 9px;
    height: 9px;
    border: 2px solid #6ad1ff;
    box-sizing: border-box;
  }
  .dot-idle {
    width: 8px;
    height: 8px;
    background: #4a4a52;
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
