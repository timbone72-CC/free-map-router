# Phase 2H-A — Workday Context and Timing Controls Implementation Record

Date: 2026-09-04  
Change level: Level 3  
Governed design: `docs/PHASE_2H_TIME_AWARE_SINGLE_DAY_ROUTING_IMPACT_RECORD_2026-09-04.md`  
Governed baseline / rollback commit: `a4e819c1c93d529126bc21402ff45c6a5681dfa1`  
Status: IMPLEMENTATION IN PROGRESS  
Pre-merge operator approval: required after implementation and verification

## Exact scope

Implement Phase 2H-A only:

- Build Route controls for Route date, Departure, Preferred field-work finish, and Home by;
- local date/time/timezone normalization and validation;
- route-history version 6 with shared `dayContext` and reserved nullable snapshot `schedule`;
- whole-app backup version 4 preserving route-history v6;
- backward-compatible route-history and backup migration;
- focused regression coverage for the above.

## Explicitly excluded

- no Google `/optimize` request changes;
- no service-duration transmission to Google;
- no Google schedule/ETA response handling;
- no planner map/list redesign;
- no multi-day planning;
- no workbook repository or handoff schema changes;
- no Drive permission/file changes.

## Owning surfaces

Read/write:

- `route-history.js` — persisted named-route history and day context;
- `backup.js` — whole-app backup schema/migration;
- `app.js` — Build Route state/render/save behavior;
- `index.html` / `styles.css` — compact Build Route controls and appearance;
- focused tests for route history, backup, and Build Route behavior.

Read-only dependencies:

- Phase 2G work-item planning projection;
- existing Google/Basic route slots;
- Home and route identity state.

## Protected behavior

- Google and Basic route orders and identities remain unchanged by timing edits;
- exact workbook Order IDs / `Source_ID`s and manual `Gig_ID`s remain unchanged;
- Phase 2G planning remains unchanged;
- Home remains separate from route stops;
- Google request behavior remains unchanged;
- existing version-1/2/3 backups remain restorable;
- existing route-history v5 state migrates without route/order metadata loss;
- the app remains five pages.

## Required focused checks

- v5 route history -> v6 migration;
- exact day-context round trip;
- invalid home-by/departure rejection;
- invalid/nonexistent local time fail-closed;
- backup v4 round trip with planning + day context;
- v1/v2/v3 backup compatibility with no invented day context;
- timing edits do not alter route order/membership/optimizer status;
- starting a genuinely new workbook route clears stale schedule/day timing instead of inheriting prior ETA context.

## Failure / recovery

- Invalid timing does not overwrite the prior saved `dayContext`.
- Invalid route-history/backup migration does not silently invent timing data.
- Rollback is the governed baseline commit above; no Drive migration or destructive downgrade is required.

## Integration statement

No workbook/router integration impact. Phase 2H-A does not change the workbook inbox, route-order return, Drive handoff files, or workbook runtime.
