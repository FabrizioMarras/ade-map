<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * The app's one small dialog: a title, a body and one or two buttons. Used for every
   * confirmation or choice (never window.prompt/alert/confirm). Modal, closes on Escape.
   */
  interface Button {
    label: string;
    primary?: boolean;
    run?: () => void;
  }
  interface Props {
    title: string;
    children: Snippet;
    /** One or two buttons; each closes the dialog after running. */
    buttons: [Button] | [Button, Button];
    onclose: () => void;
  }

  let { title, children, buttons, onclose }: Props = $props();
  let dialog: HTMLDialogElement | undefined = $state();
  const id = `dialog-${Math.random().toString(36).slice(2, 8)}`;

  $effect(() => {
    dialog?.showModal();
    return () => dialog?.close();
  });

  function press(b: Button) {
    b.run?.();
    onclose();
  }
</script>

<dialog bind:this={dialog} class="dialog" aria-labelledby={id} {onclose}>
  <h2 {id}>{title}</h2>
  <div class="body">{@render children()}</div>
  <div class="buttons">
    {#each buttons as b (b.label)}
      <button class="btn" class:primary={b.primary} onclick={() => press(b)}>{b.label}</button>
    {/each}
  </div>
</dialog>

<style>
  .dialog {
    box-sizing: border-box;
    width: min(calc(100% - 24px), 30rem);
    max-width: none;
    margin: auto;
    padding: 14px;
    border: 0;
    border-radius: var(--r-box);
    background: var(--surface);
    color: var(--fg);
    box-shadow: var(--shadow);
    overflow-wrap: anywhere;
  }
  .dialog::backdrop {
    background: rgb(0 0 0 / 0.45);
  }
  h2 {
    margin: 0 0 8px;
    font: 700 22px/1.1 var(--font-display);
    text-transform: uppercase;
  }
  .body {
    max-width: var(--measure);
    font-size: 15px;
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 14px;
  }
</style>
