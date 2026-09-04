# Phase 2H-B — Live Schedule Persistence Repair

Date: 2026-09-04  
Change level: Level 3  
Repair branch: `work/phase-2h-b-live-schedule-persistence-repair-20260904`  
Repair base / rollback commit: `8967e32bff471b4fbe644a4bf5c5719783d793f0`  
Status: IMPLEMENTED — VERIFIED — AWAITING OPERATOR APPROVAL  
Pre-merge operator approval: PENDING

## Exact user-facing problem

The authenticated live Phase 2H-B Google Optimize path successfully returned and applied a complete 63-stop Google route, but the accepted Google schedule did not survive normal app state handling into the whole-app backup. Two live backups taken after successful Google optimization contained `optimizationStatus: "google_optimized"` while `routes.google.schedule` was `null`.

The route order itself remained valid and complete. The defect is schedule persistence, not Google stop ordering or workbook identity handling.

## Reproducible evidence and root cause

`google-route-browser.js` writes the accepted schedule directly into the existing route-history v6 Google snapshot after validating the response and deterministic schedule basis.

`route-history.js`, however, still contained the Phase 2H-A placeholder behavior in `normalizeRouteSnapshot(...)`: every normalized route snapshot was emitted with `schedule: null`. Every normal `readRouteHistory(...)` / `writeRouteHistory(...)` therefore discarded the accepted Phase 2H-B schedule.

The existing Phase 2H-B tests persisted a schedule and inspected or backed it up immediately. They did not perform the intervening ordinary route-history write that occurs in normal production use, so this ownership mismatch was not covered.

## Approved repair scope

Repair Phase 2H-B schedule persistence only:

- allow route-history v6 to normalize and retain a structurally valid schedule on the Google route only;
- keep Basic and pending schedules null;
- preserve a valid stored Google schedule when an ordinary write is made from an older in-memory route-history object and the Google route/work metadata plus hard timing basis are unchanged;
- invalidate the schedule when Google route membership/order changes;
- invalidate the schedule when Route date, Departure, Home By, or timezone changes;
- keep the schedule when only Preferred Finish changes because Preferred Finish is soft and is not part of the Google hard request basis;
- add regression coverage reproducing the live stale-in-memory write followed by backup.

No route algorithm, Google API request, workbook handoff, Drive permission, or backup schema/version change is included.

## Owning files and functions

Read/write:

- `route-history.js`
  - `normalizeRouteSnapshot(...)`
  - `normalizeRouteHistory(...)`
  - `replaceDayContext(...)`
  - `writeRouteHistory(...)`
  - narrow schedule-shape/basis helpers
- `tests/phase-2h-b-live-persistence-repair.test.js`
  - production-shaped regression coverage

Documentation:

- this repair record

Read-only dependencies:

- `google-route-browser.js` accepted-schedule format and basis semantics;
- `backup.js` v4 schedule validation/preservation;
- Phase 2H-A day-context behavior;
- Phase 2H-B implementation record.

## Required data and schema decision

Required existing state:

- route-history v6 Google route snapshot;
- accepted Phase 2H-B schedule containing basis key, vehicle start/end, duration totals, and one ordered visit per Google stop;
- valid top-level day context.

No new field, storage key, Drive file, route-history version, or backup version is introduced. Phase 2H-A already reserved nullable `schedule` on route-history v6, and Phase 2H-B already defined/populated the schedule structure. This repair makes the route-history owner preserve the already-approved field.

## Protected behavior

- Google and Basic route slots remain separate.
- Basic never gains Google schedule confidence.
- Pending workbook routes never gain a schedule.
- Every selected physical stop remains exactly once.
- Exact workbook Order IDs / `Source_ID`s and manual `Gig_ID`s remain unchanged.
- Home remains separate from stops and remains the round-trip start/finish.
- Google Optimize request/provider behavior is unchanged.
- Preferred Finish remains soft.
- Home By remains hard.
- Starting a genuinely new workbook route still clears stale day timing and schedule.
- Existing valid route-history v6 and backup v4 data remain compatible.
- No new automatic Drive write is introduced.

## Stale-output behavior

The stored schedule is retained only across ordinary route-history writes when the normalized Google snapshot basis and hard day-timing basis remain unchanged.

The repair deliberately clears or refuses to preserve schedule confidence when:

- Google route order or membership changes;
- represented Google route work metadata changes;
- Route date changes;
- Departure changes;
- Home By changes;
- timezone changes;
- a new pending route is promoted to the usable route.

Preferred Finish alone does not clear the schedule because it is evaluated after Google optimization and is not a hard Google constraint.

Phase 2H-B's existing browser basis check continues to own Home/service-time freshness that requires data outside route-history itself.

## Hard limits and permissions

Unchanged:

- maximum Google-selected stops: 100;
- 30-second solver timeout through 32 stops;
- 60-second timeout from 33 stops;
- one vehicle;
- one-day Google model;
- existing Google endpoint and authentication;
- existing Drive scopes and files.

## Focused test plan

New regression coverage must prove:

1. Persist an accepted Google schedule, then perform an ordinary route-history write from a stale in-memory history while staging a newer pending workbook route; the Google schedule remains readable and backup v4 retains it.
2. Basic and pending routes remain schedule-null.
3. Changing Google route order invalidates the schedule while Basic route order remains untouched.
4. Changing only Preferred Finish preserves the accepted schedule.
5. Changing Departure invalidates the accepted schedule.

No test makes a billed Google Route Optimization request.

## Verification completed

Draft PR #83 ran the repository's required `Verify Contract and App` workflow on the repair head.

Result:

- complete `npm test`: **410 passed, 0 failed**;
- new live-regression test `ordinary route-history writes preserve an accepted Google schedule and backup keeps it`: **PASS**;
- new route-order invalidation regression: **PASS**;
- new Preferred-Finish/Departure schedule-basis regression: **PASS**;
- existing Phase 2H-A and Phase 2H-B route-history, backup, stale-context, timing, provider, and optimizer tests: **PASS**;
- all first-party root JavaScript files passed `node --check`;
- no billed Google Route Optimization request was made by tests.

Workflow: `Verify Contract and App` run #257 (`33913389036`) — **SUCCESS**.

Diff inspection from rollback base `8967e32bff471b4fbe644a4bf5c5719783d793f0` confirms only:

- `route-history.js`;
- `tests/phase-2h-b-live-persistence-repair.test.js`;
- this repair record.

No workbook, Drive, optimizer/provider, app UI, or deployment configuration file changed.

## Final approval gate

Before merge:

- explicit operator pre-merge approval is still required;
- the PR remains draft until that approval;
- no merge or deployment has occurred.

After publication, the required live check is:

1. run one authenticated Google Optimize on an existing representative route;
2. confirm the route applies with no missing/duplicate stops;
3. perform a normal app state action that writes route history or a workbook-route refresh;
4. tap Back Up Now;
5. inspect the fresh backup and confirm `routes.google.schedule` is populated and matches the accepted Google route order;
6. confirm Basic schedule remains null.

## Failure recovery / rollback

If focused or final verification fails, stop without merge or deployment and repair or abandon this branch.

If the published repair fails live validation, restore runtime commit `8967e32bff471b4fbe644a4bf5c5719783d793f0`. No Drive migration, workbook change, or destructive data rollback is required.

## Integration statement

No workbook/router integration impact. This repair does not change the Address Inbox, Route Order, Gig Handoff, workbook schema, workbook runtime, Drive file names, or synchronization semantics.
