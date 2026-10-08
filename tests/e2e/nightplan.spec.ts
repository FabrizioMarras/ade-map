import { expect, test } from '@playwright/test';
import { ready } from './helpers';

const NIGHT = [2892764, 2863536, 2842943, 2917587]; // Paradiso 18:30 · NDSM 23:00 · Shelter 23:00 · Blend XL 02:00

test('Plan my night: route with ferry, clash and night-bus notes, drawn on the map', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-23T16:00:00Z')); // Fri 23, 18:00
  await page.addInitScript((ids) => localStorage.setItem('ade2026.favs.v1', JSON.stringify(ids)), NIGHT);
  await page.goto('./#d=fav');
  await ready(page);
  await page.getByRole('button', { name: 'Expand panel' }).click();
  await page.getByRole('button', { name: 'Plan my night' }).click();

  await expect(page.locator('.sheet-head h2')).toContainText('Plan my night');
  await expect(page.getByRole('button', { name: 'Fri 23 night' })).toHaveAttribute('aria-pressed', 'true');
  const stops = page.locator('.route .stop');
  await expect(stops).toHaveCount(4);
  await expect(stops.nth(0)).toContainText('Paradiso');
  await expect(stops.nth(3)).toContainText('Blend XL');

  const legs = page.locator('.route .leg');
  await expect(legs).toHaveCount(3);
  await expect(legs.nth(0)).toContainText('ferry F4 NDSM');
  await expect(legs.nth(1)).toContainText('Overlaps the next party by 7 h'); // NDSM until 06:00 vs Shelter 23:00
  // Shelter (Overhoeks) → Blend XL after 01:00: F3 Buiksloterweg, and night buses.
  await expect(legs.nth(2)).toContainText('ferry F3 Buiksloterweg');
  await expect(legs.nth(2)).toContainText('night buses');
  await expect(legs.nth(0).getByRole('link', { name: 'GVB ferry times' })).toHaveAttribute(
    'href',
    /reisinfo\.gvb\.nl/,
  );

  // The route is on the map: a line and four numbered stops.
  const route = await page.evaluate(() => {
    const m = (window as unknown as { __adeMap: import('maplibre-gl').Map }).__adeMap;
    const src = m.getSource('route') as unknown as { _data: { geojson?: GeoJSON.FeatureCollection } };
    const fc = (src._data.geojson ?? src._data) as GeoJSON.FeatureCollection;
    return fc.features.map((f) => f.geometry.type);
  });
  expect(route.filter((t) => t === 'LineString')).toHaveLength(1);
  expect(route.filter((t) => t === 'Point')).toHaveLength(4);

  // Bike is faster than walking.
  const walk = Number((await legs.nth(0).locator('.how').textContent())!.match(/(\d+) min/)![1]);
  await page.getByRole('button', { name: 'Bike' }).click();
  const bike = Number((await legs.nth(0).locator('.how').textContent())!.match(/(\d+) min/)![1]);
  expect(bike).toBeLessThan(walk);

  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.sheet-head h2')).toContainText('My list');
});
