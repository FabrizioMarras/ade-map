import { expect, test } from '@playwright/test';
import { ready } from './helpers';

test('the ? button opens the map guide; hidden while a party is open', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./#d=23&e=2892764');
  await ready(page);
  const help = page.getByLabel('How to use the app');
  await expect(help).toBeHidden();

  await page.goto('./#d=23');
  await ready(page);
  await help.click();
  await expect(page).toHaveURL(/\/help\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 }).first()).toHaveText(/Find a party/);
  // Back to the map, and the guide is also linked from the credits footer.
  await page.getByRole('link', { name: 'Map', exact: true }).click();
  await ready(page);
  await page.getByRole('button', { name: 'Expand panel' }).click();
  await page.locator('footer.credits').getByRole('link', { name: 'How to use the app' }).click();
  await expect(page).toHaveURL(/\/help\/$/);
  expect(errors).toEqual([]);
});

test('map guide fits 400px and works offline', async ({ page, context }) => {
  await page.setViewportSize({ width: 400, height: 860 });
  await page.goto('./');
  await ready(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(async () => !!(await caches.match('help/index.html')));

  await context.setOffline(true);
  await page.goto('./help/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('section')).toHaveCount(7);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await context.setOffline(false);
});
