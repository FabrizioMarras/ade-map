import type { Map as MlMap } from 'maplibre-gl';
import { polygonArea, simplify, type LngLat, type Point } from '../lib/geo';

export type DrawMode = 'lasso' | 'box';

const MIN_AREA = 40; // px²; anything smaller is treated as a tap

export interface LassoOptions {
  map: MlMap;
  canvas: HTMLCanvasElement;
  color: () => string;
  /** Called with the closed polygon in lng/lat, or null when the drawing was discarded. */
  ondone: (polygon: LngLat[] | null) => void;
}

/**
 * Freehand lasso / rectangle drawing on an overlay canvas. While active, one-finger
 * drag draws (map drag-pan is disabled); a second finger cancels the stroke so
 * MapLibre's pinch zoom and two-finger pan keep working.
 */
export class Lasso {
  private opts: LassoOptions;
  private mode: DrawMode = 'lasso';
  private active = false;
  private points: Point[] = [];
  private pointerId: number | null = null;
  private touches = new Set<number>();
  private origin = { x: 0, y: 0 };
  private oneShot = false;

  constructor(opts: LassoOptions) {
    this.opts = opts;
    const el = opts.map.getCanvasContainer();
    el.addEventListener('pointerdown', this.down, true);
    window.addEventListener('pointermove', this.move, true);
    window.addEventListener('pointerup', this.up, true);
    window.addEventListener('pointercancel', this.cancelPointer, true);
  }

  destroy() {
    const el = this.opts.map.getCanvasContainer();
    el.removeEventListener('pointerdown', this.down, true);
    window.removeEventListener('pointermove', this.move, true);
    window.removeEventListener('pointerup', this.up, true);
    window.removeEventListener('pointercancel', this.cancelPointer, true);
  }

  /** Enter or leave draw mode. */
  setActive(on: boolean, mode: DrawMode = this.mode) {
    this.mode = mode;
    this.active = on;
    if (on) this.opts.map.dragPan.disable();
    else if (!this.oneShot) this.opts.map.dragPan.enable();
    // With drag-pan off, MapLibre leaves `touch-action: pan-x pan-y` on the map, so the
    // browser claims one-finger drags and cancels the pointer stream (nothing gets drawn
    // on phones). Take the gesture back while drawing; pinch-zoom still goes to MapLibre.
    const touchAction = on ? 'none' : '';
    this.opts.map.getCanvasContainer().style.touchAction = touchAction;
    this.opts.map.getCanvas().style.touchAction = touchAction;
    this.reset();
  }

  private reset() {
    this.points = [];
    this.pointerId = null;
    this.clear();
  }

  private local(e: PointerEvent): Point {
    const r = this.opts.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private down = (e: PointerEvent) => {
    if (e.pointerType === 'touch') this.touches.add(e.pointerId);
    // Desktop shortcut: shift + drag draws a box without entering draw mode.
    const shiftBox = !this.active && e.shiftKey && e.pointerType === 'mouse' && e.button === 0;
    if (!this.active && !shiftBox) return;
    if (this.touches.size > 1) {
      // Second finger: hand the gesture back to the map.
      this.points = [];
      this.pointerId = null;
      this.clear();
      return;
    }
    if (shiftBox) {
      this.oneShot = true;
      this.mode = 'box';
      this.opts.map.dragPan.disable();
      e.stopPropagation();
    }
    this.pointerId = e.pointerId;
    const p = this.local(e);
    this.origin = { x: p[0], y: p[1] };
    this.points = [p];
    this.resize();
  };

  private move = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId || this.touches.size > 1) return;
    const p = this.local(e);
    if (this.mode === 'box') {
      const { x, y } = this.origin;
      this.points = [
        [x, y],
        [p[0], y],
        [p[0], p[1]],
        [x, p[1]],
      ];
    } else {
      const last = this.points[this.points.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 2) this.points.push(p);
    }
    this.draw();
  };

  private up = (e: PointerEvent) => {
    this.touches.delete(e.pointerId);
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    const pts = this.mode === 'box' ? this.points : simplify(this.points, 3);
    this.clear();
    this.points = [];
    if (this.oneShot) {
      this.oneShot = false;
      if (!this.active) this.opts.map.dragPan.enable();
    }
    if (pts.length < 3 || polygonArea(pts) < MIN_AREA) return;
    const ring = pts.map((p) => {
      const ll = this.opts.map.unproject(p);
      return [ll.lng, ll.lat] as LngLat;
    });
    ring.push(ring[0]);
    this.opts.ondone(ring);
  };

  private cancelPointer = (e: PointerEvent) => {
    this.touches.delete(e.pointerId);
    if (e.pointerId === this.pointerId) this.reset();
  };

  private resize() {
    const c = this.opts.canvas;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (c.width !== w * dpr || c.height !== h * dpr) {
      c.width = w * dpr;
      c.height = h * dpr;
    }
    c.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private clear() {
    const c = this.opts.canvas;
    c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
  }

  private draw() {
    const ctx = this.opts.canvas.getContext('2d');
    if (!ctx || this.points.length < 2) return;
    this.clear();
    ctx.beginPath();
    this.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 212, 0, 0.16)';
    ctx.fill();
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = this.opts.color();
    ctx.stroke();
  }
}
