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

**Automatic.** `.github/workflows/refresh-data.yml` is scheduled every 30 minutes, but GitHub
delays and drops scheduled runs (they often arrive hours apart), so each run decides from the age
of the published programme whether to rebuild it (`scripts/refresh-due.mjs`): older than 20 h
before ADE week, older than 90 min from 19 to 26 Oct (Amsterdam time), never from 27 Oct. A
manual run always rebuilds. A rebuild:

1. reads the programme list (new/removed events and sold-out flags, always fresh) and the event
   pages — every run for parties in the next 36 hours, about daily for the rest;
2. refuses to publish if the event count drops by more than 20 % (site change or failed fetch);
   the previous programme stays live and the run fails;
3. force-pushes the result to the `data` branch (one commit holding the current programme) and
   redeploys through the CI workflow.

The run summary lists added/removed events, new sell-outs and venues that couldn't be placed on
the map (add those to `scripts/manual-fixes.json`). Trigger a run by hand from the Actions tab
("Refresh programme" → Run workflow), with "force" if a large drop is genuine.

**External trigger for ADE week.** To stop depending on GitHub's scheduler, have an outside cron
call the workflow's dispatch endpoint (a dispatch is a manual run, so it always rebuilds; every
60–90 minutes is plenty):

1. Create a fine-grained personal access token (GitHub → Settings → Developer settings →
   Fine-grained tokens) with access to **only** `FabrizioMarras/ade-map` and the single
   repository permission **Actions: Read and write**. Set it to expire after the festival
   (e.g. 31 Oct).
2. On [cron-job.org](https://cron-job.org) (or any scheduler), create a job running every
   60 minutes from 19 to 26 Oct:
   - URL: `https://api.github.com/repos/FabrizioMarras/ade-map/actions/workflows/refresh-data.yml/dispatches`
   - Method: `POST`
   - Headers: `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`,
     `X-GitHub-Api-Version: 2022-11-28`, `Content-Type: application/json`
   - Body: `{"ref":"main"}`

   A `204 No Content` response means the run was queued. The same call with curl:

   ```sh
   curl -X POST -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
     https://api.github.com/repos/FabrizioMarras/ade-map/actions/workflows/refresh-data.yml/dispatches \
     -d '{"ref":"main"}'
   ```

3. Disable the job (and let the token expire) after the festival.

During the festival (21–25 Oct) the app shows "Programme last updated N h ago" in the panel
header when the programme it shows is more than 6 hours old.

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
