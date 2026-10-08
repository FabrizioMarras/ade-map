import { expect, test } from '@playwright/test';
import { ready } from './helpers';

test('insights page: reachable from the footer, six charts with sentences and tables', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./#d=23');
  await ready(page);
  await page.getByRole('button', { name: 'Expand panel' }).click();
  await page.getByRole('link', { name: 'Insights', exact: true }).click();
  await expect(page).toHaveURL(/\/insights\/$/);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Insights');
  const cards = page.locator('section.card');
  await expect(cards).toHaveCount(6);
  const json = await (await page.request.get('/data/insights.json')).json();
  await expect(cards.first().locator('.say')).toContainText(String(Math.max(...json.hourly.counts)));
  // Heatmaps are tables; the bar charts and hourly chart have a table view.
  await expect(page.locator('table.heat')).toHaveCount(2);
  await expect(page.getByText('Show table')).toHaveCount(3);
  await page.getByText('Show table').first().click();
  await expect(page.locator('table.data').first().locator('tbody tr')).toHaveCount(json.hourly.counts.length);
  await expect(page.getByRole('link', { name: 'fabriziomarras.com' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('top-bar insights link: opens the insights page, hidden while a party or venue is open', async ({
  page,
}) => {
  await page.goto('./#d=23');
  await ready(page);
  const link = page.getByRole('link', { name: /^Insights · the festival by hour, area and genre/ });
  await expect(link).toBeVisible();
  const box = (await link.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(32);

  await page.goto('./#d=23&e=2892764');
  await ready(page);
  await expect(page.locator('a.insights-link')).toBeHidden();

  await page.goto('./#d=23');
  await ready(page);
  await link.click();
  await expect(page).toHaveURL(/\/insights\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Insights');
  await expect(page.locator('section.card svg, table.heat').first()).toBeVisible();
  await expect(page.getByRole('link', { name: '← Back to the map' })).toBeVisible();
});

test('insights page fits 400px without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 860 });
  await page.goto('./insights/');
  await expect(page.locator('section.card')).toHaveCount(6);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
