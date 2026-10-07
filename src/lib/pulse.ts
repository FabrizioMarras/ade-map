import { MINUTE, festivalDay, nowWall, parseWall } from './time';
import type { AdeEvent, Venue } from './types';

/**
 * Pulse mode time model. Time is minutes since Wed 21 Oct 00:00 (Amsterdam wall clock),
 * as in prototypes/city-pulse-prototype.html.
 */
export const T0 = parseWall('2026-10-21 00:00');
export const T_MIN = 12 * 60; // Wed 21 12:00
export const T_MAX = 5 * 1440 + 8 * 60; // Mon 26 08:00
export const T_STEP = 5;
export const T_DEFAULT = 14 * 60; // Wed 21 14:00
export const BIN = 10; // histogram bin, minutes
export const SPEEDS = [15, 30, 90] as const; // festival minutes per second

const FADE_IN = 15;
const FADE_OUT = 30;
const SOON = 60;
const FLASH = 20;

export interface PulseEvent {
  /** Index into the venue list. */
  v: number;
  /** Start / end in festival minutes. */
  s: number;
  e: number;
}

export function toMinutes(wall: number): number {
  return Math.round((wall - T0) / MINUTE);
}

export function clampT(t: number): number {
  return Math.min(T_MAX, Math.max(T_MIN, t));
}

/** Default time when entering Pulse: now during the festival, otherwise Wed 21 14:00. */
export function defaultT(now = nowWall()): number {
  const t = toMinutes(now);
  return t >= T_MIN && t <= T_MAX ? t : T_DEFAULT;
}

export function isInRange(now = nowWall()): boolean {
  const t = toMinutes(now);
  return t >= T_MIN && t <= T_MAX;
}

/** Events in pulse units; ends follow the app's rule (hidden end → start + 6 h). */
export function pulseEvents(events: AdeEvent[], venues: Venue[]): PulseEvent[] {
  const index = new Map(venues.map((v, i) => [v.id, i]));
  return events
    .filter((e) => index.has(e.venueId))
    .map((e) => ({ v: index.get(e.venueId)!, s: toMinutes(e.startMs), e: toMinutes(e.endMs) }));
}

export interface PulseState {
  /** Weighted live amount per venue: sum over live parties of fade-in × fade-out. */
  weight: Float32Array;
  /** Number of parties live per venue. */
  count: Uint16Array;
  /** 1 if a party starts within the next 60 minutes. */
  soon: Uint8Array;
  /** Ripple strength 1 → 0 over the 20 minutes after a party starts. */
  flash: Float32Array;
  nLive: number;
  nVenues: number;
}

export function computeState(events: PulseEvent[], venueCount: number, t: number): PulseState {
  const weight = new Float32Array(venueCount);
  const count = new Uint16Array(venueCount);
  const soon = new Uint8Array(venueCount);
  const flash = new Float32Array(venueCount);
  let nLive = 0;
  for (const { v, s, e } of events) {
    if (s <= t && t < e) {
      // Fade in over the first 15 minutes, dim over the last 30 (never below 15 %).
      weight[v] += Math.min(1, (t - s) / FADE_IN) * Math.min(1, (e - t) / FADE_OUT + 0.15);
      count[v]++;
      nLive++;
      if (t - s < FLASH) flash[v] = Math.max(flash[v], 1 - (t - s) / FLASH);
    } else if (t < s && s - t <= SOON) soon[v] = 1;
  }
  let nVenues = 0;
  for (let i = 0; i < venueCount; i++) if (count[i] > 0) nVenues++;
  return { weight, count, soon, flash, nLive, nVenues };
}

/** Parties live at each 10-minute step from T_MIN to T_MAX (inclusive). */
export function histogram(events: PulseEvent[], step = BIN): number[] {
  const bins: number[] = [];
  for (let m = T_MIN; m <= T_MAX; m += step) {
    let c = 0;
    for (const { s, e } of events) if (s <= m && m < e) c++;
    bins.push(c);
  }
  return bins;
}

/** "Fri 23 · 23:30" */
export function formatT(t: number): string {
  const wall = T0 + t * MINUTE;
  const d = new Date(wall);
  const key = d.toISOString().slice(0, 10);
  const day = festivalDay(key)?.short ?? `Mon ${d.getUTCDate()}`;
  return `${day} · ${d.toISOString().slice(11, 16)}`;
}

/** Fraction of the timeline at time t (for the slider and histogram). */
export function fraction(t: number): number {
  return (t - T_MIN) / (T_MAX - T_MIN);
}

export interface HistogramStyle {
  /** Draw the part after `t` dimmed. */
  t?: number;
  background?: string;
  separators?: string;
  dim?: string;
  /** Show a thin marker line at `t`. */
  marker?: string;
}

/** Draw the live-parties histogram (also used for the sheet sparkline). */
export function drawHistogram(canvas: HTMLCanvasElement, bins: number[], style: HistogramStyle = {}) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const { width: w, height: h } = canvas.getBoundingClientRect();
  if (!w || !h) return;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (style.background) {
    ctx.fillStyle = style.background;
    ctx.fillRect(0, 0, w, h);
  }
  // Midnight separators.
  ctx.strokeStyle = style.separators ?? 'rgba(255,255,255,.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let m = 1440; m < T_MAX; m += 1440) {
    if (m <= T_MIN) continue;
    const x = Math.round(fraction(m) * w) + 0.5;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  ctx.stroke();
  // Area.
  const max = Math.max(1, ...bins);
  const grad = ctx.createLinearGradient(0, h, 0, 0);
  grad.addColorStop(0, 'rgba(255,176,0,.45)');
  grad.addColorStop(1, 'rgba(255,212,0,.95)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, h);
  bins.forEach((c, i) => ctx.lineTo((i / (bins.length - 1)) * w, h - (c / max) * (h - 2)));
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  if (style.t !== undefined) {
    const x = fraction(style.t) * w;
    if (style.dim) {
      ctx.fillStyle = style.dim;
      ctx.fillRect(x, 0, w - x, h);
    }
    if (style.marker) {
      ctx.fillStyle = style.marker;
      ctx.fillRect(Math.round(x) - 1, 0, 2, h);
    }
  }
}
