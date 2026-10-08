<script lang="ts">
  import type { FerryNote, Leg } from '../lib/nightplan';
  import { app } from '../lib/store.svelte';
  import { dayShort, hhmm, parseWall, shortRange } from '../lib/time';
  import type { AdeEvent } from '../lib/types';

  let { onopen }: { onopen: (e: AdeEvent) => void } = $props();

  const plan = $derived(app.nightPlan!);
  const stops = $derived(app.nightStops);
  const legs = $derived(app.nightLegs);
  const nightLabel = (night: string) => `${dayShort(parseWall(`${night} 12:00`))} night`;

  const GVB_F4 = 'https://reisinfo.gvb.nl/en/travel-information/line/GVB/906';
  const GVB_NIGHT = 'https://www.gvb.nl/en/travel-products/hour-and-day-tickets/gvb-night-bus-1-ride';

  const FERRY: Record<FerryNote, string> = {
    F4: 'Crosses the IJ: ferry F4 NDSM ↔ Centraal runs every 15–30 min until about 23:45.',
    'F3-late':
      'Crosses the IJ: ferry F4 to NDSM has stopped by now — take F3 Buiksloterweg ↔ Centraal (24 h, every 15–30 min at night) and walk or bike along the IJ.',
    F3: 'Crosses the IJ: ferry F3 Buiksloterweg ↔ Centraal runs 24 h (every few minutes by day, 15–30 min at night).',
  };

  /** "45 min", "1 h 30 min", "6 h" */
  const duration = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
  };
  const km = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);
  const travel = (l: Leg) =>
    `${l.minutes} min ${plan.mode === 'walk' ? 'walk' : 'by bike'} · ${km(l.metres)}`;
</script>

<div class="plan">
  <div class="controls">
    <div class="nights" role="group" aria-label="Night">
      {#each app.starredNights as n (n)}
        <button
          class="chip"
          aria-pressed={plan.night === n}
          onclick={() => app.nightPlan && (app.nightPlan = { ...app.nightPlan, night: n })}
          >{nightLabel(n)}</button
        >
      {/each}
    </div>
    <div class="modes" role="group" aria-label="Travel">
      <button
        class="chip"
        aria-pressed={plan.mode === 'walk'}
        onclick={() => app.nightPlan && (app.nightPlan = { ...app.nightPlan, mode: 'walk' })}>Walk</button
      >
      <button
        class="chip"
        aria-pressed={plan.mode === 'bike'}
        onclick={() => app.nightPlan && (app.nightPlan = { ...app.nightPlan, mode: 'bike' })}>Bike</button
      >
    </div>
  </div>

  {#if stops.length < 2}
    <p class="hint">
      Star at least two parties for {nightLabel(plan.night)} to plan a route between them.
    </p>
  {/if}

  <ol class="route">
    {#each stops as s, k (s.id)}
      <li class="stop">
        <span class="n" aria-hidden="true">{k + 1}</span>
        <button class="stop-main" onclick={() => onopen(s)}>
          <span class="time tnum">{dayShort(s.startMs)} · {shortRange(s)}</span>
          <span class="title">{s.title}</span>
          <span class="venue">{s.venue.name}</span>
        </button>
      </li>
      {#if legs[k]}
        {@const l = legs[k]}
        <li class="leg" class:bad={l.infeasible || l.clashMinutes}>
          <p class="how tnum">
            {travel(l)} · leave {hhmm(l.leave)}, arrive {hhmm(l.arrive)}
          </p>
          {#if l.clashMinutes}
            <p class="flag">⚠ Overlaps the next party by {duration(l.clashMinutes)}.</p>
          {/if}
          {#if l.infeasible}
            <p class="flag">✕ You'd arrive after {l.to.title} has ended.</p>
          {/if}
          {#if l.ferry}
            <p class="tip">
              ⛴ {FERRY[l.ferry]}
              <a href={GVB_F4} target="_blank" rel="noopener">GVB ferry times</a>
            </p>
          {/if}
          {#if l.nightBus}
            <p class="tip">
              🌙 After 00:30 trams stop; GVB night buses (N81–N93) run from Centraal.
              <a href={GVB_NIGHT} target="_blank" rel="noopener">Night bus</a>
            </p>
          {/if}
        </li>
      {/if}
    {/each}
  </ol>
  <p class="note">
    Straight-line distance × 1.25 at {plan.mode === 'walk' ? '80 m/min walking' : '250 m/min cycling'}; no
    live routing. You leave each party in time to reach the next as it starts.
  </p>
</div>

<style>
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    justify-content: space-between;
    padding: 10px 16px 4px;
  }
  .nights,
  .modes {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    min-height: 36px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--surface);
    font-weight: 600;
    font-size: 14px;
  }
  .chip[aria-pressed='true'] {
    background: var(--fg);
    color: var(--surface);
    border-color: var(--fg);
  }
  .hint,
  .note {
    margin: 8px 16px;
    font-size: 14px;
    color: var(--muted);
  }
  .route {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
  }
  .stop {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 8px 16px;
  }
  .n {
    flex: none;
    width: 28px;
    height: 28px;
    margin-top: 2px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--fg);
    color: var(--surface);
    font-weight: 700;
    font-size: 14px;
  }
  .stop-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0;
    border: 0;
    background: none;
    text-align: left;
    min-height: var(--tap);
  }
  .time {
    font-size: 14px;
    color: var(--muted);
  }
  .title {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 19px;
    line-height: 1.1;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }
  .venue {
    font-size: 15px;
    font-weight: 600;
  }
  .leg {
    margin: 0 16px 0 29px;
    padding: 4px 0 8px 22px;
    border-left: 2px dashed var(--line);
    font-size: 14px;
  }
  .leg.bad {
    border-left-color: var(--soldout);
  }
  .leg p {
    margin: 2px 0;
  }
  .how {
    color: var(--muted);
  }
  .flag {
    font-weight: 700;
  }
  .tip a {
    font-weight: 600;
  }
</style>
