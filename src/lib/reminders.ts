import { MINUTE } from './time';
import type { AdeEvent } from './types';

/** Reminders fire this long before a starred party starts. */
export const LEAD_MINUTES = 30;

/**
 * Starred parties whose reminder is due now: within LEAD_MINUTES of their start and not yet
 * reminded. (No background scheduling exists for web apps without a push server, so the app
 * checks while it is open or alive in the background.)
 */
export function dueReminders(events: AdeEvent[], now: number, notified: Set<number>): AdeEvent[] {
  return events
    .filter((e) => !notified.has(e.id) && e.startMs - LEAD_MINUTES * MINUTE <= now && now < e.startMs)
    .sort((a, b) => a.startMs - b.startMs);
}

export function reminderText(e: AdeEvent, now: number): { title: string; body: string } {
  const mins = Math.max(1, Math.round((e.startMs - now) / MINUTE));
  return { title: e.title, body: `Starts in ${mins} min at ${e.venue.name}` };
}

/** Show a notification through the service worker (needed on Android), else directly. */
export async function notify(title: string, body: string, url: string, tag: string) {
  const options: NotificationOptions = { body, tag, icon: 'icons/icon-192.png', data: { url } };
  const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  if (reg) return reg.showNotification(title, options);
  new Notification(title, options);
}
