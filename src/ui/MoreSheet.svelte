<script lang="ts">
  import { app } from '../lib/store.svelte';
  import MoreContent from './MoreContent.svelte';

  interface Props {
    /** Space kept free at the bottom (the tab bar), in px. */
    bottom: number;
    asOf: string;
  }

  let { bottom, asOf }: Props = $props();

  let panel: HTMLDivElement | undefined = $state();
  // Focus moves into the sheet when it opens, and back to the More tab when it closes.
  $effect(() => {
    panel?.querySelector<HTMLElement>('a, button')?.focus();
    return () => {
      const a = document.activeElement;
      if (!a || a === document.body || panel?.contains(a))
        document.querySelector<HTMLElement>('[data-tab="more"]')?.focus();
    };
  });
</script>

<!-- Phones: a short sheet over a scrim. The scrim closes it; keyboard users have Escape and the More tab. -->
<!-- The tab bar stays usable: tapping More again closes the sheet. -->
<div class="scrim" role="presentation" style:bottom="{bottom}px" onclick={() => app.closeMore()}></div>
<div class="more" role="dialog" aria-labelledby="more-title" style:bottom="{bottom}px" bind:this={panel}>
  <h2 id="more-title" class="visually-hidden">More</h2>
  <MoreContent {asOf} />
</div>

<style>
  .scrim {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 28;
    background: rgb(0 0 0 / 0.35);
    animation: fade 0.2s ease-out;
  }
  .more {
    position: fixed;
    left: 0;
    right: 0;
    z-index: 29;
    max-height: calc(100dvh - var(--safe-top) - 80px);
    overflow-y: auto;
    padding: 8px 12px 12px;
    background: var(--surface);
    border-radius: var(--r-sheet) var(--r-sheet) 0 0;
    border-top: 1px solid var(--line);
    box-shadow: var(--shadow);
    animation: rise 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  @keyframes rise {
    from {
      transform: translateY(24px);
      opacity: 0;
    }
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .more,
    .scrim {
      animation: none;
    }
  }
</style>
