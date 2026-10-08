<script lang="ts">
  import { plural } from '../lib/format';
  import { app } from '../lib/store.svelte';

  const rows = $derived(
    app.pins
      .filter((p) => p.matched > 0)
      .sort((a, b) => b.matched - a.matched || a.venue.name.localeCompare(b.venue.name)),
  );
</script>

<ul class="venues">
  {#each rows as p (p.venue.id)}
    <li>
      <button onclick={() => app.openVenue(p.venue.id)}>
        <span class="name">{p.venue.name}<span class="addr">{p.venue.address}</span></span>
        <span class="count tnum">
          {#if p.live}<span class="live">Live</span>{/if}
          {plural(p.matched, 'party', 'parties')}
        </span>
      </button>
    </li>
  {:else}
    <li class="empty">No venues match.</li>
  {/each}
</ul>

<style>
  .venues {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    content-visibility: auto;
    contain-intrinsic-size: auto 64px;
  }
  button {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    min-height: 60px;
    padding: 8px 16px;
    border: 0;
    border-bottom: 1px solid var(--line);
    background: none;
    text-align: left;
  }
  button:hover {
    background: var(--surface-2);
  }
  .name {
    min-width: 0;
    overflow-wrap: anywhere;
    display: flex;
    flex-direction: column;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 19px;
    text-transform: uppercase;
    line-height: 1.15;
  }
  .addr {
    font-family: var(--font-body);
    font-weight: 400;
    font-size: 14px;
    text-transform: none;
    color: var(--muted);
  }
  .count {
    white-space: nowrap;
    color: var(--muted);
    font-size: 14px;
  }
  .live {
    color: var(--live);
    font-weight: 700;
    text-transform: uppercase;
    font-size: 12px;
    margin-right: 6px;
  }
</style>
