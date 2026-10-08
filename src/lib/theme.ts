import { KEYS, readJSON } from './storage';
import { nowWall } from './time';

export type ThemePref = 'auto' | 'light' | 'dark';

/** "Auto" follows the night: dark from 18:00 to 07:00 Amsterdam time (the app is used outdoors). */
export function autoTheme(now: number): 'light' | 'dark' {
  const h = new Date(now).getUTCHours();
  return h >= 18 || h < 7 ? 'dark' : 'light';
}

export function resolveTheme(pref: ThemePref, now = nowWall()): 'light' | 'dark' {
  return pref === 'auto' ? autoTheme(now) : pref;
}

export function storedThemePref(): ThemePref {
  const p = readJSON<ThemePref>(KEYS.theme, 'auto');
  return p === 'light' || p === 'dark' ? p : 'auto';
}

/** For the static pages (insights/, help/): the same theme the map would show right now. */
export function applyStoredTheme() {
  document.documentElement.dataset.theme = resolveTheme(storedThemePref());
}
