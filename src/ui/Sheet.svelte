<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { SheetSnap } from '../lib/store.svelte';

  interface Props {
    snap: SheetSnap;
    wide: boolean;
    /** Height of the sheet that is visible over the map (0 on wide screens). */
    visible?: number;
    header: Snippet;
    /** Optional strip between the handle and the header (visible when collapsed). */
    top?: Snippet;
    /** Height left visible when collapsed. */
    peek?: number;
    /** Space kept free below the sheet (the bottom tab bar), in px. */
    inset?: number;
    children: Snippet;
  }

  let {
    snap = $bindable(),
    wide,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-useless-assignment -- bindable output
    visible = $bindable(0),
    header,
    top,
    peek = 56,
    inset = 0,
    children,
  }: Props = $props();

  let vh = $state(typeof window !== 'undefined' ? window.innerHeight : 800);
  let dragY = $state<number | null>(null);
  let body: HTMLDivElement | undefined = $state();
  let start = { y: 0, offset: 0, t: 0, moved: false, onHandle: false };

  function cycle() {
    snap = snap === 'expanded' ? 'half' : snap === 'half' ? 'expanded' : 'half';
  }

  /** Fully expanded, the sheet stops below the search row and the brand badge (TOP_RESERVE). */
  const TOP_RESERVE = 78;
  let safeTop = $state(0);
  const sheetH = $derived(Math.round(vh - safeTop - TOP_RESERVE - inset));

  $effect(() => {
    // env(safe-area-inset-top) can only be read through a styled element.
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top)';
    document.body.appendChild(probe);
    safeTop = parseFloat(getComputedStyle(probe).paddingTop) || 0;
    probe.remove();
  });
  const offsets = $derived<Record<SheetSnap, number>>({
    expanded: 0,
    half: Math.max(0, sheetH - Math.round(vh * 0.45)),
    collapsed: sheetH - peek,
  });
  const offset = $derived(dragY ?? offsets[snap]);
  let grabH = $state(56);
  /** Limit the scroll area to the on-screen part of the sheet (kept fixed while dragging). */
  const bodyMax = $derived(wide ? undefined : `${Math.max(0, sheetH - offsets[snap] - grabH)}px`);

  $effect(() => {
    visible = wide ? 0 : Math.min(sheetH - offsets[snap], Math.round(vh * 0.45));
  });

  function down(e: PointerEvent) {
    if (wide || (e.target as HTMLElement).closest('button:not(.handle), a, input, select, textarea')) return;
    const onHandle = !!(e.target as HTMLElement).closest('.handle');
    start = { y: e.clientY, offset: offsets[snap], t: performance.now(), moved: false, onHandle };
    dragY = start.offset;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function move(e: PointerEvent) {
    if (dragY === null) return;
    const dy = e.clientY - start.y;
    if (Math.abs(dy) > 4) start.moved = true;
    dragY = Math.min(offsets.collapsed, Math.max(0, start.offset + dy));
  }

  function up(e: PointerEvent) {
    if (dragY === null) return;
    const y = dragY;
    dragY = null;
    // Pointer capture retargets the click, so a tap on the handle is handled here.
    if (!start.moved) {
      if (start.onHandle) cycle();
      return;
    }
    const velocity = (e.clientY - start.y) / Math.max(1, performance.now() - start.t); // px/ms
    const order: SheetSnap[] = ['expanded', 'half', 'collapsed'];
    if (Math.abs(velocity) > 0.5) {
      const i = order.indexOf(snap) + (velocity > 0 ? 1 : -1);
      snap = order[Math.max(0, Math.min(2, i))];
      return;
    }
    snap = order.reduce((best, s) => (Math.abs(offsets[s] - y) < Math.abs(offsets[best] - y) ? s : best));
  }

  export function scrollTop() {
    body?.scrollTo({ top: 0 });
  }
</script>

<svelte:window bind:innerHeight={vh} />

<section
  class="sheet"
  class:wide
  class:dragging={dragY !== null}
  style:--sheet-h="{sheetH}px"
  style:transform={wide ? undefined : `translateY(${offset}px)`}
  style:bottom={wide ? undefined : `${inset}px`}
  aria-label="Parties"
>
  <div
    class="grab"
    bind:clientHeight={grabH}
    role="presentation"
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
  >
    {#if !wide}
      <button
        class="handle"
        aria-label={snap === 'expanded' ? 'Shrink panel' : 'Expand panel'}
        onclick={(e) => e.detail === 0 && cycle()}
      >
        <span></span>
      </button>
    {/if}
    {@render top?.()}
    {@render header()}
  </div>
  <div class="body" bind:this={body} style:max-height={bodyMax} inert={!wide && snap === 'collapsed'}>
    {@render children()}
  </div>
</section>

<style>
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: var(--sheet-h);
    background: var(--surface);
    border-radius: var(--r-sheet) var(--r-sheet) 0 0;
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    z-index: 20;
    transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
    will-change: transform;
  }
  .sheet.dragging {
    transition: none;
  }
  .sheet.wide {
    top: 0;
    right: auto;
    width: 400px;
    height: 100%;
    border-radius: 0;
    transform: none;
    border-right: 1px solid var(--line);
  }
  .grab {
    flex: none;
    touch-action: none;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--line);
  }
  .wide .grab {
    padding-top: calc(var(--safe-top) + 8px);
    touch-action: auto;
  }
  .handle {
    display: block;
    width: 100%;
    height: 20px;
    border: 0;
    background: none;
    padding: 8px 0 0;
  }
  .handle span {
    display: block;
    margin: 0 auto;
    width: 40px;
    height: 5px;
    border-radius: var(--r-pill);
    background: var(--line);
  }
  .body {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    padding-bottom: calc(var(--safe-bottom) + 16px);
  }
</style>
