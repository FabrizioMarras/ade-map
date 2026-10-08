import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ready } from './helpers';

const audit = (page: import('@playwright/test').Page) =>
  new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // The map canvas and its tile labels are not part of the DOM audit.
    .exclude('.maplibregl-canvas-container')
    .analyze();

for (const theme of ['light', 'dark'] as const) {
  test(`no axe violations (${theme})`, async ({ page }) => {
    test.setTimeout(60_000); // four full-page audits
    await page.addInitScript((t) => localStorage.setItem('ade2026.theme.v1', JSON.stringify(t)), theme);
    await page.clock.setFixedTime(new Date('2026-10-23T10:00:00Z'));
    await page.goto('./#d=23');
    await ready(page);
    await page.getByRole('button', { name: 'Expand panel' }).click();

    const views: [string, () => Promise<void>][] = [
      ['list', async () => {}],
      ['detail', () => page.locator('.card .main').first().click()],
      ['venue', () => page.locator('.detail .venue').click()],
    ];
    for (const [name, open] of views) {
      await open();
      const { violations } = await audit(page);
      expect(violations.map((v) => `${name}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`)).toEqual([]);
    }

    await page.getByRole('button', { name: /^Filters/ }).click();
    const { violations } = await audit(page);
    expect(violations.map((v) => `filters: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`)).toEqual([]);
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`insights page has no axe violations (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('ade2026.theme.v1', JSON.stringify(t)), theme);
    await page.goto('./insights/');
    await expect(page.locator('section.card')).toHaveCount(6);
    await page.getByText('Show table').first().click();
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.map((v) => `${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`)).toEqual([]);
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`map guide has no axe violations (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('ade2026.theme.v1', JSON.stringify(t)), theme);
    await page.goto('./help/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.map((v) => `${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`)).toEqual([]);
  });
}
