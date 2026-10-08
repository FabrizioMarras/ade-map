import { expect, test } from '@playwright/test';

/*
 * The static pages must scroll with a finger. They broke when html and body both clipped sideways
 * with overflow-x: hidden: body became a scroll container of its own height, and the app's
 * overscroll-behavior: none stopped a swipe from reaching the page. (A synthetic touch gesture
 * shows it locally but is unreliable on headless CI, so this checks the cause directly.)
 */
for (const path of ['./insights/', './help/', './insights/help/']) {
  test(`touch scrolling is not blocked on ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const s = await page.evaluate(() => {
      const html = getComputedStyle(document.documentElement);
      const body = getComputedStyle(document.body);
      return {
        bodyOverflowY: body.overflowY,
        htmlOverflowY: html.overflowY,
        bodyOverscroll: body.overscrollBehaviorY,
        htmlOverscroll: html.overscrollBehaviorY,
        tall: document.documentElement.scrollHeight > innerHeight * 2,
        sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(s.bodyOverflowY, 'body must not be its own scroll container').toBe('visible');
    expect(['visible', 'auto', 'scroll']).toContain(s.htmlOverflowY);
    expect(s.bodyOverscroll).not.toBe('none');
    expect(s.htmlOverscroll).not.toBe('none');
    expect(s.tall).toBe(true);
    expect(s.sideways).toBeLessThanOrEqual(0);
    // The page itself scrolls (the window, not an inner box).
    await page.evaluate(() => window.scrollTo(0, 800));
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(500);
  });
}
