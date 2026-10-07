<script lang="ts">
  import { onMount } from 'svelte';
  import { loadData } from './lib/data';
  import { app } from './lib/store.svelte';
  import MapView from './map/Map.svelte';

  const padding = { top: 0, bottom: 0, left: 0, right: 0 };

  onMount(async () => {
    try {
      app.data = await loadData();
    } catch (e) {
      app.error = e instanceof Error ? e.message : String(e);
    }
  });

  $effect(() => {
    document.documentElement.dataset.theme = app.theme;
  });

  function onpick(ids: string[]) {
    console.log(
      'venue',
      ids.map((id) => app.data?.venuesById.get(id)?.name),
    );
  }
</script>

<MapView {onpick} {padding} />
