import { expect, test } from '@playwright/test';
import { pins, ready } from './helpers';

test('searching an artist lists all their sets across the week and highlights the venues', async ({
  page,
}) => {
  await page.goto('./#d=21');
  await ready(page);
  await page.getByRole('searchbox').fill('dave clarke');

  const row = page.getByRole('region', { name: 'Artists' }).getByRole('button', { name: /Dave Clarke/ });
  await expect(row).toContainText(/\d+ sets/);
  const sets = Number((await row.locator('.sets').textContent())!.match(/\d+/)![0]);
  expect(sets).toBeGreaterThanOrEqual(2);
  await row.click();

  const head = page.locator('.sheet-head h2');
  await expect(head).toContainText('Dave Clarke');
  await expect(head).toContainText(`${sets} sets`);
  const cards = page.locator('.artist .card');
  await expect(cards).toHaveCount(sets);
  // Grouped by day, across more than one day (not limited to the selected Wed 21).
  expect(await page.locator('.artist .hour').count()).toBeGreaterThan(1);

  // Their venues are highlighted on the map; the rest fade.
  const venues = new Set(await cards.locator('.venue').allTextContents());
  await expect
    .poll(async () => {
      const lit = (await pins(page)).filter((p) => !p.dim).flatMap((p) => p.names);
      return [...venues].every((v) => lit.includes(v));
    })
    .toBe(true);

  // Open a set and come back to the artist.
  await cards.first().locator('.main').click();
  await expect(page.locator('.detail')).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(head).toContainText('Dave Clarke');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(head).not.toContainText('Dave Clarke');
});
