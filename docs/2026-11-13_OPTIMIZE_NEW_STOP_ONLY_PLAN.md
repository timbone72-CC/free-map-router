# Free Map Router — Optimize New Stop Only

**Date:** 2026-11-13  
**Status:** Draft implementation plan only — no runtime feature released  
**Plan change:** Level 1 documentation. **Future implementation:** likely Level 3 because it adds an optimization mode and changes optimizer backend behavior; confirm risk classification before coding.  
**Base:** `main` at `03a6a63bc115964f64ecdd760364fcff515a504d`.

## Operator need and acceptance contract

An existing route may have ten saved stops in an intentional order. The operator must be able to add **one new address**, ask Google to find the best insertion position, and keep the other ten in their **original relative order**.

Example:

- Before: Home → A → B → C → D → Home.
- After:  Home → A → B → **NEW** → C → D → Home.
- Forbidden: Home → B → A → NEW → C → D → Home.

Only the inserted stop may change the list's membership/position; the old stop sequence must be an identical subsequence of the resulting route. Recomputed arrival times and driving totals may change. Home stays the start/end.

This is **not** the existing full-route `Optimize Google Route`, which may reorder every stop.

## Smallest operator flow (proposed)

1. Open an already built Google Route (or the active Day's Google Route in a multi-day plan).
2. Choose **Add / insert a saved address** using the existing address source; exactly one new physical stop is selected for this action.
3. Select **Optimize New Stop Only**; the app obtains a Google calculation with all pre-existing stop pairs locked in their original order.
4. If valid, apply exactly the one-stop insertion to the Google Route and recalculate route schedule/metrics. If unavailable, stale, infeasible or rejected, explain why and **leave the existing route unchanged**.

No auto-run merely from typing an address. No change to the existing regular Optimize button. Detailed final control placement belongs to the owning Build Route UI and should stay compact on phone.

## Technical outline to prove before build

- **Read-only inputs:** the selected Google route snapshot, exact stop IDs, active Day identity/revision, Home, service durations, route date/departure/Home By constraints, and chosen new stop's address/pin.
- **Possible Google method:** Route Optimization API `ShipmentModel.precedenceRules` can constrain each existing stop to precede the next one while leaving the new stop unconstrained; Google determines the new position. Google's documented warning: precedence constraints can reject large shipment problems. Validate the method with a realistic fixture and identify size limitations, not just a synthetic two-stop proof.
- Preserve the existing authenticated Google backend and full-optimization path. If implementation adds an optional `insert_one` mode, ensure the existing request shape remains backward-compatible and no Google permission changes are implicit.
- **Server/client output gate:** response must contain the exact old stop IDs once, in their same order, plus exactly one chosen new stop ID. It must not drop, duplicate, reassign, complete, or silently reorder any work item; fail closed otherwise.
- **Staleness gate:** route IDs, route/Day revision, Home, work timing, chosen new stop and relevant preferences must match the start-of-calculation snapshot before saving. Concurrent edits reject rather than overwrite newer work.
- **Save boundary:** write only the selected active Day's Google Route after validation, using the existing route persistence owner. The Basic Route, other Days, pending import, saved address identities, corrected pins, and workbook handoff remain untouched. No automatic Drive backup or workbook send.
- If the chosen address is already in the route, show that it is already present; do not duplicate the physical stop. Multiple exact work orders at one physical address must remain attached.
- Existing workday timing constraints must either be honored or the calculation must report it cannot fit; do not silently turn off Home By or alter the selected route date.
- When the Avoid tolls preference is successfully released again, use the remembered choice consistently for this mode. **Do not assume the rolled-back preference is currently active.**

**Google reference:** https://developers.google.com/maps/documentation/route-optimization/reference/rest/v1/ShipmentModel (see `precedenceRules` and its size limitation).

## Focused acceptance checks before any release

- Insert at beginning, middle and end while preserving original stop relative order.
- Preserve each stop ID, exact Order ID / Gig ID mapping, corrections and manual pins; handle a shared physical address without duplicate stops.
- The active Day changes alone; other Day, Basic route, saved work and pending route remain unchanged.
- Handle one-stop / empty route boundaries, large-route constraint rejection, unlocatable address, Google timeout, invalid response and infeasible Home By safely.
- Change the route while the Google request is pending: reject the stale result without overwriting anything.
- Verify the final displayed route, Google navigation order, route metrics and the existing explicit workbook send path (no automatic handoff).
- Run focused tests while developing; run one final full suite and syntax checks on the exact runtime head plus one relevant route smoke check, following `TESTING_CONTRACT.md`.

## Release dependency — existing Google optimizer failure

**Tracking issue: #141** — https://github.com/timbone72-CC/free-map-router/issues/141

- PR #140 implemented remembered Avoid tolls ON/OFF and passed 561 automated tests, but Google Cloud Build `53382c2c-b60d-473c-974c-7eaf6613c03d` failed. Failure cause has **not been established**.
- Failed build: https://console.cloud.google.com/cloud-build/builds/53382c2c-b60d-473c-974c-7eaf6613c03d?project=170117881136
- Main was restored by `03a6a63bc115964f64ecdd760364fcff515a504d`; the unshipped toll work remains on `feature/remember-avoid-tolls-safe-refresh-20261111`.
- **Before shipping Optimize New Stop Only:** separately inspect the actual Cloud Build log, fix the confirmed build cause, successfully deploy the existing optimizer backend, and confirm its real path is healthy. Do not assume an automated unit test proves a cloud deployment.
- Keep the deployment investigation and the new-stop mode in **separate code changes**. Do not merge untested feature code or overwrite the working app just to make the feature appear present.

## Scope boundaries

This document **does not** change runtime code, deploy, fix Cloud Build, run a paid Google calculation, update workbook files, or request a merge. The operator has authorized drafting the plan. Implement one bounded piece after the existing deployment blocker is resolved or safely isolated.
