import { expect, test } from '@playwright/test';
import { pins, ready } from './helpers';

const REMBRANDTPLEIN = { latitude: 52.3662, longitude: 4.8966 };

test.describe('Plan B with a location at Rembrandtplein on Fri 23:30', () => {
  test.use({ geolocation: REMBRANDTPLEIN, permissions: ['geolocation'] });

  test('lists nearby parties on now, sorted by walking time', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-23T21:30:00Z')); // Fri 23:30 Amsterdam
    await page.goto('./#d=23');
    await ready(page);
    await page.getByRole('button', { name: /^Plan B/ }).click();

    const head = page.locator('.sheet-head h2');
    await expect(head).toContainText('Plan B');
    await expect(head).toContainText(/\d+ parties within 15 min walk/);
    await expect(page.getByText('From your location')).toBeVisible();
    await expect(page.getByText(/Plan B works during ADE/)).toHaveCount(0);

    const notes = await page.locator('.planb .card .note').allTextContents();
    expect(notes.length).toBeGreaterThan(3);
    const minutes = notes.map((n) => Number(n.match(/^(\d+) min walk/)![1]));
    expect(minutes.every((m) => m <= 15)).toBe(true);
    // Sorted by 5-minute walking band.
    const bands = minutes.map((m) => Math.floor((m - 1) / 5));
    expect(bands).toEqual([...bands].sort((a, b) => a - b));
    expect(notes.every((n) => /on now|starts \d\d:\d\d/.test(n))).toBe(true);

    // Pins outside the result set fade; result venues stay bright.
    const all = await pins(page);
    const pinState = {
      faded: all.filter((p) => p.dim).length,
      bright: all.filter((p) => !p.dim).flatMap((p) => p.names),
    };
    expect(pinState.faded).toBeGreaterThan(100);
    const venues = new Set(await page.locator('.planb .card .venue').allTextContents());
    // Every listed venue is lit (a shared-spot pin may also name neighbours with nothing on).
    for (const v of venues) expect(pinState.bright).toContain(v);

    await page.getByRole('button', { name: 'Close Plan B' }).click();
    await expect(head).toHaveText(/Fri 23 · 335 parties/);
  });
});

test('outside the festival Plan B previews Fri 23:30 from the map centre', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-08T12:00:00Z'));
  await page.goto('./#d=23');
  await ready(page);
  await page.getByRole('button', { name: /^Plan B/ }).click();
  await expect(page.getByText(/Plan B works during ADE, 21–25 Oct/)).toBeVisible();
  await expect(page.getByText(/From the map centre/)).toBeVisible();
  await expect(page.locator('.planb .card').first()).toBeVisible();
});
