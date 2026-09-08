# Phase 2I — Multi-Day Route Plans Implementation / Impact Record

**Date:** 2026-09-08  
**Status:** GOVERNED DESIGN COMPLETE — IMPLEMENTATION MAY START IN SLICES — LEVEL 3 PRE-MERGE APPROVAL REQUIRED FOR STORAGE/MIGRATION SLICE  
**Repository:** `timbone72-CC/free-map-router`  
**Governed base:** `fc480293233f034681287c814b3666dcc4ece166`  
**Roadmap owner:** `docs/FIELD_WORK_EXPANSION_PLAN.md`  
**Change class:** Parent Phase 2I is **Level 3** because it introduces durable Route Plan / Day state, migration from route-history v6, active-plan completion identity, and backup/persistence changes.

## 1. Purpose

Start the next Route Planner Core phase after the completed and operator-accepted Phase 2H-C planner foundation.

Phase 2I adds a deliberate multi-day planning layer above the current one-day Google/Basic route experience without replacing the quick one-day path, duplicating job data, weakening exact work identity, or turning the workbook into the durable owner of the plan.

The roadmap definition controls this phase:

- **Route Plan** = all selected work to be completed across one or more days.
- **Day** = one dated subset with its own Workday timing, work assignments, Google/Basic route state, and active-plan status.
- **Route** = the Google or Basic ordering for one day.
- Every selected exact work item appears exactly once across the active plan unless explicitly removed.
- Multiple exact work items at one physical property stay together on one day by default.
- Each day is optimized separately as one driver / one vehicle.
- Google reoptimization remains explicit; the splitter must not create API retry loops.
- Lightweight completion identity is retained only while the active plan needs it; detailed permanent completed-route history is excluded.

Phase 2J day-aware workbook return/print and Phase 2K Replan Remaining / known-road behavior remain outside this implementation.

## 2. Governing evidence read before design

- `AGENTS.md`
- `CHANGE_CONTROL_CONTRACT.md`
- `TESTING_CONTRACT.md`
- relevant Route, planning, timing, saved-data, Level-3, and Phase 2H-C sections of `CONTRACT.md` and `REGRESSION_CHECKLIST.md`
- `docs/FIELD_WORK_EXPANSION_PLAN.md`
- `docs/2026-09-02_ROUTE_PLANNER_PRODUCT_AUDIT.md`
- `route-history.js`
- `backup.js`
- `work-item-planning.js`
- `route-work-planning.js`
- `planner-model.js`
- relevant Build Route / backup / navigation code in `app.js`
- relevant Build Route structure and script order in `index.html`
- `inbox.js`
- `tests/route-history.test.js`

No workbook/router handoff contract change is part of Phase 2I. The current pending workbook inbox and existing route-order return must be preserved unchanged. **No workbook/router integration impact.** Phase 2J owns the later day-aware handoff change.

## 3. Verified current baseline

### Current route storage

`route-history.js` currently owns storage key:

`fmr_route_history_v1`

with route-history **version 6** containing:

- one shared one-day `dayContext`;
- one Google route snapshot;
- one Basic route snapshot;
- one pending workbook route snapshot;
- Google-only nullable schedule state.

The public app currently reads `routeHistory.google`, `routeHistory.basic`, `routeHistory.pending`, and `routeHistory.dayContext` directly.

### Current exact route snapshot ownership

A route snapshot may contain:

- ordered physical `routeIds`;
- workbook `orderIdsByStopId`;
- workbook expected-pay metadata by stop;
- manual `gigIdsByStopId`;
- gig-managed stop IDs;
- optimizer status;
- workbook source timestamp;
- Google schedule only when allowed/current.

### Current planning ownership

`work-item-planning.js` already owns exact-work planning metadata by `kind + workItemId`:

- optional `serviceMinutes`;
- optional local `assignedDate`;
- `lockedDay`;
- revision;
- `updatedAt`.

Phase 2I must reuse those fields as the source of truth for exact work-item day assignment and lock state rather than copying assignment flags into a second plan database.

### Current backup ownership

Whole-app backup **version 4** preserves:

- Home;
- saved stops;
- manual gigs;
- work-item planning;
- route-history v6 day context;
- valid Google schedule;
- Google/Basic/pending route state.

Valid older backup versions 1–3 remain supported.

### Current field completion behavior

`Done & Navigate Next` currently removes the first physical stop from only the selected route and navigates to the next stop or Home. It does not retain active-plan completion identity because no multi-day Route Plan exists yet.

### Current planner presentation

Phase 2H-C already provides the protected one-day planner surface:

- one day summary;
- one physical stop card per `stopId`;
- exact nested work items;
- planner map/list;
- current-only Google timing confidence;
- Basic Route confidence boundary;
- responsive desktop/phone presentation;
- protected current Build Route actions.

Phase 2I must extend this surface rather than create a sixth page or a second planner.

## 4. Canonical Phase 2I ownership model

### 4.1 One active Route Plan, not a route archive

Initial Phase 2I stores at most **one active Route Plan** plus the existing pending workbook route.

It does **not** add:

- recent-route history;
- permanent detailed completed-route history;
- multiple archived Route Plans;
- fleet/driver assignment;
- true multi-device synchronization.

If the operator creates a different plan while one is active, the app must warn and require explicit replace/cancel behavior before the current plan is purged.

### 4.2 Route Plan stores identity/context, not duplicate job records

The Route Plan may retain only the minimum identity needed to own the active workload:

For exact work:

- `kind` = `workbook` or `gig`;
- exact `workItemId`;
- exact physical `stopId`.

For an existing route-only physical stop that has no workbook Order ID and no manual `Gig_ID`, the plan may retain that `stopId` as a standalone route stop so current app-only stop behavior is not lost.

The Route Plan must **not** copy durable address text, pin coordinates, expected-pay records, gig notes, work-order text, permanent address aliases, manual-work-library records, or service-planning records. Those remain with their existing owners.

### 4.3 Day assignment source of truth

Exact work-item day assignment remains owned by the existing work-item planning record:

- `assignedDate` is the assigned plan day;
- `lockedDay` prevents automatic movement unless the operator explicitly changes it.

The Route Plan references those exact identities but does not duplicate `assignedDate` / `lockedDay` inside a second durable structure.

Standalone app-only stop assignment, where no exact work identity exists, may be retained in the Route Plan because there is no work-item planning record to own it.

### 4.4 Day state

Each Route Plan Day owns:

- stable immutable `dayId`;
- one local-calendar Workday context (or `null` only for a safely migrated legacy one-day route that never had saved timing);
- one Google route snapshot for that day;
- one Basic route snapshot for that day;
- lightweight active-plan completion identities belonging to that day when needed;
- day-level revision/update boundary.

The existing Phase 2H-B rule remains: only a valid current Google schedule may supply traffic-aware ETA/Home confidence. Basic never receives Google schedule confidence.

### 4.5 Plan state

The active Route Plan owns:

- immutable `planId`;
- schema version;
- plan revision;
- `updatedAt`;
- active `dayId`;
- ordered Day records;
- exact work pool membership (`kind + workItemId + stopId`);
- standalone app-only stop membership where necessary.

No Day may claim an exact work identity that is not in the plan pool.

No exact `kind + workItemId` may belong to more than one physical stop or more than one assigned day.

## 5. Storage migration direction

The final persistence slice will evolve route history from **v6 to v7** while retaining the existing storage key `fmr_route_history_v1`.

This avoids adding a second durable local route database solely for multi-day planning.

### Canonical stored v7 shape

The canonical stored form will own:

- route-history version 7;
- one `activePlan` or `null`;
- the existing `pending` workbook route or `null`.

The active plan will own its Days and each Day's Google/Basic route snapshots.

### Compatibility boundary during migration

To minimize unrelated rewrites, `route-history.js` may continue returning active-day compatibility views such as:

- `history.google`;
- `history.basic`;
- `history.dayContext`;

but those must be **derived views of the active Day**, not separately persisted competing copies.

Existing route mutation functions must update the active Day canonically.

### v6 → v7 migration

A valid current v6 history migrates into exactly one active Day:

- preserve Google route order and metadata exactly;
- preserve Basic route order and metadata exactly;
- preserve current dayContext exactly when it exists;
- preserve a valid current Google schedule only under the existing schedule rules;
- preserve pending workbook route unchanged outside the active plan;
- derive the plan's exact work pool from workbook Order IDs and manual `Gig_ID`s represented by the existing route snapshots;
- retain route-only app stops that have no exact work identity;
- do not invent a due date, completion state, route date, pay, service duration, or work identity that did not exist;
- do not drop one route slot merely because Google and Basic orders differ.

Migration identity must be stable across repeated reads. It must not generate a different plan/day identity on each reload before the migrated state is first written.

Malformed legacy route data must continue to fail closed / normalize safely under current route-history protections.

## 6. Backup migration direction

The persistence slice will introduce whole-app backup **version 5** only when v7 route-plan storage is wired into runtime.

Backup v5 must preserve:

- active Route Plan identity/revision;
- ordered Days;
- each Day's Workday context;
- each Day's Google/Basic route snapshots;
- valid Google schedule state per existing confidence rules;
- lightweight active-plan completion identity;
- current work-item planning records;
- manual gigs;
- Home and stops;
- pending workbook route.

Valid backup versions **1, 2, 3, and 4** must remain restorable.

A valid version-4 backup restores as one-day plan data without inventing extra days, completion state, or assignments.

Restore failure must leave the pre-restore device state recoverable under the current confirmation/fail-closed behavior.

No Drive filename, Drive permission, folder identity, or whole-app backup trigger changes are authorized by Phase 2I.

## 7. Multi-day planner behavior

### 7.1 Simple one-day path remains first-class

A small route must remain usable as the current one-day planner without forcing the operator to create multiple days or complete an extra wizard.

The migrated one-day plan is a compatibility foundation, not a requirement to expose unnecessary plan controls on every route.

### 7.2 Creating multi-day work

The planner must support:

- explicit Day 1 / Day 2 / Day 3 style creation;
- automatic day count when requested;
- per-day Route date / Departure / Preferred Finish / Home By;
- manual movement of exact work items between days;
- manual locked-day behavior through the existing `assignedDate` / `lockedDay` planning metadata;
- one visible active day at a time on the existing Build Route planner.

### 7.3 Two-stage planner rule

**Pass 1 — local day assignment**

Use only available local planning facts:

- geography from valid saved display coordinates where available;
- due date where actual due-date data exists;
- existing explicit `assignedDate` and `lockedDay`;
- realistic known service duration;
- each Day's available Workday length;
- same-physical-stop grouping.

Do not invent missing due dates or service durations.

A manual gig with unknown duration remains a visible planning incompleteness; the splitter must not silently treat it as zero.

Workbook due-date data is not currently present in the governed Address Inbox, so Phase 2I must not pretend workbook due dates exist. Later backward-compatible metadata may be separately governed if needed.

**Pass 2 — route optimization**

Optimize only the selected Day using the existing Basic or Google route path.

Automatic day splitting must not call Google repeatedly. Google Optimize remains an explicit operator action for a serious selected Day candidate.

### 7.4 Same-address rule

Distinct exact work items sharing one physical `stopId` remain assigned to the same Day by default.

An automatic split must never send the operator to the same property on separate days merely because individual work items were counted separately.

A deliberate operator override, if later supported in this phase, must be explicit and visible.

### 7.5 No silent work loss

Across the active plan:

- each exact work item appears once;
- each standalone route-only stop appears once unless explicitly removed;
- no work disappears because a Day exceeds its target;
- no work is duplicated because Google/Basic route slots differ;
- overflow remains visible for operator adjustment.

## 8. Lightweight completion boundary

Phase 2I adds only the minimum active-plan completion identity required by the roadmap.

When the operator completes a physical stop:

- work completed at that stop disappears from the active Day's **remaining work** presentation;
- the active plan retains exact completed work identity/status needed to prevent automatic re-entry;
- a small completion timestamp may be retained;
- no duplicate address, coordinates, pay, notes, route geometry, or permanent history copy is created.

The plan completion record must distinguish exact workbook and manual work identities even when several jobs shared one physical stop.

When a whole active Route Plan is deliberately replaced/deleted, its temporary completion state may be purged after explicit confirmation.

Detailed permanent route history remains excluded.

## 9. Active-plan replacement rule

Creating/replacing a Route Plan while one is active must be explicit:

- warn that an active plan exists;
- **Cancel** leaves the current plan untouched;
- **Replace** may discard the old plan's day assignments/routes/lightweight completion state only after confirmation;
- saved addresses, pins, manual gigs, Manual Work Library, permanent address corrections, workbook history, and prediction history are never deleted by Route Plan replacement.

A newer workbook inbox remains **New Route Available** under the existing pending behavior and must not silently replace the active plan in Phase 2I.

Mid-plan new-work placement is intentionally deferred to Phase 2K design.

## 10. User interface boundary

Phase 2I extends the existing Build Route page and Phase 2H-C planner hierarchy.

It may add bounded controls for:

- current Route Plan / active Day context;
- day selector;
- add/remove day where governed;
- automatic split / assign-days action;
- move-to-day / lock-day actions;
- active-plan replacement warning.

It must retain:

- exactly five top-level pages;
- current Map/List planner ownership;
- same derived planner model for desktop and phone;
- protected Basic/Google route selector;
- Optimize Route / Google Optimize;
- Start Navigation;
- Done & Navigate Next;
- workbook/Garmin/clear utilities;
- no post-load UI rewriting, observer loop, polling loop, or duplicate mobile route state.

Professional cosmetic redesign remains deferred.

## 11. Implementation slices

### Phase 2I-A — Pure Route Plan / Day Contract

**Risk:** Level 2 implementation support inside a Level 3 parent phase because it is dormant/read-only and does not change stored state.

Build a pure module with:

- canonical Route Plan / Day normalization;
- stable plan/day identity rules;
- exact work-pool validation;
- standalone-stop support;
- one-day legacy migration model from normalized route-history v6 input;
- day membership/integrity helpers;
- no localStorage;
- no DOM;
- no network;
- no Drive;
- no backup writes;
- no script loading into the live page yet.

This slice proves the model before a migration can touch user data.

### Phase 2I-B — Route-History v7 Persistence + Backup v5

**Risk:** Level 3.

Wire the approved model into:

- `route-history.js` v7 canonical persistence;
- active-day compatibility views;
- v6 → v7 migration;
- `backup.js` v5 with v1–v4 restore compatibility;
- existing restore/write/remap/new-workbook behaviors.

No multi-day UI is required to prove this slice. The live app should still behave as the protected one-day planner while its storage safely becomes Route-Plan-capable.

**Explicit operator pre-merge approval is required for this slice.**

### Phase 2I-C — Day Management and Local Day Assignment

Add:

- create/replace multi-day plan control;
- Day selector;
- per-day Workday context;
- manual move/lock using exact work planning metadata;
- local automatic day assignment using geography + available due/service/time facts;
- same-address grouping;
- selected-day Google/Basic route generation without automatic Google calls.

The first automatic splitter must be deterministic and testable with no network dependency.

### Phase 2I-D — Active-Plan Completion / Replacement Closure

Integrate:

- lightweight exact completion identity with `Done & Navigate Next`;
- remaining-work filtering;
- no completed-work resurrection inside the active plan;
- explicit active-plan replacement/cancel behavior;
- purge of only temporary plan state on deliberate replacement.

Phase 2I closes only after all four slices are operator-smoke-tested as one coherent multi-day planner.

## 12. Expected owning files

### 2I-A

- new `route-plan.js` or equivalently named pure domain module;
- focused `tests/phase-2i-route-plan*.test.js`;
- slice change record.

### 2I-B

Expected owners only:

- `route-history.js` — canonical persisted route-plan/day/route state and migration;
- `backup.js` — whole-app backup v5;
- `index.html` only if the new runtime module becomes a loaded dependency;
- focused route-history / backup / migration tests.

### 2I-C / 2I-D

Expected owners only as behavior requires:

- `app.js` — Build Route plan/day interaction and active-day rendering/action ownership;
- `index.html` — bounded plan/day structure;
- `styles.css` — responsive presentation only;
- pure splitter/model module(s);
- `planner-model.js` only if the existing read-only model needs explicit active-day/completion fields;
- `workday-context.js` only if per-day selection requires a narrow adapter to the active Day;
- focused tests.

Do not refactor unrelated modules as part of Phase 2I.

## 13. Read and write surfaces

### Reads

- saved stops and Home;
- manual gigs;
- exact route snapshot work identities;
- work-item planning records;
- current/pending workbook route metadata;
- current per-day Workday context;
- valid Google schedules;
- planner model inputs.

### Writes after persistence is authorized

Only the owning local app state may change:

- canonical active Route Plan / Days;
- exact work-item `assignedDate` / `lockedDay` through existing revision-safe planning APIs;
- per-day Google/Basic route state;
- lightweight active-plan completion identity;
- whole-app backup v5 when the operator uses existing backup controls.

### Must not write

- workbook Address Inbox;
- workbook route-order schema/contents except through the existing unchanged explicit active-route action;
- InspectorADE `Job_Log` / prediction data;
- manual gig identity/pay ownership;
- permanent address corrections;
- Manual Work Library records;
- Google Drive permissions;
- new Drive files;
- Google provider requests during automatic local split.

## 14. Required and optional data

### Required for an exact plan work item

- `kind`;
- exact `workItemId`;
- valid `stopId`.

### Required for a plan

- stable `planId`;
- positive revision;
- valid `updatedAt`;
- at least one Day when active;
- valid active `dayId`;
- unique exact work identities;
- valid physical stop references.

### Optional / may be incomplete

- Day Workday context for safely migrated legacy state only;
- due date where source data actually contains one;
- expected pay;
- service duration for manual work;
- saved map coordinates;
- current Google schedule.

Missing optional data must remain visible as incomplete; it must not become fabricated zero/default data except where existing governed defaults already apply.

## 15. Hard limits and bounded behavior

- Each Google-optimized Day inherits the existing provider/app physical-stop limit and current solver timeout protections.
- Multi-day splitting must be local and deterministic before Google is called.
- No automatic Google retry loop.
- No polling, observer, or recurring timer is needed.
- No unlimited completed-route archive.
- Only one active Route Plan in the first version.
- Exact identity duplicated across different physical stops fails closed.
- A route stop with missing saved map coordinates remains plan/list work and may be unplottable; it is never silently dropped.

Do not invent an arbitrary low overall Route Plan item cap merely for implementation convenience. If browser/storage or algorithm evidence establishes a real safe limit during runtime work, stop and record it before enforcing it.

## 16. Stale-output and revision behavior

- Plan and Day writes must use revision/update boundaries rather than last-writer-wins replacement with no check.
- A stale expected plan/day revision fails closed and requires reload/retry.
- Existing work-item planning revisions continue to protect assignedDate/lockedDay edits.
- A route/schedule becomes stale under the existing Phase 2H basis rules when its route/work/timing basis changes.
- Changing day assignment must not silently claim an old Google schedule is current.
- A newer workbook inbox remains pending and does not silently mutate an active plan in Phase 2I.

## 17. Realistic fixtures / safe-environment plan

Before any Level-3 storage merge, focused fixtures must include:

1. **Current one-day Google + Basic route** with different orders, shared work, Workday context, and valid Google schedule.
2. **Legacy route-history v6 with no saved dayContext** to prove no fabricated timing.
3. **Shared physical stop** with two workbook IDs and one manual `Gig_ID`.
4. **Manual gig with unknown service duration** to prove it remains incomplete.
5. **App-only route stop** with no workbook/gig identity.
6. **Unplottable saved stop** to prove identity survives without a marker.
7. **Pending newer workbook route** to prove migration/plan creation does not consume or replace it.
8. **Backup v1, v2, v3, v4** restore fixtures plus new v5 round-trip fixture.
9. **Stale revision conflict** for plan/day write.
10. **Two-day/three-day split** with same-address work and locked assigned work.
11. **Completion fixture** where a finished shared stop cannot re-enter remaining work.
12. **Plan replacement cancel/confirm** proving only temporary plan state is discarded.

Use repository fixtures/tests first. Live validation occurs only after the exact final runtime head is merged/published under Level-3 approval.

## 18. Baseline and expected verification

Accepted Phase 2H-C runtime baseline completed **433 / 433** repository tests with zero failures and passed root JavaScript syntax. The subsequent Phase 2H-C closeout was documentation-only.

Development rule:

- run only focused Phase 2I tests while editing;
- rerun the failed focused test first after a repair;
- run one complete repository suite + root JS syntax check on the exact final runtime head of each runtime slice;
- CI on that exact head satisfies the final full-suite gate.

Expected final result for every mergeable runtime slice: **all tests pass, zero failures, syntax passes**. Do not pre-claim a future exact test count.

## 19. Primary risks and controls

### Risk: route-history migration loses one of the existing route slots

Control: migrate Google and Basic independently and regression-test differing orders/statuses/metadata.

### Risk: plan duplicates durable job data and drifts stale

Control: store exact identity + stop reference only; keep address/pay/gig/service data with existing owners.

### Risk: exact work appears on two days or disappears

Control: plan integrity validator requires unique exact identity and reports unassigned/overflow explicitly.

### Risk: same property is scheduled on separate days

Control: automatic grouping is physical-stop-first; same-stop exact work stays together by default.

### Risk: manual unknown service becomes zero

Control: preserve Phase 2G completeness semantics and block false time-fit claims.

### Risk: Basic claims Google timing confidence

Control: retain Phase 2H-B/C Google-only schedule rules per Day.

### Risk: switching days corrupts current route state

Control: one canonical active-plan owner; active-day compatibility views are derived, not separately persisted.

### Risk: stale device/write overwrites a newer plan

Control: plan/day revision checks and existing work-item revision checks.

### Risk: automatic splitter burns Google API calls

Control: local Pass 1 only; explicit Google optimization in Pass 2.

### Risk: completed jobs re-enter plan

Control: lightweight exact active-plan completion identity, no detailed duplicate archive.

### Risk: new workbook route destroys an active plan

Control: preserve existing pending route staging; no automatic active-plan replacement in Phase 2I.

## 20. Rollback / recovery

Pre-Phase-2I known-good runtime and documentation baseline:

`fc480293233f034681287c814b3666dcc4ece166`

For a failed dormant 2I-A model slice: abandon/revert the branch; live app is unaffected.

For a failed Level-3 v7/backup-v5 slice before merge: abandon the branch; `main` remains the v6/v4 baseline.

For a failed published storage migration:

1. restore the known-good runtime commit under the emergency rollback rule;
2. do not perform forward cleanup on broken storage first;
3. preserve the user's existing local/Drive whole-app backup artifacts;
4. use the tested backward restore path rather than deleting route data;
5. investigate/fix on a new branch before attempting another migration.

Phase 2I must not add a destructive automatic cleanup that removes old plan/route data merely because migration fails.

## 21. Affected live smoke after runtime publication

### Persistence/migration slice

- existing one-day Google route opens with the same order/work IDs;
- Basic route opens with the same order/work IDs;
- Workday values remain exact;
- current valid Google timing remains truthful or is conservatively withheld, never fabricated;
- pending workbook route remains New Route Available;
- backup/restore preserves the route and plan state.

### Multi-day planner slice

- create a two-day plan from a realistic mixed route;
- each exact work item appears once across the plan;
- shared-address work stays one physical stop and one Day by default;
- switch Day 1 / Day 2 without state bleed;
- move one work item/day group manually and lock it;
- automatic split does not call Google;
- optimize selected Day only;
- Google/Basic confidence rules remain correct;
- desktop and phone planner remain usable.

### Completion/replacement slice

- complete the first stop and confirm it disappears from remaining work;
- confirm its exact identities stay excluded from active-plan remaining work;
- cancelling plan replacement preserves everything;
- confirming plan replacement removes only old temporary plan state and keeps saved jobs/gigs/pins/permanent records.

## 22. Approval state

The operator's request to start the next governed roadmap phase authorizes this Phase 2I design and implementation work within the documented scope.

No duplicate approval is needed for the documentation plan or the dormant pure 2I-A model slice while scope remains unchanged.

**Explicit Level-3 pre-merge operator approval remains REQUIRED before merging Phase 2I-B or any later Phase 2I runtime slice that changes durable Route Plan / route-history / backup state.**

If implementation reveals that the workbook handoff, Drive permission, provider API contract, or another currently excluded boundary must change, stop and re-scope before continuing.
