# Free Map Router — standalone address stops in active-Day workbook return

Date: 2026-11-07
Status: DRAFT branch only. NOT merged, published, or tested against live Drive.
Classification: Level 3 — cross-application return contract extension.
Rollback baseline: `main` at `5b2290f4c7feac127fca3d66cb543d78cc5a22d0`.

## Problem and evidence

An address added directly to FMR (`12261 US-283, Sayre, OK`) appeared on the displayed Google route and in Google Maps but was absent from InspectorADE Google Print. The active-Day producer in `route-order.js` omitted any stop without `orderIds` or `gigIds`, even though the saved Day snapshot contained that physical stop. The receiver independently rejected any identity-free stop. This is separate from any unexpected Print checkboxes or cancelled/duplicate work orders.

## User-approved minimal behavior

When the operator explicitly clicks **Send Route Order to Workbook**, the selected displayed active Day's Google or Basic route is sent as physical stops, in the exact displayed order, including address-only stops. Each address-only entry carries the original visible stop number and the real address, with empty `orderIds` and no invented `gigIds`. InspectorADE companion prints these as address-only cards without creating `Job_Log` or `Gig_Log` rows. Work-item counts remain the count of real matched Order IDs and Gig IDs, not route stops.

Legacy v1 behavior is unchanged. Active-Day v2 is extended in a backward-compatible form: existing fields, file name, route scope and version are unchanged, but both real identity arrays may be empty for an address-only stop. The **workbook receiver must be staged, validated, and deployed before this FMR producer**; older receivers reject the new stop shape.

## Operator-to-consumer path and state/file boundaries

1. FMR saved address → selected active Route Plan Day Google/Basic snapshot containing stop ID.
2. Displayed Build Route stop list → `route-order-ui.js` reads the saved stop address and exact ordered stop IDs.
3. `route-order.js` validates the displayed ID order equals the active Day snapshot, then builds one v2 object containing **all** physical stops and the real Order ID / Gig ID arrays.
4. Explicit Send → existing Google Drive `Free Map Router Route Order.json` JSON write. If routed manual gigs exist, existing matching `Free Map Router Gig Handoff.json` is written first as today.
5. InspectorADE PR #44 v2 receiver validates the exact file, collects address-only stops, updates only matched workbook `Job_Log.Stop` and `Print Order` values, and renders the existing `InspectorADE Daily Field Notes — Current` Google Doc in physical stop order.

The handoff file is transient route context; FMR retains owner of saved addresses and all Route Plan Days.

## Ownership, reads and writes

Files:
- `route-order.js`: only v2 `buildActiveDayStops()` behavior, v1 unchanged.
- `route-order-ui.js`: route-send success summary shows physical stop count distinct from real work-item count.
- `index.html`: cache pins for the above modules only.
- `tests/phase-2j-active-day-route-order.test.js`: real Route History, Day planning, Send-control and serialized artifact checks.
- `CONTRACT.md`, `INTEGRATION_CONTRACT.md`, `REGRESSION_CHECKLIST.md`: contract/regression update.

Reads existing local saved stops, route-history v7 and displayed active-Day list. Existing explicit Drive route-order write is unchanged in name, authentication, permissions, request schedule and trigger. No automatic/background writes, new API scope, storage schema, new destination, ID inference, or route optimization changes.

## Safety gates

Required: valid displayed active Day Route Plan, stop IDs, a nonblank real saved address at every displayed stop, exact real Order/Gig IDs on work stops. Optional: both work identity arrays may be empty **v2 only**. Source timestamp remains required whenever InspectorADE work is present. All existing stale source, duplicate ID, Plan Day, source timestamp and displayed-order checks apply. Duplicate explicit destination file and Drive authorization behavior remain unchanged. No added route-stop hard limit.

Recovery: if the address is missing or the displayed route is stale, refuse before any Drive write. If the receive fails, do not assert that print was updated; resending is explicit only. Do not insert fake work data. Rollback by closing/reverting the FMR branch before merge; if a later published version must be rolled back, restore the prior main build following published deployment procedures and keep the workbook receiver backward compatible.

## Verification checklist (current status)

- Focused FMR tests: `node --test tests/phase-2j-active-day-route-order.test.js` — pending CI.
- FMR complete `npm test` and first-party `node --check` on final runtime head — pending.
- Workbook PR #44 Node regression suite previously passed 521/521 on receiver branch (not a live Drive test).
- Cross-system reality gate: inspect the actual JSON serialized by the real FMR Send path for Sayre; confirm v2 validation and printed-card resolution in the InspectorADE receiver; verify correct active Day/physical-stop numbers, real work identity preservation and Print selection independence. Workbook Sandbox might share the FMR live handoff folder; **no shared Drive write until isolated prerequisites are proven and approved**.
- Receiver first: the workbook companion PR #44 must be validated and deployed before FMR publishes this new shape.
- Explicit Level 3 operator pre-merge approval is still required; this request authorizes implementation and verification only, not live merge, production `clasp push` or publication.
