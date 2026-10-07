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

```sh
npm run data:refresh            # list API → event pages → PDOK geocoding → public/data/*
npm run data:refresh -- --refresh   # ignore the 12 h page cache
```

Raw responses are cached in `scripts/.cache/` (event pages are reused for 12 h; the ADE site sends
no ETag). The build prints a validation report and a diff against the previous data. Venues PDOK
can't resolve keep their previous coordinates if the address is unchanged; otherwise add them to
`scripts/manual-fixes.json`.

`public/data/ade-2026.json` is the full dataset; the app loads `ade-2026.core.json` (no
descriptions) first and `ade-2026.text.json` in the background. `basemap.json` is only used when
the OpenFreeMap style can't load.

## Deploy

Push to `main`: the GitHub Actions workflow lints, tests and deploys `dist/` to GitHub Pages
(enable Pages → "GitHub Actions" in the repository settings). The build uses relative paths, so
any sub-path works. HTTPS is required for the service worker and geolocation.

## Credits

Programme data © Amsterdam Dance Event, used for personal planning only. Geocoding: PDOK
Locatieserver (Kadaster). Map data © OpenStreetMap contributors (ODbL); tiles by OpenFreeMap.
