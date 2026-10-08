<script lang="ts">
  import { app, toastTimeout, type Toast } from '../lib/store.svelte';

  /** Distance from the bottom of the screen: just above the tab bar or the Pulse deck. */
  let { bottom }: { bottom: number } = $props();

  // One timer per toast, started when it appears.
  const timers = new Map<number, ReturnType<typeof setTimeout>>();
  $effect(() => {
    for (const t of app.toasts)
      if (!timers.has(t.id))
        timers.set(
          t.id,
          setTimeout(() => {
            timers.delete(t.id);
            app.dismissToast(t.id);
          }, toastTimeout(t.text)),
        );
  });
  $effect(() => () => timers.forEach(clearTimeout));

  function run(t: Toast) {
    t.action?.run();
    app.dismissToast(t.id);
  }
</script>

<div class="toasts" role="status" aria-live="polite" style:bottom="{bottom}px">
  {#each app.toasts as t (t.id)}
    <div class="toast">
      <span class="text">{t.text}</span>
      {#if t.action}
        <button class="act" onclick={() => run(t)}>{t.action.label}</button>
      {/if}
      <button class="x" aria-label="Dismiss" onclick={() => app.dismissToast(t.id)}>×</button>
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    left: 12px;
    right: 12px;
    z-index: 30;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    pointer-events: none;
  }
  .toast {
    pointer-events: auto;
    box-sizing: border-box;
    width: max-content;
    max-width: min(100%, var(--measure));
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 6px 6px 14px;
    min-height: 48px;
    border-radius: var(--r-box);
    background: var(--fg);
    color: var(--surface);
    box-shadow: var(--shadow);
    font-weight: 600;
    animation: rise 0.2s ease-out;
  }
  .text {
    flex: 1;
    min-width: 0;
    padding: 6px 0;
    overflow-wrap: anywhere;
  }
  .act {
    flex: none;
    min-height: 36px;
    padding: 0 12px;
    border: 0;
    border-radius: var(--r-pill);
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 700;
    white-space: nowrap;
  }
  .x {
    flex: none;
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: var(--r-pill);
    background: none;
    color: inherit;
    font-size: 22px;
    line-height: 1;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .toast {
      animation: none;
    }
  }
</style>
