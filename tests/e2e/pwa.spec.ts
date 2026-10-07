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
  const tilesLoaded = await page.evaluate(() =>
    (window as unknown as { __adeMap: import('maplibre-gl').Map }).__adeMap.areTilesLoaded(),
  );
  expect(tilesLoaded).toBe(true);

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
