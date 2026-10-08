<script lang="ts">
  import { plural } from '../lib/format';
  import { app } from '../lib/store.svelte';

  let { ids }: { ids: string[] } = $props();

  const rows = $derived(
    ids.map((id) => {
      const pin = app.pins.find((p) => p.venue.id === id);
      return { id, name: pin?.venue.name ?? id, count: pin?.matched ?? 0, total: pin?.count ?? 0 };
    }),
  );
</script>

<ul class="chooser">
  {#each rows as r (r.id)}
    <li>
      <button onclick={() => app.openVenue(r.id)}>
        <span class="name">{r.name}</span>
        <span class="count tnum">{plural(r.count, 'party', 'parties')}</span>
      </button>
    </li>
  {/each}
</ul>

<style>
  .chooser {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  button {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    min-height: 56px;
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
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 20px;
    text-transform: uppercase;
  }
  .count {
    color: var(--muted);
    white-space: nowrap;
  }
</style>
