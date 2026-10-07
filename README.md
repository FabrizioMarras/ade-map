# ADE 2026 Map

Every Amsterdam Dance Event 2026 party on a phone-first map. Built from [PLAN.md](PLAN.md).

## Develop

```sh
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (Vitest)
npm run test:e2e     # Playwright smoke + a11y + offline tests (mobile viewport, builds first)
npm run lint && npm run check
```

## Refresh the programme

**Automatic.** `.github/workflows/refresh-data.yml` re-runs the pipeline every 2 hours during ADE
week (19–26 Oct, Amsterdam time) and once a day before it. Each run:

1. reads the programme list (new/removed events and sold-out flags, always fresh) and the event
   pages — every run for parties in the next 36 hours, about daily for the rest;
2. refuses to publish if the event count drops by more than 20 % (site change or failed fetch);
   the previous programme stays live and the run fails;
3. force-pushes the result to the `data` branch (one commit holding the current programme) and
   redeploys through the CI workflow.

The run summary lists added/removed events, new sell-outs and venues that couldn't be placed on
the map (add those to `scripts/manual-fixes.json`). Trigger a run by hand from the Actions tab
("Refresh programme" → Run workflow), with "force" if a large drop is genuine.

**Data on `main` is a test snapshot.** Unit and e2e tests run against `public/data` on `main`;
every deploy (code push or refresh) then overlays the latest programme from the `data` branch.
To work locally with the live programme: `git fetch origin data && git checkout FETCH_HEAD -- public/data`
(don't commit that on `main`).

**By hand:**

```sh
npm run data:refresh            # list API → event pages → PDOK geocoding → public/data/*
npm run data:refresh -- --refresh   # ignore the page cache
```

Raw responses are cached in `scripts/.cache/` (the ADE site sends no ETag). Venues PDOK can't
resolve keep their previous coordinates if the address is unchanged; otherwise add them to
`scripts/manual-fixes.json`.

`public/data/ade-2026.json` is the full dataset; the app loads `ade-2026.core.json` (no
descriptions) first and `ade-2026.text.json` in the background. `basemap.json` is only used when
the OpenFreeMap style can't load. The footer shows when the programme was last checked; the
"Updated programme" banner only appears when the content actually changed.

## Deploy

Push to `main`: the GitHub Actions workflow lints, tests and deploys `dist/` to GitHub Pages
(enable Pages → "GitHub Actions" in the repository settings). The build uses relative paths, so
any sub-path works. HTTPS is required for the service worker and geolocation.

## Credits

Programme data © Amsterdam Dance Event, used for personal planning only. Geocoding: PDOK
Locatieserver (Kadaster). Map data © OpenStreetMap contributors (ODbL); tiles by OpenFreeMap.
