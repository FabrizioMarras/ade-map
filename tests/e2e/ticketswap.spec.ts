import { expect, test } from '@playwright/test';
import { ready } from './helpers';

const SEARCH = 'https://www.ticketswap.com/search?query=';

test('sold-out party links to TicketSwap instead of a disabled button', async ({ page }) => {
  await page.goto('./#d=23&e=2804807'); // Gashouder Presents: Job Jobse — sold out
  const btn = page.getByRole('link', { name: 'Check TicketSwap' });
  await expect(btn).toHaveAttribute('href', SEARCH + encodeURIComponent('Gashouder Presents: Job Jobse'));
  await expect(btn).toHaveAttribute('target', '_blank');
  await expect(page.getByText('Resale via TicketSwap · prices capped')).toBeVisible();
  await expect(page.getByRole('button', { name: /Sold out/ })).toHaveCount(0);
});

test('available party keeps its ticket button and adds a resale link', async ({ page }) => {
  await page.goto('./#d=21&e=2843412'); // 313X020 — tickets available
  await expect(page.getByRole('link', { name: 'Buy Tickets' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Resale on TicketSwap' })).toHaveAttribute(
    'href',
    new RegExp('^' + SEARCH.replace(/[?.]/g, '\\$&')),
  );
});

test('sold-out filter: hide, or keep visible with a TicketSwap badge', async ({ page }) => {
  await page.goto('./#d=23');
  await ready(page);
  const head = page.locator('.sheet-head h2');
  await expect(head).toHaveText(/Fri 23 · 335 parties/);

  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.getByRole('radio', { name: 'Hide sold out' }).click();
  await page.getByRole('button', { name: /^Show \d+ parties/ }).click();
  await expect(head).not.toHaveText(/335 parties/);

  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.getByRole('radio', { name: 'Sold out, check TicketSwap' }).click();
  await page.getByRole('button', { name: /^Show \d+ parties/ }).click();
  await expect(head).toHaveText(/Fri 23 · 335 parties/);
  await page.getByRole('button', { name: 'Expand panel' }).click();
  await expect(page.locator('.tag.resale').first()).toHaveText('Sold out · TicketSwap');
  await expect(page.locator('.tag.soldout')).toHaveCount(0);
});
