<script lang="ts">
  import { app } from '../lib/store.svelte';
  import Icon from './Icon.svelte';

  interface Props {
    /** `bar`: the phone's bottom tab bar; `row`: a compact row at the top of the side panel. */
    variant: 'bar' | 'row';
    /** Rendered height of the bar (incl. the safe-area inset), for the sheet and the map. */
    height?: number;
  }

  let { variant, height = $bindable(0) }: Props = $props();

  const all = [
    { key: 'map', label: 'Map', icon: 'map', run: () => app.showMap() },
    { key: 'parties', label: 'Parties', icon: 'list', run: () => app.showParties() },
    { key: 'fav', label: 'My list', icon: 'star', run: () => app.showMyList() },
    { key: 'more', label: 'More', icon: 'more', run: () => app.toggleMore() },
  ] as const;
  // The side panel on wide screens is always open: no Map tab there.
  const tabs = $derived(variant === 'row' ? all.filter((t) => t.key !== 'map') : all);
</script>

<nav class="tabs {variant}" aria-label="Main" bind:clientHeight={height}>
  {#each tabs as t (t.key)}
    <button
      class="tab"
      data-tab={t.key}
      aria-current={app.tab === t.key ? 'page' : undefined}
      aria-expanded={t.key === 'more' && variant === 'bar' ? app.moreOpen : undefined}
      aria-label={t.key === 'fav' && app.favs.size ? `My list (${app.favs.size})` : undefined}
      onclick={t.run}
    >
      <span class="ic">
        <Icon name={t.icon} size={22} filled={t.key === 'fav' && app.tab === 'fav'} />
        {#if t.key === 'fav' && app.favs.size}<span class="cnt tnum" aria-hidden="true">{app.favs.size}</span
          >{/if}
      </span>
      <span class="label">{t.label}</span>
    </button>
  {/each}
</nav>

<style>
  .tabs {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
    background: var(--surface);
  }
  .bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 22;
    height: calc(56px + var(--safe-bottom));
    padding-bottom: var(--safe-bottom);
    border-top: 1px solid var(--line);
  }
  .row {
    gap: 4px;
    padding: 0 8px 6px;
  }
  .tab {
    position: relative;
    min-width: 0;
    min-height: 44px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    border: 0;
    background: none;
    color: var(--muted);
    font: 700 12px/1 var(--font-display);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .row .tab {
    min-height: 52px;
    border-radius: var(--r-box);
  }
  .tab:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: -3px;
  }
  /* Active: an accent pill behind the icon (readable on both themes), label in full ink. */
  .ic {
    position: relative;
    display: grid;
    place-items: center;
    width: 52px;
    height: 28px;
    border-radius: var(--r-pill);
    transition: background-color 0.15s;
  }
  .tab[aria-current='page'] {
    color: var(--fg);
  }
  .tab[aria-current='page'] .ic {
    background: var(--accent);
    color: var(--accent-ink);
  }
  .cnt {
    position: absolute;
    top: -4px;
    left: calc(50% + 6px);
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    border-radius: var(--r-pill);
    border: 2px solid var(--surface);
    background: var(--fg);
    color: var(--surface);
    font: 700 11px/14px var(--font-display);
    text-align: center;
    box-sizing: border-box;
  }
  .label {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @media (prefers-reduced-motion: reduce) {
    .ic {
      transition: none;
    }
  }
</style>
