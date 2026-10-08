import { expect, test, type Locator, type Page } from '@playwright/test';
import { encodeList } from '../../src/lib/share';
import { ready } from './helpers';

/**
 * Wrapping check on a small phone (360×740): long party titles, the Plan B empty state, the
 * shared-list banner and a long toast. No horizontal page overflow, and no text cut off: every
 * text element lies inside the viewport and is not clipped by its own box.
 */
test.use({ viewport: { width: 360, height: 740 } });

async function expectNoClipping(page: Page, root: Locator) {
  await expect(root).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'horizontal page overflow').toBeLessThanOrEqual(0);
  const problems = await root.evaluate((el) => {
    const out: string[] = [];
    const vw = window.innerWidth;
    for (const node of [el, ...el.querySelectorAll('*')] as HTMLElement[]) {
      const hasText = [...node.childNodes].some((c) => c.nodeType === 3 && c.textContent!.trim());
      const style = getComputedStyle(node);
      if (!hasText || style.visibility === 'hidden' || style.display === 'none') continue;
      const r = node.getBoundingClientRect();
      if (!r.width) continue;
      const label = `${node.tagName.toLowerCase()}.${node.className} "${node.textContent!.trim().slice(0, 40)}"`;
      if (r.left < -0.5 || r.right > vw + 0.5) out.push(`outside the viewport: ${label}`);
      if (node.scrollWidth > node.clientWidth + 1 && style.overflowX !== 'visible')
        out.push(`clipped: ${label}`);
    }
    return out;
  });
  expect(problems).toEqual([]);
}

test('the party with the longest title wraps without clipping', async ({ page, request }) => {
  const core = await (await request.get('./data/ade-2026.core.json')).json();
  const longest = (core.events as { id: number; title: string }[]).reduce((a, b) =>
    b.title.length > a.title.length ? b : a,
  );
  await page.goto(`./#e=${longest.id}`);
  await ready(page);
  await expect(page.locator('.detail .title')).toHaveText(longest.title);
  await expectNoClipping(page, page.locator('.sheet'));
  // Its card in the day list too.
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('searchbox').fill(longest.title.slice(0, 40));
  await expect(page.locator('.card .title').first()).toHaveText(longest.title);
  await expectNoClipping(page, page.locator('.card').first());
});

test('a long toast stacks above the tab bar without clipping on a 360px phone', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await page.goto('./#d=23');
  await ready(page);

  // A location outside Amsterdam: a long toast (> 60 characters) above the tab bar.
  await context.setGeolocation({ latitude: 48.8566, longitude: 2.3522 });
  await page.getByRole('button', { name: /^Plan B/ }).click();
  const toast = page.locator('.toast').filter({ hasText: 'outside Amsterdam' });
  await expect(toast).toBeVisible();
  expect((await toast.textContent())!.length).toBeGreaterThan(60);
  await expectNoClipping(page, toast);
  const nav = (await page.getByRole('navigation', { name: 'Main' }).boundingBox())!;
  const box = (await toast.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(nav.y);
});

// A fresh page: the app accepts a cached position up to a minute old.
test('Plan B empty state and the shared-list banner fit a 360px phone', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await page.goto('./#d=23');
  await ready(page);

  // A corner of town with nothing in walking distance: the empty state and its action.
  await context.setGeolocation({ latitude: 52.445, longitude: 5.045 });
  await page.getByRole('button', { name: /^Plan B/ }).click();
  const empty = page.locator('.planb .empty');
  await expect(empty).toContainText('Nothing within 15 minutes');
  await expect(empty.getByRole('button', { name: 'Widen to 30 min' })).toBeVisible();
  await expectNoClipping(page, page.locator('.sheet'));

  // The shared-list banner.
  await page.goto(`./#list=${encodeList([2924545, 2892764, 2863536])}`);
  await page.reload(); // a new document, as when the link is opened
  await ready(page);
  const banner = page.getByRole('region', { name: 'Shared list' });
  await expect(banner).toContainText('Shared list · 3 parties');
  await expectNoClipping(page, page.locator('.sheet'));
});
