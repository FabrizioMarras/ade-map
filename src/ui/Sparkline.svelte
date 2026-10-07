<script lang="ts">
  import { drawHistogram, isInRange, toMinutes } from '../lib/pulse';
  import { app } from '../lib/store.svelte';

  let { bins }: { bins: number[] } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  let width = $state(0);
  const nowT = $derived(isInRange(app.now) ? toMinutes(app.now) : undefined);

  $effect(() => {
    void width;
    void app.theme; // marker colour follows the theme
    if (canvas)
      drawHistogram(canvas, bins, {
        t: nowT,
        dim: 'rgba(127,127,127,.45)',
        marker: nowT !== undefined ? getComputedStyle(canvas).color : undefined,
        separators: 'rgba(127,127,127,.35)',
      });
  });
</script>

<!-- Thin live-parties sparkline for the whole festival; tapping opens Pulse at the current time. -->
<button
  class="spark"
  bind:clientWidth={width}
  onclick={() => app.enterPulse()}
  aria-label="Open the festival pulse: parties live across ADE week"
  title="Festival pulse"
>
  <span class="label">Pulse</span>
  <canvas bind:this={canvas} aria-hidden="true"></canvas>
</button>

<style>
  .spark {
    display: flex;
    align-items: center;
    gap: 8px;
    width: calc(100% - 24px);
    height: 24px;
    margin: 0 12px 2px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--fg);
  }
  .label {
    flex: none;
    font: 700 12px/1 var(--font-display);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  canvas {
    flex: 1;
    min-width: 0;
    height: 18px;
    display: block;
    border-radius: 3px;
  }
  .spark:hover .label {
    color: var(--fg);
  }
</style>
