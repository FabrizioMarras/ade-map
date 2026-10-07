import { expect, test } from '@playwright/test';
import { jumpTo, pinPoint, ready } from './helpers';

const PARADISO: [number, number] = [4.88394502, 52.36227745];

test.beforeEach(async ({ page }) => {
  // Freeze the clock inside the festival (Fri 23, 12:00 Amsterdam) for stable results.
  await page.clock.setFixedTime(new Date('2026-10-23T10:00:00Z'));
});

test('open → tap Paradiso → party → tickets → back', async ({ page, context }) => {
  await page.goto('./#d=23');
  await ready(page);
  await jumpTo(page, PARADISO, 16.5);
  const p = await pinPoint(page, PARADISO);
  await page.mouse.click(p.x, p.y);

  const head = page.locator('.sheet-head h2');
  await expect(head).toContainText('Paradiso');
  await expect(page).toHaveURL(/v=1576/);

  const cards = page.locator('.card .main');
  await expect(cards.first()).toBeVisible();
  const title = (await cards.first().locator('.title').textContent())!.trim();
  await cards.first().click();
  await expect(page.locator('.detail .title')).toHaveText(title);
  await expect(page).toHaveURL(/e=\d+/);

  const tickets = page.locator('.detail a.btn.primary');
  if (await tickets.count()) {
    await expect(tickets).toHaveAttribute('target', '_blank');
    const [popup] = await Promise.all([context.waitForEvent('page'), tickets.click()]);
    expect(popup.url()).toMatch(/^https?:/);
    await popup.close();
  }

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(head).toContainText('Paradiso');
  await expect(page).not.toHaveURL(/e=/);
  await page.goBack();
  await expect(page.locator('.detail')).toHaveCount(0);
  await expect(head).not.toContainText('Paradiso');
});

test('deep link opens the party detail', async ({ page }) => {
  await page.goto('./#d=21&e=2843412');
  await expect(page.locator('.detail .title')).toContainText('313X020');
  await expect(page.locator('.detail .when')).toHaveText('Wed 21 · 14:00 → 23:30');
});

test('day switch updates counts; search finds line-up matches', async ({ page }) => {
  await page.goto('./#d=23');
  await ready(page);
  const head = page.locator('.sheet-head h2');
  await expect(head).toHaveText(/Fri 23 · 335 parties/);

  const badges = () =>
    page.evaluate(() => {
      const m = (window as unknown as { __adeMap: import('maplibre-gl').Map }).__adeMap;
      const src = m.getSource('venues') as unknown as { _data: { geojson?: GeoJSON.FeatureCollection } };
      const fc = (src._data.geojson ?? src._data) as GeoJSON.FeatureCollection;
      return fc.features.reduce((n, f) => n + (f.properties!.count as number), 0);
    });
  await expect.poll(badges).toBe(335);

  await page.getByRole('button', { name: 'Sat 24' }).click();
  await expect(head).toHaveText(/Sat 24 · 316 parties/);
  await expect(page).toHaveURL(/d=24/);
  await expect.poll(badges).toBe(316);

  // Charlotte Adigéry only plays on Friday: Saturday offers the other-day match.
  await page.getByRole('searchbox').fill('Charlotte');
  await expect(head).toHaveText(/Sat 24 · 0 parties/);
  await page.getByRole('button', { name: /1 more match on other days/ }).click();
  await expect(head).toHaveText(/All days · 1 party/);
  await expect(page.locator('.card').first()).toBeVisible();
  await expect(page.locator('.card .note').first()).toContainText('Charlotte');
});
