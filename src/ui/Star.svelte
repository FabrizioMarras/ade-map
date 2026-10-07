<script lang="ts">
  import { app } from '../lib/store.svelte';
  import Icon from './Icon.svelte';

  let { id, title, size = 22 }: { id: number; title: string; size?: number } = $props();
  const on = $derived(app.favs.has(id));
</script>

<button
  class="star"
  class:on
  aria-pressed={on}
  aria-label={on ? `Remove ${title} from my list` : `Add ${title} to my list`}
  onclick={(e) => {
    e.stopPropagation();
    app.toggleFav(id);
  }}
>
  <Icon name="star" {size} filled={on} />
</button>

<style>
  .star {
    flex: none;
    width: var(--tap);
    min-height: var(--tap);
    display: grid;
    place-items: center;
    border: 0;
    background: none;
    color: var(--muted);
  }
  .star.on {
    color: #8a6d00;
  }
  :global([data-theme='dark']) .star.on {
    color: var(--accent);
  }
  .star:hover {
    color: var(--fg);
  }
</style>
