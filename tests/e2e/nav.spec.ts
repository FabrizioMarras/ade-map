import { expect, test, type Locator } from '@playwright/test';
import { ready } from './helpers';

test('bottom navigation: walk the four tabs on a phone', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ade2026.favs.v1', '[2892764,2863536]'));
  await page.goto('./#d=23');
  await ready(page);
  const nav = page.getByRole('navigation', { name: 'Main' });
  const tab = (name: string | RegExp) => nav.getByRole('button', { name });
  // The visible part of the sheet: its header, and its scroll area (sized to what is on screen).
  const sheetBottom = async () => {
    const boxes = [
      await page.locator('.sheet .grab').boundingBox(),
      await page.locator('.sheet .body').boundingBox(),
    ];
    return Math.max(...boxes.map((b) => (b ? b.y + b.height : 0)));
  };
  const navTop = async () => (await nav.boundingBox())!.y;

  // Map is active when nothing is open; the sheet sits above the bar; 44px targets.
  await expect(tab('Map')).toHaveAttribute('aria-current', 'page');
  for (const b of await nav.getByRole('button').all())
    expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // Collapsed, the sheet peeks with its title fully visible above the bar.
  const title = (await page.locator('.sheet-head h2').boundingBox())!;
  expect(title.y + title.height).toBeLessThanOrEqual(await navTop());
  // The map controls and the attribution stay above the bar.
  const ctl = page.getByRole('button', { name: 'Zoom to fit results' });
  expect((await ctl.boundingBox())!.y + (await ctl.boundingBox())!.height).toBeLessThanOrEqual(
    await navTop(),
  );
  await expect(page.getByRole('group', { name: 'Day' }).getByRole('button', { name: /My list/ })).toHaveCount(
    0,
  );

  // Parties: the day's list at half height, with the Parties/Venues toggle.
  await tab('Parties').click();
  await expect(tab('Parties')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.sheet-head h2')).toHaveText(/Fri 23 · 335 parties/);
  await expect(page.getByRole('group', { name: 'List view' })).toBeVisible();
  await expect.poll(async () => (await sheetBottom()) - (await navTop())).toBeLessThanOrEqual(2); // rounding, behind the bar's hairline

  // My list: favourites with the actions at the top; count badge on the tab.
  await tab('My list (2)').click();
  await expect(tab('My list (2)')).toHaveAttribute('aria-current', 'page');
  await expect(page).toHaveURL(/d=fav/);
  await expect(page.locator('.sheet-head h2')).toContainText('My list');
  const planBtn = page.getByRole('button', { name: 'Plan my night' });
  const firstCard = page.locator('.card').first();
  expect((await planBtn.boundingBox())!.y).toBeLessThan((await firstCard.boundingBox())!.y);

  // Parties again returns to the day that was shown before My list.
  await tab('Parties').click();
  await expect(page.locator('.sheet-head h2')).toHaveText(/Fri 23 · 335 parties/);

  // More: a short sheet over a scrim; the theme row cycles light → dark → auto.
  await tab('More').click();
  await expect(tab('More')).toHaveAttribute('aria-current', 'page');
  const more = page.getByRole('dialog', { name: 'More' });
  await expect(more).toContainText('Programme as of');
  await expect(more.getByRole('link', { name: /^Insights/ })).toHaveAttribute('href', './insights/');
  await expect(more.getByRole('link', { name: /^How to use the app/ })).toHaveAttribute('href', './help/');
  const theme = more.getByRole('button', { name: /^Theme/ });
  const val = theme.locator('.val');
  await expect(val).toHaveText(/^Auto \((light|dark) now\)$/);
  await theme.click();
  await expect(val).toHaveText('Light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await theme.click();
  await expect(val).toHaveText('Dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await theme.click();
  await expect(val).toHaveText(/^Auto/);
  await page.keyboard.press('Escape');
  await expect(more).toHaveCount(0);

  // Map while active: collapses the sheet and clears the selection.
  await page.goto('./#d=23&e=2892764');
  await ready(page);
  await expect(page.locator('.detail')).toBeVisible();
  await tab('Map').click();
  await expect(page.locator('.detail')).toHaveCount(0);
  await expect(tab('Map')).toHaveAttribute('aria-current', 'page');
  await expect(page).not.toHaveURL(/e=2892764/);
});

test('Pulse hides the tab bar', async ({ page }) => {
  await page.goto('./#d=23&p=1320');
  await expect(page.getByRole('slider', { name: 'Festival time' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
});

/** Exactly one item is highlighted, and it is `name`. */
async function expectActive(nav: Locator, name: string | RegExp) {
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(nav.getByRole('button', { name })).toHaveAttribute('aria-current', 'page');
}

test.describe('wide screen (1280×800)', () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

  test('three items at the top of the side panel: Parties by default, My list, More', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ade2026.favs.v1', '[2892764,2863536]'));
    await page.goto('./#d=23');
    await ready(page);
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('button')).toHaveText([/Parties/, /My list/, /More/]);
    const side = (await page.locator('.sheet').boundingBox())!;
    const box = (await nav.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(side.x);
    expect(box.x + box.width).toBeLessThanOrEqual(side.x + side.width + 1);
    expect(box.y).toBeLessThan(200);
    await expectActive(nav, 'Parties');
    await expect(page.locator('.sheet-head h2')).toHaveText(/Fri 23 · 335 parties/);

    await nav.getByRole('button', { name: /My list/ }).click();
    await expectActive(nav, /My list/);
    await expect(page.locator('.sheet-head h2')).toContainText('My list');
    await expect(page.locator('.card')).toHaveCount(2);

    // More: its content inside the panel, not a sheet over the map.
    await nav.getByRole('button', { name: 'More', exact: true }).click();
    await expectActive(nav, 'More');
    await expect(page.locator('.sheet-head h2')).toHaveText('More');
    await expect(page.locator('.sheet').getByRole('link', { name: /^Insights/ })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'More' })).toHaveCount(0);

    // A venue tapped on the map shows in the panel under Parties.
    await nav.getByRole('button', { name: 'Parties' }).click();
    await expectActive(nav, 'Parties');
    await expect(page.locator('.sheet-head h2')).toHaveText(/Fri 23 · 335 parties/);
  });
});

test.describe('phone (390×844)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('four tabs; Map after opening a party collapses the sheet and highlights Map', async ({ page }) => {
    await page.goto('./#d=23');
    await ready(page);
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('button')).toHaveText([/Map/, /Parties/, /My list/, /More/]);
    await expectActive(nav, 'Map');

    await nav.getByRole('button', { name: 'Parties' }).click();
    await expectActive(nav, 'Parties');
    await page.locator('.card .main').first().click();
    await expect(page.locator('.detail')).toBeVisible();
    await expectActive(nav, 'Parties'); // opened from the list, not the map

    await nav.getByRole('button', { name: 'Map' }).click();
    await expect(page.locator('.detail')).toHaveCount(0);
    await expectActive(nav, 'Map');
    await expect
      .poll(async () => (await page.locator('.sheet .body').boundingBox())?.height ?? 0)
      .toBeLessThan(60); // collapsed: only the peek

    // The active tab again: Parties collapses the list, More closes.
    await nav.getByRole('button', { name: 'Parties' }).click();
    await expectActive(nav, 'Parties');
    await nav.getByRole('button', { name: 'Parties' }).click();
    await expectActive(nav, 'Map');
    await nav.getByRole('button', { name: 'More', exact: true }).click();
    await expectActive(nav, 'More');
    await nav.getByRole('button', { name: 'More', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'More' })).toHaveCount(0);
    await expectActive(nav, 'Map');

    // A deep link to My list opens on the My list tab.
    await page.goto('./#d=fav');
    await page.reload();
    await expectActive(nav, /My list/);
  });
});
