export type LngLat = [number, number];
export type Point = [number, number];

export const CENTRE: LngLat = [4.895, 52.37];
/** Pan limits: a little wider than the area covered by the data and basemap. */
export const MAX_BOUNDS: [LngLat, LngLat] = [
  [4.68, 52.26],
  [5.08, 52.46],
];
/** Accepted geocoding area for venues. */
export const VALID_BOUNDS = { minLat: 52.28, maxLat: 52.45, minLng: 4.72, maxLng: 5.05 };

export function inValidBounds(lat: number, lng: number): boolean {
  const b = VALID_BOUNDS;
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}

/** Ray casting; works for screen or geographic coordinates. */
export function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Shoelace area (absolute). */
export function polygonArea(poly: Point[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
  }
  return Math.abs(a / 2);
}

function perpDist(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (!len2) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Douglas–Peucker line simplification. */
export function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points.slice();
  let maxD = 0;
  let idx = 0;
  const last = points.length - 1;
  for (let i = 1; i < last; i++) {
    const d = perpDist(points[i], points[0], points[last]);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= tolerance) return [points[0], points[last]];
  const left = simplify(points.slice(0, idx + 1), tolerance);
  const right = simplify(points.slice(idx), tolerance);
  return left.slice(0, -1).concat(right);
}

export function bbox(points: LngLat[]): [LngLat, LngLat] {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}

/**
 * Spread venues that share identical coordinates on a small circle (~12 m) so their
 * pins and badges stay readable when zoomed in. Deterministic: ordered by id.
 */
export function spreadDuplicates<T extends { id: string; lat: number; lng: number }>(
  venues: T[],
): Map<string, LngLat> {
  const groups = new Map<string, T[]>();
  for (const v of venues) {
    const k = `${v.lat.toFixed(5)},${v.lng.toFixed(5)}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(v);
  }
  const out = new Map<string, LngLat>();
  const r = 0.00011; // ≈12 m latitude
  for (const list of groups.values()) {
    list.sort((a, b) => a.id.localeCompare(b.id));
    list.forEach((v, i) => {
      if (list.length === 1) return out.set(v.id, [v.lng, v.lat]);
      const a = (2 * Math.PI * i) / list.length;
      out.set(v.id, [v.lng + (r * Math.sin(a)) / Math.cos((v.lat * Math.PI) / 180), v.lat + r * Math.cos(a)]);
    });
  }
  return out;
}

export function directionsUrls(lat: number, lng: number, name: string) {
  const q = encodeURIComponent(name);
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    apple: `https://maps.apple.com/?daddr=${lat},${lng}&q=${q}`,
  };
}

/** Venues within ~5 m share a spot (e.g. three bars at Rembrandtplein 17): one pin on the map. */
export function spotKey(v: { lat: number; lng: number }): string {
  return `${v.lat.toFixed(4)},${v.lng.toFixed(4)}`;
}
