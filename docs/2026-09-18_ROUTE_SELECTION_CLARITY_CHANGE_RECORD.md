# Route Selection Clarity Change Record — 2026-09-18

## Classification

Level 2 — normal runtime fix.

## Problem

An operator reported that the paper/workbook route still showed the correct Google-optimized order while the Build Route screen later appeared jumbled. The same symptom had been easy to repeat on another route.

Production evidence available during diagnosis showed that the most recent workbook route-order artifact was a `google_optimized` Google route and that the saved Google route in the contemporaneous FMR backup had the same ordered route IDs. The backup also retained a separate Basic route in a different, `not_optimized` order.

The Build Route UI made this confusion easy:
- the Basic optimizer button was labeled only **Optimize Route**;
- pressing that button immediately activated the Basic slot before prerequisite checks or optimization finished;
- the route selector did not include optimization state in its option labels;
- switching from an optimized route to an unoptimized saved route required no confirmation.

The evidence supports route-slot confusion rather than corruption of the saved Google route.

## Approved scope

Make route identity and state obvious and prevent an accidental Basic action from immediately replacing the displayed Google route.

Owning runtime files:
- `index.html`
- `app.js`

Focused regression files:
- `tests/route-optimizer-status.test.js`
- `tests/google-route-ui.test.js`
- `tests/phase-2h-c-planner-presentation.test.js`

## Runtime changes

1. Rename the two optimizer controls to **Optimize Basic Route** and **Optimize Google Route**.
2. Do not activate the Basic route merely because Basic optimization was pressed. The Basic slot is read and prepared without changing the displayed route; Basic becomes active only after optimization succeeds.
3. Show the saved route state directly in the route selector, for example **Google Route — Optimized** and **Basic Route — Not Optimized**.
4. When the displayed route is optimized or manually changed, require confirmation before switching to an unoptimized saved route.
5. Make successful Basic optimization say that Basic was selected and the Google route was kept.
6. Advance the `app.js` browser cache pin so the published UI receives the fix.

## Protected behavior

This change does not alter either routing algorithm, Google Route Optimization requests/results, route-history schema, multi-Day assignment logic, workbook handoff schemas, Drive identity/permissions, or address/pin/gig/pay/completion data.

Both saved route slots remain available. The operator can still deliberately switch to an unoptimized route after confirming the warning.

## Risk

The only intended additional friction is a confirmation when switching from a prepared route to an unoptimized saved route. Switching between prepared routes remains immediate.

## Focused verification

Focused tests must prove the explicit button names, delayed Basic activation, route-state labels, guarded optimized-to-unoptimized switching, cancel restoration, Basic preservation message, and cache pin.

## Final verification

Before merge:
- run the complete `npm test` suite once on the final runtime head;
- run required first-party JavaScript syntax checks;
- execute the route-selector behavioral smoke test against the real `app.js` helper/handler path.

The behavioral smoke uses Node's VM with a minimal route-selector DOM harness. It exercises the real route-choice functions and change handler rather than duplicating their logic: an optimized Google route plus a differently ordered unoptimized Basic route, cancel preserving the Google order, deliberate confirmation switching to Basic, and prepared-to-prepared switching without unnecessary confirmation.

## Smoke check

Using a route with a saved Google Optimized order and a different Basic Not Optimized order:
1. confirm the selector identifies Google as Optimized and Basic as Not Optimized;
2. choose Basic and confirm the warning appears before the displayed route changes;
3. cancel and confirm the Google order remains displayed;
4. intentionally press **Optimize Basic Route** and, if preparation fails, confirm the displayed Google route remains unchanged;
5. after successful Basic optimization, confirm Basic becomes selected and the status states that Google was kept;
6. switch back to Google and confirm its original optimized order is unchanged.

## Rollback

Pre-change production source baseline: `e6a0bc301517dadda9f3c454c3de1c95d1e831ce`.

Rollback is to revert this Level 2 branch/merge. No data migration or Drive cleanup is required.
