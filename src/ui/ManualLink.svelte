<script lang="ts">
  import { onMount } from 'svelte';
  import Dialog from './Dialog.svelte';

  // Shown when neither the share sheet nor the clipboard is available: the link, selected.
  let { url, onclose }: { url: string; onclose: () => void } = $props();
  let input: HTMLInputElement | undefined = $state();

  onMount(() => {
    input?.focus();
    input?.select();
  });
</script>

<Dialog title="Copy this link" buttons={[{ label: 'Done', primary: true }]} {onclose}>
  <label>
    <span>Select the link and copy it</span>
    <input bind:this={input} readonly value={url} onfocus={(e) => e.currentTarget.select()} />
  </label>
</Dialog>

<style>
  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 14px;
    color: var(--muted);
  }
  input {
    min-width: 0;
    min-height: var(--tap);
    padding: 0 10px;
    border: 1px solid var(--line);
    border-radius: var(--r-box);
    background: var(--surface-2);
    font-size: 15px;
    color: var(--fg);
  }
</style>
