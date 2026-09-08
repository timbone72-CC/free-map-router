# Phase 2H-B — Time-Aware Google Optimization Closeout

Date: 2026-09-08  
Change level: Level 1 — documentation only  
Runtime baseline at closeout: `e03c197444b7f6c483f47e3e8028da4eb1ada7dc`  
Status: **COMPLETE — MERGED — PUBLISHED — LIVE VALIDATED — PROTECTED**

## Purpose

Close the documentation loop for governed Phase 2H-B after its backend-first rollout, browser implementation, live defect discovery and repair, follow-up operator-approved Home By behavior, automated verification, publication, and live saved-state validation.

This closeout changes documentation only. It does not change runtime code, tests, routing behavior, storage schemas, Drive files or permissions, workbook handoff behavior, dependencies, workflows, or deployment configuration.

## Governing design

Phase 2H-B is the **Time-Aware Google Optimization** slice defined by:

- `docs/PHASE_2H_TIME_AWARE_SINGLE_DAY_ROUTING_IMPACT_RECORD_2026-09-04.md`;
- `docs/PHASE_2H_B_TIME_AWARE_GOOGLE_IMPLEMENTATION_RECORD_2026-09-04.md`.

The governing design keeps Phase 2H-C Planner Map/List work outside this slice.

## Published implementation trail

### B1 — additive backend compatibility

PR #81 implemented the backend-first compatibility half of Phase 2H-B. The additive `/optimize` contract accepts optional per-stop service duration and optional top-level timing while preserving legacy untimed requests.

The verified B1 runtime was published before the B2 browser caller began relying on those additive fields. The published B1 runtime baseline recorded by the B2 PR was:

`b95dc4138fd87a10acc35799c9a15be97fff20e1`

### B2 — browser timing and schedule persistence

PR #82, **Phase 2H-B2: time-aware Google browser and schedule persistence**, was tested at exact head:

`f7348cf2b41f80b093c4e6066fc0be6959389dfb`

It merged to `main` as:

`8967e32bff471b4fbe644a4bf5c5719783d793f0`

The governed **Verify Contract and App** workflow passed on the tested B2 head. B2 added the approved browser behavior only: saved Workday timing, Phase 2G physical-stop service duration, complete Google schedule validation/persistence, stale-result protection, Preferred Finish reporting, backup preservation, and Google-only schedule state.

### Live schedule-persistence repair

Live B2 validation correctly exposed a real persistence defect: Google could return and apply a complete route while a later ordinary route-history write erased the accepted schedule before backup.

PR #83 repaired that ownership mismatch in `route-history.js`. The repair was verified with production-shaped regression coverage, including the ordinary stale-in-memory write followed by backup, and merged as:

`2ee065dcd41169719ffdd3ec47d7107266e57332`

The repair preserved a structurally valid schedule on Google Route only, kept Basic and pending schedules null, and invalidated schedule confidence when its governed basis changed.

### Follow-up Workday behavior discovered during live use

PR #84 repaired an evening default edge case where a new route opened after the normal 5:00 PM Home By default and could begin with an invalid unsaved Workday. That fix is adjacent Workday behavior and is not redefined by this closeout.

PR #85 added the operator-approved ability to temporarily clear the visible **Home by** field for Google Optimize. In that mode the last valid saved Home By remains unchanged, Google uses the existing untimed request path, exact stops and service durations remain preserved, and no Home-By-safe schedule is fabricated. Re-entering a valid Home By restores the timed behavior.

PR #85 merged as:

`f0acf178de968b9eb3d18441e139aeab06415d79`

Post-merge **Verify Contract and App** run #266 passed on that exact merge commit. The published behavior was then live-smoke tested and confirmed **Works**. Commit `e03c197444b7f6c483f47e3e8028da4eb1ada7dc` records that live validation.

## Live saved-state validation

The final review/validation gate inspected the current app-owned Google Drive whole-app backup rather than relying only on unit tests.

The inspected **Free Map Router Backup.json** was created on 2026-09-07 and uses backup version 4.

For its saved Google Route:

- optimization status was `google_optimized`;
- the Google route contained 12 route IDs;
- `routes.google.schedule` was populated;
- the schedule contained 12 visits;
- the visit stop IDs matched the 12 Google route IDs in the same order;
- no duplicate route or visit IDs were present;
- vehicle start/end and travel/service/wait totals were present;
- the saved schedule basis included the route, Home, service-duration, Departure, and Home By inputs required for freshness.

For Basic Route:

- `routes.basic.schedule` remained null.

This satisfies the specific live persistence criterion that the #83 repair was created to protect.

## Protected Phase 2H-B behavior

The following live behavior is now documented as protected:

1. Google Optimize may use the saved Route date, Departure, Home By, and IANA timezone to build a whole-second timed request.
2. Each physical route stop is sent once even when several exact work items share it.
3. Known Phase 2G work-item durations are summed once at the physical stop and sent as Google service duration.
4. Routed manual work with unknown duration blocks the time-aware request before the Google network call instead of being treated as zero.
5. Preferred field-work finish remains a soft post-result comparison. It is not a Google hard time window.
6. When Home By is enabled, Home By remains the hard return bound. A skipped, incomplete, duplicate, unknown, stale, or infeasible Google result does not partially replace the accepted route.
7. A complete accepted timed schedule belongs only to Google Route. Basic Route does not gain Google ETA/Home-By confidence.
8. The accepted Google schedule is current only while its deterministic route/Home/service/timing basis remains current. Basis changes remove schedule confidence without deleting the route order.
9. Route-history version 6 preserves a valid Google schedule through ordinary state writes, and backup version 4 preserves/restores that schedule when its route identity remains valid.
10. Clearing the visible Home By field is a temporary operator-controlled request mode. It does not erase the last valid saved Home By. Untimed optimization preserves exact stops/service durations but does not fabricate a Home-By-safe schedule.
11. Re-entering a valid Home By restores the existing timed/Home-By-safe behavior.
12. Phase 2H-B does not change workbook inbox fields, selectable sync, workbook Order IDs / `Source_ID`s, manual `Gig_ID`s, route-order return schema, Drive file names, Drive permissions, saved address text, or manually verified pins.

## Documentation amendments in this closeout

This closeout deliberately updates only documentation required to make the repository agree with the live protected system:

- `CONTRACT.md` — replaces the stale Phase 2H-A-only statement that `schedule` is merely reserved for a later slice and records the live Phase 2H-B Google timing/schedule behavior;
- `REGRESSION_CHECKLIST.md` — adds the Phase 2H-B protected regression boundary;
- this closeout record — records the implementation, repair, publication, and live-validation evidence.

The older implementation and repair records are retained as historical records. Their earlier status lines such as **IMPLEMENTATION IN PROGRESS** or **AWAITING OPERATOR APPROVAL** describe their state when written; this closeout supersedes those status labels for the current repository state without rewriting history.

## Verification for this documentation-only closeout

Under `TESTING_CONTRACT.md`, this Level-1 documentation-only change requires contract/diff review and does not require another runtime suite, JavaScript syntax run, billed Google request, or live smoke test.

Required closeout checks:

- exact branch base equals current `main` at `e03c197444b7f6c483f47e3e8028da4eb1ada7dc`;
- changed files are documentation only;
- contract statements are limited to behavior already implemented and evidenced by the Phase 2H-B PRs, follow-up repair trail, passed CI, operator live validation, and inspected live backup;
- no Phase 2H-C behavior is claimed as implemented;
- no workbook/router integration change is introduced.

## Roadmap handoff

Phase 2H-B is closed.

The next governed roadmap slice remains:

**Phase 2H-C — Planner Map/List and Summary Foundation.**

No Phase 2H-C runtime implementation is included in this closeout.

## Integration statement

No workbook/router integration impact.