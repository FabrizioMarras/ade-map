import { expect, type Page } from '@playwright/test';

type W = Window & { __adeMap?: import('maplibre-gl').Map };

/** Wait until the map has drawn the venue pins. */
export async function ready(page: Page) {
  await expect(page.locator('.sheet-head h2')).not.toHaveText(/Loading/);
  await page.waitForFunction(() => {
    const m = (window as W).__adeMap;
    return !!m && !!m.getLayer('pins') && m.querySourceFeatures('venues').length > 0 && !m.isMoving();
  });
}

/** Screen position of a venue pin. */
export async function pinPoint(page: Page, lngLat: [number, number]) {
  return page.evaluate((c) => {
    const p = (window as W).__adeMap!.project(c);
    return { x: p.x, y: p.y };
  }, lngLat);
}

export async function jumpTo(page: Page, lngLat: [number, number], zoom: number) {
  // Wait for 'idle' (tiles and pins drawn at the new view), not a fixed delay: slower
  // machines (CI) need longer before taps can hit the pins.
  await page.evaluate(
    ([c, z]) =>
      new Promise<void>((resolve) => {
        const m = (window as W).__adeMap!;
        m.once('idle', () => resolve());
        m.jumpTo({ center: c as [number, number], zoom: z as number });
      }),
    [lngLat, zoom] as const,
  );
}
