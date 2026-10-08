import { expect, test } from '@playwright/test';
import { ready } from './helpers';

test('insights page: reachable from the app, six charts with sentences and tables', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./#d=23');
  await ready(page);
  await page.getByRole('button', { name: 'Expand panel' }).click();
  await page.getByRole('link', { name: 'Insights' }).click();
  await expect(page).toHaveURL(/\/insights\/$/);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ADE 2026 insights');
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
