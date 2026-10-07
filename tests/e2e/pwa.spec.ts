import { expect, test } from '@playwright/test';
import { ready } from './helpers';

test('works offline after the first visit', async ({ page, context }) => {
  await page.goto('./#d=23');
  await ready(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Make sure the worker controls the page and the data/tiles have been cached.
  await page.reload();
  await ready(page);
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    const tiles = keys.includes('ade-tiles') ? await (await caches.open('ade-tiles')).keys() : [];
    const data = keys.includes('ade-data') ? await (await caches.open('ade-data')).keys() : [];
    return tiles.length > 5 && data.length >= 3;
  });

  await context.setOffline(true);
  await page.reload();
  await ready(page);
  await expect(page.locator('.sheet-head h2')).toHaveText(/Fri 23 · 335 parties/);

  // Previously seen tiles render from the cache (the remote style, not the fallback).
  await expect(page.locator('.map')).not.toHaveAttribute('data-fallback', 'true');
  // Tiles decode from the cache asynchronously; give a busy machine a moment.
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          (window as unknown as { __adeMap: import('maplibre-gl').Map }).__adeMap.areTilesLoaded(),
        ),
      { timeout: 10_000 },
    )
    .toBe(true);

  // Lists work offline.
  await page.getByRole('searchbox').fill('paradiso');
  await expect(page.locator('.card').first()).toBeVisible();
  await context.setOffline(false);
});

test('manifest is valid and linked', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel=manifest]').getAttribute('href');
  const res = await request.get(href!);
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m.display).toBe('standalone');
  expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512']),
  );
  expect(m.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
  for (const i of m.icons) expect((await request.get(i.src)).ok()).toBe(true);
});

test('shows an error with retry when the programme fails to load', async ({ page }) => {
  let fail = true;
  await page.route(/data\/ade-2026\.core\.json/, (route) => (fail ? route.abort() : route.continue()));
  await page.goto('./#d=23');
  await expect(page.getByRole('alert')).toContainText("couldn't be loaded");
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.sheet-head h2')).toHaveText(/Fri 23 · 335 parties/);
  await expect(page.locator('.credits')).toContainText('Programme as of');
});

test('keyboard: open a party from the list and go back with Escape', async ({ page }) => {
  await page.goto('./#d=23');
  await ready(page);
  await page.getByRole('button', { name: 'Expand panel' }).click();
  await page.locator('.card .main').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.detail')).toBeVisible();
  await expect(page.locator('.sheet-head h2')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.detail')).toHaveCount(0);
});
