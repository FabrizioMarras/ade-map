import { expect, test } from '@playwright/test';
import { ready } from './helpers';

type W = Window & { __adeMap: import('maplibre-gl').Map };

test('Pulse: enter, scrub to Fri 23:30, 144 parties live, exit', async ({ page }) => {
  await page.goto('./#d=23');
  await ready(page);
  const dayChip = page.getByRole('button', { name: 'Fri 23' });
  await expect(dayChip).toBeVisible();

  await page.getByRole('button', { name: /^Pulse/ }).click();
  await expect(page.getByRole('region', { name: 'Festival pulse timeline' })).toBeVisible();
  await expect(dayChip).toHaveCount(0); // day chips hidden
  await expect(page.getByRole('button', { name: '▶ Play' })).toHaveAttribute('aria-pressed', 'false'); // never auto-plays

  await page.getByRole('slider', { name: 'Festival time' }).fill(String(2 * 1440 + 23 * 60 + 30));
  await expect(page.locator('.clock')).toContainText('Fri 23');
  await expect(page.locator('.clock')).toContainText('23:30');
  await expect(page.locator('.stats')).toContainText('144 parties live');
  await expect(page).toHaveURL(/p=4290/);

  await page.getByRole('button', { name: 'Exit Pulse' }).first().click();
  await expect(page.getByRole('region', { name: 'Festival pulse timeline' })).toHaveCount(0);
  await expect(dayChip).toBeVisible();
  await expect(page).not.toHaveURL(/p=/);
});

test('Pulse: sparkline entry, tap a lit venue, back button returns to the map', async ({ page }) => {
  await page.goto('./#d=23');
  await ready(page);
  const before = await page.evaluate(() => (window as unknown as W).__adeMap.getCenter().toArray());

  await page.getByRole('button', { name: /Open the festival pulse/ }).click();
  await expect(page).toHaveURL(/p=\d+/);
  await page.getByRole('slider', { name: 'Festival time' }).fill(String(2 * 1440 + 23 * 60 + 30));
  await expect(page.locator('.stats')).toContainText('144 parties live');

  // Tap the venue with the most parties running, once the map has drawn Fri 23:30.
  await expect(page.locator('.map')).toHaveAttribute('data-pulse-t', '4290');
  await page.waitForFunction(() => !(window as unknown as W).__adeMap.isMoving());
  const hit = await page.waitForFunction(() => {
    const m = (window as unknown as W).__adeMap;
    const lit = m
      .queryRenderedFeatures({ layers: ['pulse-core'] })
      .filter((f) => (f.state?.count ?? 0) > 0)
      .map((f) => ({
        p: m.project((f.geometry as GeoJSON.Point).coordinates as [number, number]),
        n: f.state.count,
      }))
      .filter(({ p }) => p.y > 220 && p.y < innerHeight - 320 && p.x > 30 && p.x < innerWidth - 80)
      .sort((a, b) => b.n - a.n);
    return lit[0] ? { x: lit[0].p.x, y: lit[0].p.y } : null;
  });
  const { x, y } = (await hit.jsonValue())!;
  await page.mouse.click(x, y);
  await expect(page.locator('.section-title').first()).toContainText('live · Fri 23 · 23:30');
  await expect(page.locator('.venue .card').first()).toBeVisible();

  // Back: venue → Pulse → normal map at the same position.
  await page.goBack();
  await expect(page.getByRole('region', { name: 'Festival pulse timeline' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('region', { name: 'Festival pulse timeline' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Fri 23' })).toBeVisible();
  const after = await page.evaluate(() => (window as unknown as W).__adeMap.getCenter().toArray());
  expect(after[0]).toBeCloseTo(before[0], 4);
  expect(after[1]).toBeCloseTo(before[1], 4);
});

test('Pulse: the map follows the clock while playing', async ({ page }) => {
  await page.goto('./#d=23&p=4200');
  const map = page.locator('.map');
  await expect(map).toHaveAttribute('data-pulse-t', '4200');
  await page.getByRole('button', { name: '▶ Play' }).click();
  // While still playing, the map must redraw past the start (it used to freeze until playback
  // stopped). Polled rather than timed, so slow CI machines don't fail it.
  await expect
    .poll(async () => Number(await map.getAttribute('data-pulse-t')), { timeout: 8000 })
    .toBeGreaterThanOrEqual(4210);
  await expect(page.getByRole('button', { name: '❚❚ Pause' })).toBeVisible(); // still playing
  await page.getByRole('button', { name: '❚❚ Pause' }).click();
  const t = Number(new URL(page.url()).hash.match(/p=(\d+)/)![1]);
  await expect(map).toHaveAttribute('data-pulse-t', String(t));
});
