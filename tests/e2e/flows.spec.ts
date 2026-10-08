import { expect, test } from '@playwright/test';
import { jumpTo, pinPoint, pins, ready } from './helpers';

const PARADISO: [number, number] = [4.88394502, 52.36227745];

test.beforeEach(async ({ page }) => {
  // Freeze the clock inside the festival (Fri 23, 12:00 Amsterdam) for stable results.
  await page.clock.setFixedTime(new Date('2026-10-23T10:00:00Z'));
});

test('open → tap Paradiso → party → tickets → back', async ({ page, context }) => {
  await page.goto('./#d=23');
  await ready(page);
  await jumpTo(page, PARADISO, 16.5);
  const p = await pinPoint(page, PARADISO);
  await page.mouse.click(p.x, p.y);

  const head = page.locator('.sheet-head h2');
  await expect(head).toContainText('Paradiso');
  await expect(page).toHaveURL(/v=1576/);

  const cards = page.locator('.card .main');
  await expect(cards.first()).toBeVisible();
  const title = (await cards.first().locator('.title').textContent())!.trim();
  await cards.first().click();
  await expect(page.locator('.detail .title')).toHaveText(title);
  await expect(page).toHaveURL(/e=\d+/);

  const tickets = page.locator('.detail a.btn.primary');
  if (await tickets.count()) {
    await expect(tickets).toHaveAttribute('target', '_blank');
    // Answer the external ticket page locally so a slow ticket site can't stall the test.
    const href = (await tickets.getAttribute('href'))!;
    await context.route(href, (r) => r.fulfill({ contentType: 'text/html', body: '<title>tickets</title>' }));
    const [popup] = await Promise.all([context.waitForEvent('page'), tickets.click()]);
    await popup.waitForLoadState();
    expect(popup.url()).toBe(href);
    await popup.close();
  }

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(head).toContainText('Paradiso');
  await expect(page).not.toHaveURL(/e=/);
  await page.goBack();
  await expect(page.locator('.detail')).toHaveCount(0);
  await expect(head).not.toContainText('Paradiso');
});

test('deep link opens the party detail', async ({ page }) => {
  await page.goto('./#d=21&e=2843412');
  await expect(page.locator('.detail .title')).toContainText('313X020');
  await expect(page.locator('.detail .when')).toHaveText('Wed 21 · 14:00 → 23:30');
});

test('day switch updates counts; search finds line-up matches', async ({ page }) => {
  await page.goto('./#d=23');
  await ready(page);
  const head = page.locator('.sheet-head h2');
  await expect(head).toHaveText(/Fri 23 · 335 parties/);

  const badges = () =>
    page.evaluate(() => {
      const m = (window as unknown as { __adeMap: import('maplibre-gl').Map }).__adeMap;
      const src = m.getSource('venues') as unknown as { _data: { geojson?: GeoJSON.FeatureCollection } };
      const fc = (src._data.geojson ?? src._data) as GeoJSON.FeatureCollection;
      return fc.features.reduce((n, f) => n + (f.properties!.count as number), 0);
    });
  await expect.poll(badges).toBe(335);

  await page.getByRole('button', { name: 'Sat 24' }).click();
  await expect(head).toHaveText(/Sat 24 · 316 parties/);
  await expect(page).toHaveURL(/d=24/);
  await expect.poll(badges).toBe(316);

  // Charlotte Adigéry only plays on Friday: Saturday offers the other-day match.
  await page.getByRole('searchbox').fill('Charlotte');
  await expect(head).toHaveText(/Sat 24 · 0 parties/);
  await page.getByRole('button', { name: /1 more match on other days/ }).click();
  await expect(head).toHaveText(/All days · 1 party/);
  await expect(page.locator('.card').first()).toBeVisible();
  await expect(page.locator('.card .note').first()).toContainText('Charlotte');
});

test('list mode: grouped by hour, tap flies to pin and opens detail', async ({ page }) => {
  await page.goto('./#d=23');
  await ready(page);
  await page.getByRole('button', { name: 'Expand panel' }).click();
  await expect(page.locator('.hour').first()).toHaveText(/^\d\d:00/);
  await expect(page.locator('.hour.divider')).toContainText('After midnight');
  // Every Friday party is listed once in the hour groups.
  await expect(page.locator('.group:not(:has(.divider)) .card')).toHaveCount(335);

  const card = page.locator('.card .main').nth(10);
  const title = (await card.locator('.title').textContent())!.trim();
  await card.click();
  await expect(page.locator('.detail .title')).toHaveText(title);
  await page.waitForFunction(
    () => !(window as unknown as { __adeMap: import('maplibre-gl').Map }).__adeMap.isMoving(),
  );
  const zoom = await page.evaluate(() =>
    (window as unknown as { __adeMap: import('maplibre-gl').Map }).__adeMap.getZoom(),
  );
  expect(zoom).toBeGreaterThanOrEqual(15);

  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: /Venues list/ }).click();
  await expect(page.locator('.venues li').first()).toBeVisible();
});

test('lasso around Rembrandtplein lists only those venues', async ({ page }) => {
  const REMBRANDTPLEIN: [number, number] = [4.8966, 52.3662];
  await page.goto('./#d=23');
  await ready(page);
  await jumpTo(page, REMBRANDTPLEIN, 16);
  const c = await pinPoint(page, REMBRANDTPLEIN);

  const r = 80; // px, ≈ 90 m at zoom 16
  // Venues inside the circle, measured before drawing (the map re-frames the area afterwards).
  const insideNames = (await pins(page))
    .filter((p) => Math.hypot(p.x - c.x, p.y - c.y) <= r + 2)
    .flatMap((p) => p.names);

  await page.getByRole('button', { name: 'Select area' }).click();
  await expect(page.getByText('Draw around the area you want')).toBeVisible();
  await page.mouse.move(c.x + r, c.y);
  await page.mouse.down();
  for (let a = 0; a <= 2 * Math.PI + 0.01; a += Math.PI / 16) {
    await page.mouse.move(c.x + r * Math.cos(a), c.y + r * Math.sin(a), { steps: 2 });
  }
  await page.mouse.up();

  const head = page.locator('.sheet-head h2');
  await expect(head).toContainText('in this area');
  const venues = [...new Set(await page.locator('.card .venue').allTextContents())];
  expect(venues.length).toBeGreaterThan(0);
  for (const v of venues) expect(insideNames).toContain(v);

  // Changing the day re-evaluates the same area.
  const friText = await head.textContent();
  await page.getByRole('button', { name: 'Sat 24' }).click();
  await expect(head).toContainText('in this area');
  await expect(head).toContainText('Sat 24');
  expect(await head.textContent()).not.toBe(friText);

  await page.getByRole('button', { name: 'Clear area' }).first().click();
  await expect(head).toHaveText(/Sat 24 · 316 parties/);
});

test('favourites: star, My list with clash note, survives reload', async ({ page }) => {
  await page.goto('./#d=23');
  await ready(page);
  await page.getByRole('button', { name: 'Expand panel' }).click();
  // Two parties in the same hour group always overlap.
  const group = page.locator('.group').filter({ has: page.locator('.hour', { hasText: /^\s*22:00/ }) });
  const stars = group.locator('.card .star');
  await stars.nth(0).click();
  await stars.nth(1).click();
  await expect(stars.nth(0)).toHaveAttribute('aria-pressed', 'true');

  const myList = page.getByRole('button', { name: /My list/ });
  await expect(myList).toContainText('2');
  await myList.click();
  await expect(page).toHaveURL(/d=fav/);
  await expect(page.locator('.card')).toHaveCount(2);
  await expect(page.locator('.card .note').first()).toContainText('Clashes with');

  await page.reload();
  await expect(page.getByRole('button', { name: /My list/ })).toContainText('2');
  await page.getByRole('button', { name: 'Expand panel' }).click();
  await expect(page.locator('.card')).toHaveCount(2);

  // Un-star from the detail view.
  await page.locator('.card .main').first().click();
  await page.locator('.detail .star').click();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('.card')).toHaveCount(1);
});

test('search moves the map to the matching venues', async ({ page }) => {
  await page.goto('./#d=23');
  await ready(page);
  type W = Window & { __adeMap: import('maplibre-gl').Map };

  /** Matching venue pins (not faded), with their screen position. */
  const matches = () =>
    page.evaluate(() => {
      const m = (window as unknown as W).__adeMap;
      const src = m.getSource('venues') as unknown as { _data: { geojson?: GeoJSON.FeatureCollection } };
      const fc = (src._data.geojson ?? src._data) as GeoJSON.FeatureCollection;
      return fc.features
        .filter((f) => !f.properties!.dim)
        .map((f) => {
          const p = m.project((f.geometry as GeoJSON.Point).coordinates as [number, number]);
          return { name: f.properties!.name as string, x: p.x, y: p.y };
        });
    });
  // Wait past the 450 ms search debounce and the camera animation.
  const settled = async () => {
    await page.waitForTimeout(1200);
    await page.waitForFunction(() => !(window as unknown as W).__adeMap.isMoving());
  };
  const sheetTop = async () => (await page.locator('.sheet').boundingBox())!.y;

  // A single artist: the map flies to their venue and zooms in.
  await page.getByRole('searchbox').fill('Charlotte');
  await expect(page.locator('.card .note').first()).toContainText('Charlotte');
  const vp = page.viewportSize()!;
  // Polled: on a slow machine the fly-to may still be under way after the debounce.
  await expect
    .poll(
      async () => {
        const [p] = await matches();
        const zoom = await page.evaluate(() => (window as unknown as W).__adeMap.getZoom());
        return (
          p.name === 'Paradiso' &&
          p.x > 0 &&
          p.x < vp.width &&
          p.y > 100 &&
          p.y < (await sheetTop()) &&
          zoom >= 15
        );
      },
      { timeout: 10_000 },
    )
    .toBe(true);
  expect((await matches()).map((v) => v.name)).toEqual(['Paradiso']);

  // Several venues: all of them end up in the visible part of the map.
  await page.getByRole('searchbox').fill('techno');
  await settled();
  await expect
    .poll(
      async () => {
        const top = await sheetTop();
        const all = await matches();
        return all.length > 3 && all.every((v) => v.x >= 0 && v.x <= vp.width && v.y >= 0 && v.y <= top);
      },
      { timeout: 10_000 },
    )
    .toBe(true);
  const many = await matches();
  // Every match is highlighted, not only the selected venue.
  const hl = await page.evaluate(() => {
    const m = (window as unknown as W).__adeMap;
    const src = m.getSource('venues') as unknown as { _data: { geojson?: GeoJSON.FeatureCollection } };
    const fc = (src._data.geojson ?? src._data) as GeoJSON.FeatureCollection;
    return fc.features.filter((f) => f.properties!.hl).length;
  });
  expect(hl).toBe(many.length);
  expect(many.length).toBeGreaterThan(3);
  const top = await sheetTop();
  for (const v of many) {
    expect(v.x, v.name).toBeGreaterThanOrEqual(0);
    expect(v.x, v.name).toBeLessThanOrEqual(vp.width);
    expect(v.y, v.name).toBeGreaterThanOrEqual(0);
    expect(v.y, v.name).toBeLessThanOrEqual(top);
  }
});

test('a new search replaces the old one, even with a venue open', async ({ page }) => {
  await page.goto('./#d=23');
  await ready(page);
  const box = page.getByRole('searchbox');
  const head = page.locator('.sheet-head h2');

  await box.click();
  await page.keyboard.type('Charlotte');
  await expect(box).toHaveValue('Charlotte'); // no typed letter is swallowed by the selection
  await expect(page.locator('.card .note').first()).toContainText('Charlotte');

  // Open the matching venue.
  await page.getByRole('button', { name: /Venues list/ }).click();
  await page.locator('.venues button').first().click();
  await expect(head).toContainText('Paradiso');

  // Tapping the box selects the old text, so typing replaces it and closes the venue.
  await box.click();
  await page.keyboard.type('techno');
  await expect(box).toHaveValue('techno');
  await expect(head).toHaveText(/Fri 23 · \d+ parties/);
  await page.getByRole('button', { name: 'Parties list' }).click();
  expect(await page.locator('.card').count()).toBeGreaterThan(3);
});

test('lasso and box work with a finger (touch), and the map pans again afterwards', async ({
  page,
  context,
}) => {
  test.setTimeout(60_000); // many touch events; slow on CI runners
  await page.goto('./#d=23');
  await ready(page);
  const cdp = await context.newCDPSession(page);
  const touch = (type: string, pts: [number, number][]) =>
    cdp.send('Input.dispatchTouchEvent', {
      type: type as 'touchStart',
      touchPoints: pts.map(([x, y], id) => ({ x, y, id })),
    });
  const head = page.locator('.sheet-head h2');
  const center = () =>
    page.evaluate(() =>
      (window as unknown as { __adeMap: import('maplibre-gl').Map }).__adeMap.getCenter().toArray(),
    );
  const [cx, cy, r] = [206, 420, 90];

  for (const mode of ['Lasso', 'Box'] as const) {
    await page.getByRole('button', { name: 'Select area' }).tap();
    await page.locator('.hint button', { hasText: mode }).tap();
    if (mode === 'Box') {
      await touch('touchStart', [[cx - r, cy - r]]);
      for (let i = 1; i <= 15; i++)
        await touch('touchMove', [[cx - r + (2 * r * i) / 15, cy - r + (2 * r * i) / 15]]);
    } else {
      await touch('touchStart', [[cx + r, cy]]);
      for (let a = 0.2; a <= 2 * Math.PI + 0.01; a += 0.2) {
        await touch('touchMove', [[cx + r * Math.cos(a), cy + r * Math.sin(a)]]);
      }
    }
    await touch('touchEnd', []);
    await expect(head, mode).toContainText('in this area');
    await page.getByRole('button', { name: 'Clear area' }).first().tap();
    await expect(head).toHaveText(/Fri 23 · 335 parties/);
    await page.waitForFunction(
      () => !(window as unknown as { __adeMap: import('maplibre-gl').Map }).__adeMap.isMoving(),
    );
  }

  // Out of draw mode a one-finger drag pans the map again.
  const before = await center();
  await touch('touchStart', [[200, 400]]);
  for (let i = 1; i <= 10; i++) await touch('touchMove', [[200 + i * 10, 400 + i * 6]]);
  await touch('touchEnd', []);
  await page.waitForTimeout(800);
  expect(await center()).not.toEqual(before);
});

test('day chips: the days then All (My list is a tab), selected day scrolled into view', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-25T12:00:00Z')); // Sun 25 → opens on Sun 25
  await page.goto('./');
  await ready(page);
  const labels = await page
    .getByRole('group', { name: 'Day' })
    .getByRole('button')
    .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? e.textContent!.trim()));
  expect(labels).toEqual(['Wed 21', 'Thu 22', 'Fri 23', 'Sat 24', 'Sun 25', 'All']);

  const sun = page.getByRole('button', { name: 'Sun 25' });
  await expect(sun).toHaveAttribute('aria-pressed', 'true');
  await expect(sun).toBeInViewport({ ratio: 1 });
});

test('venues sharing one spot are one pin; tapping it opens the venue chooser', async ({ page }) => {
  const REMBRANDTPLEIN_17: [number, number] = [4.89665454, 52.36642208]; // Oliva, Three Sisters Pub, Escape deLux
  await page.goto('./#d=23');
  await ready(page);
  await jumpTo(page, REMBRANDTPLEIN_17, 17);
  const spot = (await pins(page)).find((p) => p.names.includes('Oliva'))!;
  // On Friday two of the three have parties: one pin for both.
  expect(spot.names.sort()).toEqual(['Oliva', 'Three Sisters Pub']);
  expect((await pins(page)).filter((p) => p.names.includes('Three Sisters Pub'))).toHaveLength(1);

  await page.mouse.click(spot.x, spot.y);
  await expect(page.locator('.sheet-head h2')).toContainText('Pick a venue');
  const rows = page.locator('.chooser .name');
  await expect(rows).toHaveText(['Oliva', 'Three Sisters Pub']);
  await rows.first().click();
  await expect(page.locator('.sheet-head h2')).toContainText('Oliva');
});
