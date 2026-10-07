<script lang="ts">
  import { inValidBounds, type LngLat } from '../lib/geo';
  import { app } from '../lib/store.svelte';
  import Icon from './Icon.svelte';

  interface Props {
    bottom: number;
    onlocate: (p: LngLat) => void;
    onfit: () => void;
    onmessage: (msg: string) => void;
  }

  let { bottom, onlocate, onfit, onmessage }: Props = $props();
  let locating = $state(false);

  function locate() {
    if (!('geolocation' in navigator)) return onmessage('Location is not available on this device');
    locating = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        locating = false;
        const { latitude: lat, longitude: lng } = pos.coords;
        if (!inValidBounds(lat, lng)) return onmessage('You seem to be outside Amsterdam');
        onlocate([lng, lat]);
      },
      (err) => {
        locating = false;
        onmessage(
          err.code === err.PERMISSION_DENIED ? 'Location permission denied' : 'Could not find your location',
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }

  function toggleDraw() {
    app.drawMode = app.drawMode ? null : 'lasso';
  }
</script>

{#if app.drawMode && !app.pulseOn}
  <div class="hint" role="status">
    <span>Draw around the area you want</span>
    <div class="seg" role="group" aria-label="Shape">
      <button aria-pressed={app.drawMode === 'lasso'} onclick={() => (app.drawMode = 'lasso')}>
        <Icon name="lasso" size={18} />Lasso
      </button>
      <button aria-pressed={app.drawMode === 'box'} onclick={() => (app.drawMode = 'box')}>
        <Icon name="box" size={18} />Box
      </button>
    </div>
  </div>
{/if}

<div class="stack" class:wide={app.wide} style:bottom="{bottom + 12}px">
  <button
    class="ctl"
    class:on={app.pulseOn}
    aria-pressed={app.pulseOn}
    aria-label={app.pulseOn ? 'Exit Pulse' : 'Pulse: see the festival over time'}
    title="Pulse"
    onclick={() => (app.pulseOn ? app.exitPulse() : app.enterPulse())}
  >
    <Icon name="pulse" />
  </button>
  {#if !app.pulseOn}
    <button
      class="ctl"
      class:on={!!app.drawMode}
      aria-pressed={!!app.drawMode}
      aria-label={app.drawMode ? 'Cancel area selection' : 'Select area'}
      title="Select area (or shift + drag)"
      onclick={toggleDraw}
    >
      <Icon name={app.drawMode ? 'close' : 'lasso'} />
    </button>
  {/if}
  <button class="ctl" aria-label="Locate me" aria-busy={locating} onclick={locate}>
    <Icon name="locate" />
  </button>
  {#if !app.pulseOn}
    <button class="ctl" aria-label="Zoom to fit results" onclick={onfit}>
      <Icon name="fit" />
    </button>
  {/if}
</div>

<style>
  .stack {
    position: fixed;
    right: 12px;
    z-index: 12;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: bottom 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .ctl {
    width: var(--tap);
    height: var(--tap);
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 12px;
    background: var(--surface);
    box-shadow: var(--shadow);
  }
  .ctl.on {
    background: var(--accent);
    color: var(--accent-ink);
  }
  .ctl[aria-busy='true'] {
    opacity: 0.6;
  }
  .hint {
    position: fixed;
    left: 50%;
    top: calc(var(--safe-top) + 124px);
    transform: translateX(-50%);
    z-index: 14;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: var(--radius);
    background: var(--fg);
    color: var(--surface);
    font-weight: 700;
    box-shadow: var(--shadow);
    white-space: nowrap;
  }
  .seg {
    display: flex;
    gap: 4px;
  }
  .seg button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid currentColor;
    background: none;
    color: inherit;
    font-weight: 600;
  }
  .seg button[aria-pressed='true'] {
    background: var(--accent);
    color: var(--accent-ink);
    border-color: var(--accent);
  }
</style>
