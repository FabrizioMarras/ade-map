<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    SPEEDS,
    T_MAX,
    T_MIN,
    T_STEP,
    computeState,
    drawHistogram,
    formatT,
    isInRange,
    toMinutes,
    type PulseEvent,
  } from '../lib/pulse';
  import { app } from '../lib/store.svelte';
  import Icon from './Icon.svelte';

  interface Props {
    events: PulseEvent[];
    bins: number[];
    /** Rendered height, so the map can keep lit venues clear of the deck. */
    height?: number;
  }

  let { events, bins, height = $bindable(0) }: Props = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  let width = $state(0);
  let playing = $state(false);
  let speed = $state<number>(30);
  let frame = 0;
  let last = 0;

  const venueCount = $derived(app.data?.venues.length ?? 0);
  const st = $derived(computeState(events, venueCount, app.pulseT));
  const [day, time] = $derived(formatT(app.pulseT).split(' · '));
  const nowAvailable = $derived(isInRange(app.now));
  const DAY_LABELS = ['Wed 21', 'Thu 22', 'Fri 23', 'Sat 24', 'Sun 25', 'Mon'];

  $effect(() => {
    void width;
    void bins;
    if (canvas)
      drawHistogram(canvas, bins, {
        t: app.pulseT,
        dim: 'rgba(11,11,13,.55)',
        background: 'rgba(255,255,255,.06)',
      });
  });

  function tick(ts: number) {
    if (!playing) return;
    const dt = Math.min(0.25, (ts - last) / 1000);
    last = ts;
    const t = app.pulseT + speed * dt;
    if (t >= T_MAX) {
      app.setPulseT(T_MAX, false);
      return setPlaying(false);
    }
    app.setPulseT(t, false);
    frame = requestAnimationFrame(tick);
  }

  function setPlaying(p: boolean) {
    playing = p;
    cancelAnimationFrame(frame);
    if (p) {
      if (app.pulseT >= T_MAX) app.setPulseT(T_MIN, false);
      last = performance.now();
      frame = requestAnimationFrame(tick);
    } else {
      // Snap to the slider grid and record the time in the URL once playback stops.
      app.setPulseT(Math.round(app.pulseT / T_STEP) * T_STEP);
    }
  }

  onDestroy(() => cancelAnimationFrame(frame));
</script>

<section class="deck" bind:clientHeight={height} aria-label="Festival pulse timeline">
  <div class="inner">
    <button class="exit" aria-label="Exit Pulse" title="Exit Pulse" onclick={() => app.exitPulse()}>
      <Icon name="close" size={18} />
    </button>
    <div class="readout">
      <div class="clock tnum" aria-live="off">
        {day}<span class="visually-hidden">, </span><small>{time}</small>
      </div>
      <div class="stats tnum" role="status">
        <b>{st.nLive}</b>
        {st.nLive === 1 ? 'party' : 'parties'} live at <b>{st.nVenues}</b>
        {st.nVenues === 1 ? 'venue' : 'venues'}
      </div>
    </div>

    <div class="track" bind:clientWidth={width}>
      <canvas bind:this={canvas} aria-hidden="true"></canvas>
      <input
        type="range"
        min={T_MIN}
        max={T_MAX}
        step={T_STEP}
        value={Math.round(app.pulseT)}
        aria-label="Festival time"
        aria-valuetext={formatT(Math.round(app.pulseT))}
        oninput={(e) => {
          if (playing) setPlaying(false);
          app.setPulseT(+e.currentTarget.value, false);
        }}
        onchange={(e) => app.setPulseT(+e.currentTarget.value)}
      />
    </div>
    <div class="days" aria-hidden="true">
      {#each DAY_LABELS as d (d)}<span>{d}</span>{/each}
    </div>

    <div class="controls">
      <button class="primary" aria-pressed={playing} onclick={() => setPlaying(!playing)}>
        {playing ? '❚❚ Pause' : '▶ Play'}
      </button>
      <span class="speed" role="group" aria-label="Playback speed (festival minutes per second)">
        {#each SPEEDS as s (s)}
          <button aria-pressed={speed === s} aria-label="{s} minutes per second" onclick={() => (speed = s)}
            >{s}</button
          >
        {/each}
        <span class="unit" aria-hidden="true">min/s</span>
      </span>
      <button
        disabled={!nowAvailable}
        title={nowAvailable ? 'Jump to the current time' : 'Available during ADE (21–26 Oct)'}
        onclick={() => {
          setPlaying(false);
          app.setPulseT(toMinutes(app.now));
        }}>Now</button
      >
    </div>
  </div>
</section>

<style>
  /* Night palette by design, whatever the app theme (as in the prototype). */
  .deck {
    --deck-fg: #f2f2ef;
    --deck-muted: #a3a39c;
    --deck-live: #ffb000;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 16;
    padding: 28px 14px calc(12px + var(--safe-bottom));
    background: linear-gradient(to top, rgba(11, 11, 13, 0.97), rgba(11, 11, 13, 0.9) 75%, transparent);
    color: var(--deck-fg);
  }
  .inner {
    max-width: 900px;
    margin: 0 auto;
  }
  .readout {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 4px 12px;
    flex-wrap: wrap;
  }
  .clock {
    font: 700 30px/1 var(--font-display);
    letter-spacing: 0.01em;
  }
  .clock small {
    font-size: 18px;
    color: var(--deck-muted);
    margin-left: 8px;
    font-weight: 600;
  }
  .stats {
    color: var(--deck-muted);
    font-size: 14px;
  }
  .stats b {
    color: var(--deck-live);
    font-weight: 700;
  }
  .track {
    position: relative;
    height: 56px;
    margin: 8px 0 2px;
  }
  .track canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    border-radius: 4px;
  }
  .track input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    background: transparent;
    -webkit-appearance: none;
    appearance: none;
    cursor: pointer;
    touch-action: pan-y;
  }
  .track input::-webkit-slider-runnable-track {
    height: 100%;
    background: transparent;
  }
  .track input::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 4px;
    height: 56px;
    border-radius: 2px;
    background: var(--accent);
    box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.6);
  }
  .track input::-moz-range-track {
    height: 100%;
    background: transparent;
  }
  .track input::-moz-range-thumb {
    width: 4px;
    height: 56px;
    border: 0;
    border-radius: 2px;
    background: var(--accent);
  }
  .track input:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .days {
    display: flex;
    justify-content: space-between;
    font: 600 12px/1 var(--font-display);
    letter-spacing: 0.06em;
    color: var(--deck-muted);
    text-transform: uppercase;
    padding: 0 2px;
  }
  .controls {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 10px;
    flex-wrap: wrap;
  }
  button {
    font: 600 14px var(--font-body);
    color: var(--deck-fg);
    background: #1d1d23;
    border: 1px solid #34343c;
    border-radius: 8px;
    padding: 0 12px;
    min-height: var(--tap);
  }
  button.primary {
    background: var(--accent);
    color: #111;
    border-color: var(--accent);
    min-width: 92px;
  }
  button:disabled {
    color: var(--deck-muted);
    cursor: not-allowed;
  }
  .speed {
    display: inline-flex;
    gap: 4px;
  }
  .speed button[aria-pressed='true'] {
    border-color: var(--accent);
    color: var(--accent);
  }
  .speed button {
    min-width: 44px;
  }
  .unit {
    align-self: center;
    margin-left: 2px;
    font-size: 13px;
    color: var(--deck-muted);
  }
  .inner {
    position: relative;
  }
  .exit {
    position: absolute;
    top: -40px;
    right: 0;
    display: grid;
    place-items: center;
    width: var(--tap);
    padding: 0;
    border-radius: 999px;
  }
</style>
