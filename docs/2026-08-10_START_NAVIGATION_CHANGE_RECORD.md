# Start Navigation Change Record

## Level

Level 2 — normal Build Route interaction and Google Maps handoff.

## Problem and evidence

The stop-by-stop workflow has **Done & Navigate Next**, but no way to begin
navigation to the first displayed job. Using **Done & Navigate Next** first would
incorrectly treat that first job as already completed and remove it from the
active route.

## Approved behavior

- **Start Navigation** opens Google Maps driving navigation to the first
  displayed job.
- Starting navigation does not complete or remove that job, change route order,
  write route state, or schedule a Google Drive backup.
- After finishing the first job, **Done & Navigate Next** continues to remove
  only the completed job and navigate to the next job or Home.
- Navigation continues to use readable address text unless the destination has
  a protected manual pin.

## Scope and ownership

- `index.html` owns the new Build Route control, instructions, and app cache
  version.
- `app.js` owns the read-only start action, button state, and event wiring.
- `tests/done-navigate-next.test.js` protects the complete stop-by-stop start and
  advance boundary.

Read surfaces: Home, the ordered active route, and saved stops.

Write surfaces: the existing route-status message only. Route state, saved
stops, Home, pins, Current/Previous selection, and Drive are not written.

No workbook/router integration impact.

## Protected behavior

- **Done & Navigate Next** behavior remains unchanged.
- Google and free optimization remain unchanged.
- Numbered Google Maps sections and **Open in Google Maps** remain unchanged.
- Every saved address, protected pin, and Current/Previous Route remains intact.
- Garmin and Google Drive behavior remain unchanged.

## Risks and checks

Primary risks: opening the second job instead of the first, removing the first
job on Start, or creating an unintended save.

Focused test:

- `node --test tests/done-navigate-next.test.js`

Final gate: complete `npm test` suite and root JavaScript syntax checks once on
the final runtime head.

Affected smoke check:

1. Open **Build Route** with at least two ordered jobs.
2. Tap **Start Navigation** and confirm Google Maps opens the first job.
3. Return to Free Map Router and confirm the first job still appears first.
4. After finishing that job, tap **Done & Navigate Next** and confirm the first
   job is removed from Build Route and Google Maps opens the second job.

## Rollback

Known working pre-change commit: `15661c5`.
Revert this pull request to restore the prior Build Route controls.
