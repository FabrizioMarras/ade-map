import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/** Pre-ADE fixes (T25) on a phone. */
test.use({ viewport: { width: 390, height: 844 } });

const NIGHT = [2892764, 2863536, 2842943, 2917587]; // four starred parties on Fri 23
const tab = (page: Page, name: string | RegExp) =>
  page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name });
const dayChip = (page: Page, name: string) =>
  page.getByRole('group', { name: 'Day' }).getByRole('button', { name, exact: true });

/** GeoJSON features currently in a map source. */
const sourceSize = (page: Page, id: string) =>
  page.evaluate((id) => {
    const m = (window as unknown as { __adeMap: import('maplibre-gl').Map }).__adeMap;
    const src = m.getSource(id) as unknown as { _data: { geojson?: GeoJSON.FeatureCollection } } | undefined;
    if (!src) return 0;
    return ((src._data.geojson ?? src._data) as GeoJSON.FeatureCollection).features.length;
  }, id);

test.beforeEach(async ({ page }) => {
  await page.addInitScript((ids) => localStorage.setItem('ade2026.favs.v1', JSON.stringify(ids)), NIGHT);
});

test('Map after My list goes back to the day shown before, with its chip highlighted', async ({ page }) => {
  await page.goto('./#d=23');
  await ready(page);
  await tab(page, /My list/).click();
  await expect(page).toHaveURL(/d=fav/);
  await expect(page.locator('.sheet-head h2')).toContainText('My list');

  await tab(page, 'Map').click();
  await expect(page).toHaveURL(/d=23/);
  await expect(dayChip(page, 'Fri 23')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.days [aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('.sheet-head h2')).toHaveText(/Fri 23 · 335 parties/);
  await expect(tab(page, 'Map')).toHaveAttribute('aria-current', 'page');

  // A My list deep link has no day before it: the map falls back to the default day.
  await page.goto('./#d=fav');
  await page.reload();
  await ready(page);
  await tab(page, 'Map').click();
  await expect(page).toHaveURL(/d=21/); // outside the festival: the first day
  await expect(dayChip(page, 'Wed 21')).toHaveAttribute('aria-pressed', 'true');
});

test.describe('Map closes Plan B and the night route', () => {
  test.use({ geolocation: { latitude: 52.3662, longitude: 4.8966 }, permissions: ['geolocation'] });

  test('Plan B', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-23T21:30:00Z')); // Fri 23:30 Amsterdam
    await page.goto('./#d=23');
    await ready(page);
    await page.getByRole('button', { name: /^Plan B/ }).click();
    await expect(page.locator('.sheet-head h2')).toContainText('Plan B');

    await tab(page, 'Map').click();
    await expect(page.locator('.sheet-head h2')).toHaveText(/Fri 23 · 335 parties/);
    await expect(page.getByRole('button', { name: /^Plan B/ })).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => sourceSize(page, 'planb')).toBe(0);
  });

  test('night plan', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-23T16:00:00Z')); // Fri 23, 18:00
    await page.goto('./#d=23');
    await ready(page);
    await tab(page, /My list/).click();
    await page.getByRole('button', { name: 'Plan my night' }).click();
    await expect(page.locator('.sheet-head h2')).toContainText('Plan my night');
    await expect.poll(() => sourceSize(page, 'route')).toBeGreaterThan(0);

    await tab(page, 'Map').click();
    await expect(page.locator('.sheet-head h2')).toHaveText(/Fri 23 · 335 parties/);
    await expect(page).toHaveURL(/d=23/);
    await expect.poll(() => sourceSize(page, 'route')).toBe(0);
  });
});

test.describe('Resale on TicketSwap', () => {
  const resale = (page: Page) => page.getByRole('link', { name: 'Resale on TicketSwap' });

  test('shown for a party that sells tickets', async ({ page }) => {
    await page.goto('./#d=21&e=2843412'); // 313X020 — Buy Tickets
    await expect(page.locator('.detail')).toBeVisible();
    await expect(resale(page)).toBeVisible();
  });

  for (const [kind, id] of [
    ['RSVP-only', 2899791], // Open Fire Sessions — RSVP
    ['free', 2861728], // Zine Workshop by Hothead — Free
    ['ticketless', 2863911], // Network & Showcase Hub — no ticket link
  ] as const) {
    test(`hidden for a ${kind} party`, async ({ page }) => {
      await page.goto(`./#d=21&e=${id}`);
      await expect(page.locator('.detail')).toBeVisible();
      await expect(page.locator('.detail .title')).not.toBeEmpty();
      await expect(resale(page)).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Check TicketSwap' })).toHaveCount(0);
    });
  }
});
