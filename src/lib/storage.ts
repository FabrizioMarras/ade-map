/** localStorage wrappers that never throw (private mode, blocked storage). */
export function readJSON<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s == null ? fallback : (JSON.parse(s) as T);
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — keep working in memory */
  }
}

export const KEYS = {
  favs: 'ade2026.favs.v1',
  theme: 'ade2026.theme.v1',
  afterMidnight: 'ade2026.afterMidnight.v1',
};
