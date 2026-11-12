# Remember Avoid tolls — 2026-11-11

## Scope and approval

User requested one optional ON/OFF toll-avoidance switch that remembers the last
choice. Their routes avoid tolls, so an unset preference starts ON. The setting
belongs beside Google Optimize in FMR; the workbook receives the resulting order.

Level 2 normal routing option: use Google's existing vehicle route modifier,
without replacing the optimizer, adding permissions, changing deployment
configuration, or changing route-history/backup schemas. One new device setting
stores the last boolean, following the existing device-only Home By preference.
No workbook/router integration impact: no workbook code or handoff shape changes.

## Ownership and protection

- `settings.js`: reads/writes only `fmr_avoid_tolls`, initializes and binds its
  existing-page switch; default ON, both choices survive reload, save failure
  restores the last saved choice.
- `index.html`: one ON/OFF switch in the existing optimization area; refresh pins
  only for changed browser scripts.
- `app.js` / `routing.js`: pass the choice to every Google Maps section, export,
  Start Navigation and Done & Navigate Next link, preserving exact stop order.
- `google-route-browser.js`: capture the choice for both timed/untimed requests,
  include it in schedule freshness and in-flight change checks.
- `google-route-contract.js`, `google-route-server.js`,
  `google-route-provider.js`: validate the optional boolean, preserve it through
  address resolution, set `model.vehicles[0].routeModifiers.avoidTolls`, and
  acknowledge it in the response. Older requests without it keep their old shape;
  a response from an older backend cannot silently claim to have applied it.
- `/health` adds a read-only feature marker for backend deployment verification.

Switching changes only the preference and current link display; it never calls
Google, reorders or clears a saved route, changes days/assignments/completions,
changes workbook identifiers, or writes Drive. Re-optimization remains explicit.
The new preference is device-only and is not silently added to whole-app backups.

Google supports avoidance as a preference where reasonable, not an absolute
exclusion: https://developers.google.com/maps/documentation/route-optimization/reference/rest/v1/ShipmentModel#RouteModifiers
Navigation uses documented `avoid=tolls`:
https://developers.google.com/maps/documentation/urls/get-started#directions-action

## Validation and rollout

Focused checks must cover both persisted choices, real browser request → address
resolution → provider JSON → acknowledged response, timed and untimed requests,
old-backend/mismatched response rejection, in-flight choice changes, schedule
basis changes, every map section/navigation URL, and exact stop preservation.
Run final full suite and root JS syntax once in CI on final runtime head.
Inspect diff and publish by PR after passing checks. The frontend refuses an
unacknowledged choice during any Pages/backend rollout gap. Verify Pages switch
and backend `/health` feature marker after release. Real toll-area optimization
is an operator acceptance check; do not run paid provider calls automatically.

Base / rollback: `3069910be0e0213348ba57db933bbfd945d6a7dc`; revert this PR,
retaining the harmless device preference. No migrations or data cleanup.

## Pre-publication evidence

- 8 focused toll-option tests passed, including the real browser request through
  the request handler, address resolution and Google provider serializer with
  mocked network responses for both ON and OFF; no paid Google call was made.
- 95 existing affected settings, routing, Google contract/provider/browser,
  Workday, planner and multi-day return checks passed.
- Existing script-version assertions were refreshed only for changed files;
  the health check now expects the new read-only feature marker.
- Final complete regression/syntax gate will be supplied by CI on the final head.
