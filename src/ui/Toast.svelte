<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    text: string;
    action?: { label: string; run: () => void };
    /** Auto-dismiss after this many ms (0 keeps it until closed). */
    timeout?: number;
    onclose: () => void;
  }

  let { text, action, timeout = 4000, onclose }: Props = $props();

  onMount(() => {
    if (!timeout || action) return;
    const t = setTimeout(onclose, timeout);
    return () => clearTimeout(t);
  });
</script>

<div class="toast" role="status" aria-live="polite">
  <span>{text}</span>
  {#if action}
    <button class="act" onclick={action.run}>{action.label}</button>
  {/if}
  <button class="x" aria-label="Dismiss" onclick={onclose}>×</button>
</div>

<style>
  .toast {
    position: fixed;
    left: 50%;
    top: calc(var(--safe-top) + 140px);
    transform: translateX(-50%);
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: calc(100% - 24px);
    padding: 6px 6px 6px 16px;
    border-radius: 999px;
    background: var(--fg);
    color: var(--surface);
    box-shadow: var(--shadow);
    font-weight: 600;
  }
  .act {
    min-height: 36px;
    padding: 0 12px;
    border: 0;
    border-radius: 999px;
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 700;
  }
  .x {
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 999px;
    background: none;
    color: inherit;
    font-size: 22px;
    line-height: 1;
  }
</style>
