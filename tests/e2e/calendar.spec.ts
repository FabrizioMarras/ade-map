import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { ready } from './helpers';

const STARRED = [2892764, 2863536]; // Fri 18:30 Paradiso, Fri 23:00 NDSM

test('Calendar (.ics) downloads one event per starred party', async ({ page }) => {
  await page.addInitScript((ids) => localStorage.setItem('ade2026.favs.v1', JSON.stringify(ids)), STARRED);
  await page.goto('./#d=fav');
  await ready(page);
  await page.getByRole('button', { name: 'Expand panel' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Calendar (.ics)' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('ade-2026-my-list.ics');
  const text = await readFile((await download.path())!, 'utf8');
  expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  expect(text).toContain('DTSTART;TZID=Europe/Amsterdam:20261023T183000');
  expect(text).toContain('UID:ade2026-2863536@');
});

test('reminders notify 30 minutes before a starred party (stubbed notifications)', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['notifications']);
  await page.clock.install({ time: new Date('2026-10-23T20:20:00Z') }); // Fri 22:20 Amsterdam
  await page.addInitScript((ids) => {
    localStorage.setItem('ade2026.favs.v1', JSON.stringify(ids));
    const shown: { title: string; body?: string; url?: string }[] = [];
    (window as unknown as { __shown: typeof shown }).__shown = shown;
    const record = (title: string, o?: NotificationOptions) =>
      shown.push({ title, body: o?.body, url: (o?.data as { url?: string } | undefined)?.url });
    // Both paths the app may use: the service worker's showNotification, or new Notification().
    ServiceWorkerRegistration.prototype.showNotification = async function (title, o) {
      record(title, o);
    };
    class FakeNotification {
      static permission = 'granted';
      static requestPermission = async () => 'granted';
      constructor(title: string, o?: NotificationOptions) {
        record(title, o);
      }
    }
    (window as unknown as { Notification: unknown }).Notification = FakeNotification;
  }, STARRED);
  await page.goto('./#d=fav');
  await ready(page);
  await page.getByRole('button', { name: 'Expand panel' }).click();
  await page.getByRole('checkbox', { name: /Remind me 30 minutes/ }).check();
  await expect(page.getByRole('status').filter({ hasText: 'Reminders on' })).toBeVisible();

  // 22:20: nothing due yet (the 23:00 party is 40 min away). 22:31: due.
  await page.clock.runFor(60_000);
  expect(await page.evaluate(() => (window as unknown as { __shown: unknown[] }).__shown)).toEqual([]);
  await page.clock.runFor(11 * 60_000);
  const shown = await page.evaluate(
    () => (window as unknown as { __shown: { title: string; body: string; url: string }[] }).__shown,
  );
  expect(shown).toHaveLength(1);
  expect(shown[0].title).toContain('De Binnenstad');
  expect(shown[0].body).toMatch(/^Starts in \d+ min at IJver Amsterdam NDSM$/);
  expect(shown[0].url).toMatch(/#e=2863536$/);

  // Only once.
  await page.clock.runFor(2 * 60_000);
  expect(await page.evaluate(() => (window as unknown as { __shown: unknown[] }).__shown)).toHaveLength(1);
});
