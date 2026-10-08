import { expect, test } from '@playwright/test';
import { encodeList } from '../../src/lib/share';
import { ready } from './helpers';

test('party and venue links open on the right day', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-08T12:00:00Z')); // default day would be Wed 21
  await page.goto('./#e=2804807'); // Gashouder Presents: Job Jobse, Fri 23
  await expect(page.locator('.detail .title')).toContainText('Job Jobse');
  await expect(page.getByRole('button', { name: 'Fri 23' })).toHaveAttribute('aria-pressed', 'true');

  await page.goto('./#v=1576'); // Paradiso has parties on Wed 21
  await ready(page);
  await expect(page.locator('.sheet-head h2')).toContainText('Paradiso');
  await expect(page.locator('.venue .card').first()).toBeVisible();
});

test('Share uses the share sheet when available, with a stable party link', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __shared: unknown[] }).__shared = [];
    navigator.share = async (d?: ShareData) => {
      (window as unknown as { __shared: unknown[] }).__shared.push(d);
    };
  });
  await page.goto('./#d=21&e=2843412');
  await page.getByRole('button', { name: 'Share' }).click();
  const shared = await page.evaluate(() => (window as unknown as { __shared: ShareData[] }).__shared);
  expect(shared).toHaveLength(1);
  expect(shared[0].url).toMatch(/#e=2843412$/);
  expect(shared[0].title).toContain('313X020');
});

test('Copy link copies to the clipboard when there is no share sheet', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => {
    // @ts-expect-error — simulate a browser without the Web Share API
    delete Navigator.prototype.share;
  });
  await page.goto('./#d=23&v=1576');
  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Link copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/#v=1576$/);
});

test('a shared list opens with a banner and can be saved to My list', async ({ page }) => {
  const ids = [2843412, 2804807, 2861728];
  await page.goto(`./#list=${encodeList(ids)}`);
  await ready(page);
  const banner = page.getByRole('region', { name: 'Shared list' });
  await expect(banner).toContainText('Shared list · 3 parties');
  await expect(page.locator('.sheet-head h2')).toContainText('Shared list');
  await expect(page.locator('.card')).toHaveCount(3);

  // "Just look" hides the banner but keeps the list on screen.
  await page.getByRole('button', { name: 'Just look' }).click();
  await expect(banner).toHaveCount(0);
  await expect(page.locator('.card')).toHaveCount(3);

  // Reloading the link shows the banner again; saving merges into My list.
  await page.reload();
  await page.getByRole('button', { name: 'Save to my list' }).click();
  await expect(page.getByRole('button', { name: 'My list (3)' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status').filter({ hasText: 'Added 3 parties' })).toBeVisible();

  // Saving the same list again adds nothing (no duplicates).
  await page.goto(`./#list=${encodeList(ids)}&by=Fabrizio`); // an old link with a name still opens
  await expect(banner).toContainText('Shared list · 3 parties');
  await page.getByRole('button', { name: 'Save to my list' }).click();
  await expect(page.getByRole('button', { name: 'My list (3)' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Added 0 parties' })).toBeVisible();
});

test('Share list opens the share sheet on the first tap, with a #list= link and no name', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('ade2026.favs.v1', JSON.stringify([2843412, 2804807]));
    (window as unknown as { __shared: unknown[] }).__shared = [];
    // Real share sheets refuse calls without a live tap (user activation): record it.
    navigator.share = async (d?: ShareData) => {
      (window as unknown as { __shared: unknown[] }).__shared.push({
        ...d,
        activated: navigator.userActivation?.isActive ?? true,
      });
    };
  });
  let dialogs = 0;
  page.on('dialog', (d) => ((dialogs += 1), d.dismiss()));
  await page.goto('./#d=fav');
  await ready(page);
  await page.getByRole('button', { name: 'Expand panel' }).click();

  await page.getByRole('button', { name: 'Share list' }).click(); // one tap
  const shared = await page.evaluate(
    () => (window as unknown as { __shared: (ShareData & { activated: boolean })[] }).__shared,
  );
  expect(shared).toHaveLength(1);
  expect(shared[0].activated).toBe(true); // called inside the tap, nothing awaited first
  expect(dialogs).toBe(0);
  expect(shared[0].title).toBe('Shared list');
  expect(shared[0].url).toMatch(/#list=[A-Za-z0-9_-]+$/);

  // Opening the link (in a fresh browser) shows the same two parties.
  const other = await page.context().browser()!.newPage();
  await other.goto(shared[0].url!.replace(/^https?:\/\/[^/]+\/[^#]*/, 'http://localhost:4173/'));
  await expect(other.getByRole('region', { name: 'Shared list' })).toContainText('Shared list · 2 parties');
  await other.close();
});

test('Export and Import use inline fields, not pop-ups', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => localStorage.setItem('ade2026.favs.v1', JSON.stringify([2843412, 2804807])));
  let dialogs = 0;
  page.on('dialog', (d) => ((dialogs += 1), d.dismiss()));
  await page.goto('./#d=fav');
  await ready(page);
  await page.getByRole('button', { name: 'Expand panel' }).click();

  await page.getByRole('button', { name: 'Export list' }).click();
  const field = page.getByLabel(/Your list as text/);
  await expect(field).toHaveValue('ADE2026-FAVS:2804807,2843412');
  await page.getByRole('button', { name: 'Copy', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('ADE2026-FAVS:2804807,2843412');

  await page.getByRole('button', { name: 'Import list' }).click();
  await page.getByLabel(/Paste an exported list/).fill('ADE2026-FAVS:2861728,2843412');
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByRole('button', { name: 'My list (3)' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Added 1 party' })).toBeVisible();
  expect(dialogs).toBe(0);
});
