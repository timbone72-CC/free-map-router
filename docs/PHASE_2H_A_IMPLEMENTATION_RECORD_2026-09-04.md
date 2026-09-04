# Phase 2H-A — Workday Context and Timing Controls Implementation Record

Date: 2026-09-04  
Change level: Level 3  
Governed design: `docs/PHASE_2H_TIME_AWARE_SINGLE_DAY_ROUTING_IMPACT_RECORD_2026-09-04.md`  
Governed baseline / rollback commit: `a4e819c1c93d529126bc21402ff45c6a5681dfa1`  
Status: IMPLEMENTED — AUTOMATED VERIFICATION PASSED — AWAITING OPERATOR PRE-MERGE APPROVAL  
Pre-merge operator approval: required before merge

## Exact scope implemented

Phase 2H-A only:

- Build Route controls for Route date, Departure, Preferred field-work finish, and Home by;
- local date/time/timezone normalization and validation;
- route-history version 6 with shared `dayContext` and reserved nullable snapshot `schedule`;
- whole-app backup version 4 preserving route-history v6;
- backward-compatible route-history and backup migration;
- focused regression coverage for the above.

## Explicitly excluded and unchanged

- no Google `/optimize` request changes;
- no service-duration transmission to Google;
- no Google schedule/ETA response handling;
- no planner map/list redesign;
- no multi-day planning;
- no workbook repository or handoff schema changes;
- no Drive permission/file changes.

## Owning surfaces changed

Read/write:

- `route-history.js` — persisted named-route history, local timing validation, route-history v6, and day-context writes;
- `backup.js` — whole-app backup v4 and backward-compatible restore;
- `workday-context.js` — new narrow Build Route timing-control runtime;
- `index.html` — four static Build Route controls and cache-versioned script loading;
- focused tests for route history, backup, timing controls, and retained Phase 2G behavior.

Read-only / intentionally untouched:

- `app.js` — existing route state and controls remain unchanged;
- Google route contract/browser/server/provider files — unchanged;
- workbook handoff and route-order modules — unchanged;
- Phase 2G work-item planning runtime — unchanged.

No CSS change was required because the existing `panel` and `row2` layout classes provide the compact control layout.

## Protected behavior verified

- Google and Basic route orders and identities remain unchanged by timing edits;
- exact workbook Order IDs / `Source_ID`s and manual `Gig_ID`s remain unchanged;
- Phase 2G planning remains unchanged and remains recoverable from backup v3/v4;
- Home remains separate from route stops;
- Google request behavior remains unchanged;
- existing version-1/2/3 backups remain restorable;
- existing route-history v5 state migrates without route/order/work metadata loss;
- a genuinely new workbook route does not inherit stale route-day timing;
- the app remains five pages.

## Phase 2H-A timing behavior

When no saved day context exists, Build Route displays:

- current local route date;
- current local departure minute;
- preferred field-work finish `15:00`;
- Home by `17:00`;
- the browser's resolved IANA time zone.

A saved day context contains only:

- `routeDate` (`YYYY-MM-DD`);
- `departureTime` (`HH:MM`);
- `preferredFinishTime` (`HH:MM`);
- `homeByTime` (`HH:MM`);
- `timeZone` (IANA identifier).

`Home by` must be later than `Departure` on the selected route date. Invalid dates, times, time zones, and nonexistent local times such as a spring-forward DST gap fail visibly and do not overwrite the last valid context.

Timing edits save planning context only. They do not optimize, reorder, add, remove, or relabel route work.

## Route-history v6 behavior

- one top-level `dayContext` is shared by the current Google and Basic route versions;
- each normalized route snapshot reserves `schedule: null` for Phase 2H-B without populating Google schedule data in 2H-A;
- pre-v6 named-route history migrates with `dayContext: null` and `schedule: null` rather than invented timing;
- ordinary route writes preserve the latest saved day context even when the existing app runtime still holds an older in-memory route-history object;
- explicit day-context writes, backup restore, and Start New Route may deliberately replace or clear the stored context;
- Start New Route creates fresh Google/Basic route snapshots with no inherited day timing or schedule.

## Backup v4 behavior

- backup v4 preserves route-history v6 day context and Phase 2G work-item planning;
- valid backup v1/v2/v3 files remain restorable;
- v3 planning remains preserved;
- older backups restore with no invented day context;
- a v4 backup containing invalid day timing fails before restore rather than silently normalizing bad timing;
- no new Drive file, folder, OAuth scope, or permission is introduced.

## Focused and full verification

New focused coverage proves:

- v5 route history -> v6 migration;
- exact day-context round trip;
- invalid Home-by/departure rejection without overwriting prior timing;
- nonexistent DST local time fail-closed behavior;
- backup v4 round trip with planning + day context;
- v1/v2/v3 backup compatibility with no invented day context;
- timing edits do not alter route order, membership, or optimizer status;
- starting a genuinely new workbook route clears stale timing/schedule state;
- Build Route contains exactly the four governed timing controls and loads the narrow timing runtime before `app.js`.

The first full CI run correctly stopped on three pre-existing tests that hard-coded the former route-history/backup version numbers. The new Phase 2H-A behavior tests themselves passed. Those three old tests were updated only to expect route-history v6 / backup v4; their behavioral assertions were retained.

Final runtime/test head verified: `65816fbb05663363da292e451a51f0c333e0f683`  
GitHub Actions workflow: **Verify Contract and App**  
Run: **#238** (`33886631437`)  
Result: **PASS**

No runtime, test, workflow, dependency, or build file changed after that successful run. This implementation-record update is documentation only and does not invalidate the verified runtime result under `TESTING_CONTRACT.md`.

## Contract-closeout rule

`CONTRACT.md` remains a record of behavior that is actually live and operator-validated. Phase 2H-A is therefore not described there as current live behavior before merge/publication. After the published slice is checked and the operator confirms **Works**, the Phase 2H-A live guarantees should be added to `CONTRACT.md` and the human regression checklist can be closed against the live result.

The merged Phase 2H design record plus the automated Phase 2H-A tests remain the pre-merge acceptance authority.

## Failure / recovery

- invalid timing does not overwrite the prior saved `dayContext`;
- invalid route-history/backup migration does not silently invent timing data;
- the prior Google/Basic route remains recoverable if the slice is rolled back;
- rollback is the governed baseline commit above;
- no Drive migration or destructive downgrade is required.

## Integration statement

No workbook/router integration impact. Phase 2H-A does not change the workbook inbox, route-order return, Drive handoff files, or workbook runtime.
