import { expect, test } from '@playwright/test';

// A finger swipe must scroll the static pages (a mouse wheel scrolled them even when touch didn't).
for (const path of ['./insights/', './help/', './insights/help/']) {
  test(`touch scrolling works on ${path}`, async ({ page, context }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.synthesizeScrollGesture', {
      x: 200,
      y: 600,
      yDistance: -1200,
      speed: 3000,
      gestureSourceType: 'touch',
    });
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(500);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
