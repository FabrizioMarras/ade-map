<script lang="ts">
  import { app } from '../lib/store.svelte';
  import type { ThemePref } from '../lib/theme';
  import Icon from './Icon.svelte';

  /** The More items and the credits: in a sheet on phones, in the side panel on wide screens. */
  let { asOf }: { asOf: string } = $props();

  const NEXT: Record<ThemePref, ThemePref> = { light: 'dark', dark: 'auto', auto: 'light' };
  const themeValue = $derived(
    app.themePref === 'auto' ? `Auto (${app.theme} now)` : app.themePref === 'dark' ? 'Dark' : 'Light',
  );

  async function install() {
    const p = app.installPrompt;
    if (!p) return;
    app.installPrompt = null;
    await p.prompt();
  }
</script>

<div class="more-content">
  <a class="row" href="./insights/">
    <span class="ic"><Icon name="chart" /></span>
    <span class="lbl">Insights<small>The festival by hour, area and genre</small></span>
    <span class="val" aria-hidden="true">→</span>
  </a>
  <a class="row" href="./help/">
    <span class="ic"><Icon name="help" /></span>
    <span class="lbl">How to use the app<small>Pins, filters, My list, Plan B, Pulse</small></span>
    <span class="val" aria-hidden="true">→</span>
  </a>
  <button class="row" onclick={() => app.setTheme(NEXT[app.themePref])}>
    <span class="ic"><Icon name={app.theme === 'dark' ? 'moon' : 'sun'} /></span>
    <span class="lbl">Theme<small>Tap to switch: light, dark or auto</small></span>
    <span class="val">{themeValue}</span>
  </button>
  {#if app.installPrompt}
    <button class="row" onclick={install}>
      <span class="ic"><Icon name="phone" /></span>
      <span class="lbl">Install the app<small>Full screen, works offline</small></span>
      <span class="val" aria-hidden="true">→</span>
    </button>
  {/if}
  <div class="row static">
    <span class="ic"><Icon name="info" /></span>
    <span class="lbl"
      >About<small
        >{#if app.data}{app.data.events.length.toLocaleString('en-GB')} festival parties at {app.data.venues
            .length} venues ·
        {/if}Programme as of {asOf} · unofficial, not affiliated with Amsterdam Dance Event</small
      ></span
    >
  </div>
  <div class="credits">
    <p>Programme updated automatically from the ADE site</p>
    <p>
      Data © Amsterdam Dance Event (personal planning only) · Geocoding: PDOK Locatieserver · Map data ©
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>
      contributors · Tiles:
      <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>
    </p>
    <p class="copyright">
      © {new Date().getFullYear()} FM Consulting ·
      <a href="https://fabriziomarras.com" target="_blank" rel="noopener">fabriziomarras.com</a>
    </p>
  </div>
</div>

<style>
  .row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 56px;
    padding: 6px 4px;
    border: 0;
    border-top: 1px solid var(--line);
    background: none;
    color: var(--fg);
    text-align: left;
    text-decoration: none;
    font: inherit;
  }
  .row:first-child {
    border-top: 0;
  }
  .row:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: -3px;
  }
  .ic {
    flex: none;
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border-radius: var(--r-box);
    background: var(--surface-2);
  }
  .lbl {
    flex: 1;
    min-width: 0;
    font-weight: 600;
  }
  .lbl small {
    display: block;
    font-weight: 400;
    font-size: 13px;
    color: var(--muted);
  }
  .val {
    flex: none;
    font-size: 14px;
    color: var(--muted);
  }
  .credits {
    margin-top: 4px;
    padding: 12px 4px 0;
    border-top: 1px solid var(--line);
    font-size: 13px;
    color: var(--muted);
  }
  .credits p {
    margin: 0 0 6px;
  }
  .credits .copyright {
    margin-top: 10px;
    color: var(--fg);
    font-weight: 600;
  }
</style>
