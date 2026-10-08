<script lang="ts">
  import { onMount } from 'svelte';

  // Shown when neither the share sheet nor the clipboard is available: the link, selected.
  let { url, onclose }: { url: string; onclose: () => void } = $props();
  let input: HTMLInputElement | undefined = $state();

  onMount(() => {
    input?.focus();
    input?.select();
  });
</script>

<div class="manual" role="dialog" aria-label="Copy this link">
  <label>
    <span>Copy this link</span>
    <input bind:this={input} readonly value={url} onfocus={(e) => e.currentTarget.select()} />
  </label>
  <button class="btn" onclick={onclose}>Done</button>
</div>

<style>
  .manual {
    position: fixed;
    left: 12px;
    right: 12px;
    top: calc(var(--safe-top) + 140px);
    z-index: 31;
    display: flex;
    gap: 8px;
    align-items: flex-end;
    max-width: 560px;
    margin: 0 auto;
    padding: 12px;
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow);
  }
  label {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;
    font-weight: 700;
    color: var(--muted);
  }
  input {
    min-height: var(--tap);
    padding: 0 10px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--surface-2);
    font-size: 15px;
    color: var(--fg);
  }
</style>
