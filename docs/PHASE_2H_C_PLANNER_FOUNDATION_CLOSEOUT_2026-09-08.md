# Phase 2H-C — Planner Foundation Closeout

Date: 2026-09-08  
Status: **CLOSED — IMPLEMENTED — VERIFIED — LIVE-ACCEPTED**  
Parent implementation record: `docs/PHASE_2H_C_PLANNER_FOUNDATION_IMPLEMENTATION_RECORD_2026-09-08.md`  
Pre-C1 governed baseline: `e6f02f045c0a833fa1a24539b12c8071c98f0c2c`  
Final accepted runtime baseline before this docs-only closeout: `c5b978b27b3f9bb7fe449d362108cd5f86292db7`  
Closeout branch: `docs/phase-2h-c-closeout-20260908`  
Closeout change class: **Level 1 documentation-only**

## Closeout purpose

This record formally closes Phase 2H-C after implementation, automated verification, publication, and operator live acceptance.

The parent implementation record was written before runtime work began and intentionally remains a historical planning record. Its planning-era status language such as **runtime not started** is superseded by this closeout record; the parent record itself is not rewritten.

This closeout changes no runtime behavior.

## Implementation trail

### Phase 2H-C1 — Derived Planner Models

PR **#88 — Phase 2H-C1: add derived planner models**

- merged as `9ebafdef7ab356c59990d2bfae4bc5c762876255`;
- added the pure read-only planner model;
- established one planner stop per physical `stopId` while preserving every exact workbook Order ID / `Source_ID` and manual `Gig_ID` beneath that stop;
- kept work-item count separate from physical-stop count;
- represented missing pay/service as incomplete rather than false zero;
- exposed Google timing only when the governed current schedule basis remained current;
- kept Basic Route free of invented Google traffic confidence;
- retained unplottable route stops in planner identity and list data.

Focused C1 verification after the null-coordinate coercion edge case was corrected:

- **10 passed / 0 failed**;
- `planner-model.js` syntax check passed.

Final C1 runtime verification recorded **426 passed / 0 failed** with first-party JavaScript syntax checks passing.

### Phase 2H-C2 — Planner Map/List and Responsive Presentation

PR **#89 — Phase 2H-C2: planner map/list and responsive presentation**

- merged as `d3e90e46a7fbd20a0d6284793fc1850705b02f73`;
- loaded and rendered the C1 planner model on Build Route;
- added the day summary, one ordered card per physical stop, nested exact work rows, and the Leaflet planner map;
- used only saved display coordinates for planner markers;
- retained and reported unplottable route stops rather than dropping them;
- synchronized marker/card focus by exact `stopId` as presentation-only state;
- preserved every protected Build Route control and the existing five-page navigation;
- used the same derived planner model on desktop and phone;
- kept desktop map/list together and phone on a bounded local List/Map presentation mode;
- added no storage schema, backup schema, Drive file, permission, map provider, package, API key, workbook handoff, or Google optimization contract change.

Exact-head **Verify Contract and App run #278** completed successfully:

- **433 passed / 0 failed**;
- first-party JavaScript syntax checks passed.

### C2 presentation follow-up — independent desktop route-card scrolling

PR **#90 — Phase 2H-C2: make route cards independently scrollable**

- merged as `c5b978b27b3f9bb7fe449d362108cd5f86292db7`;
- made the desktop/tablet route-card pane independently vertically scrollable beside the planner map;
- preserved the existing phone List/Map presentation by returning the card pane to normal document flow at the phone breakpoint;
- changed no app logic, route state, optimization, marker eligibility, storage, Drive, workbook, schema, permission, or routing contract.

The exact-head repository gate passed **433 / 433 tests with 0 failures** and first-party JavaScript syntax checks passed. GitHub Pages then published the merged commit successfully.

The operator completed the affected live check after publication and confirmed: **Works**.

## Phase 2H-C acceptance results

The parent implementation record defined six acceptance outcomes. All are satisfied:

1. **C1 — Real Map/List planner using Leaflet:** satisfied. Build Route now presents the approved Leaflet planner map and ordered planner cards.
2. **C2 — Jobs/work items and physical stops counted separately without duplication:** satisfied. One physical stop remains one card while exact workbook/manual work rows remain distinct beneath it.
3. **C3 — Honest day summary for pay/service/travel/finish/Home:** satisfied. Missing pay/service remains incomplete, and Google travel/finish/Home facts require valid current schedule confidence.
4. **C4 — Google timing confidence only when current; Basic clearly less time-aware:** satisfied. Stale Google timing is withheld and Basic never claims Google traffic confidence.
5. **C5 — Same planner data drives desktop and phone:** satisfied. Responsive presentation changes layout only and does not create a second route or planner model.
6. **C6 — No multi-day/history archive/Replan Remaining:** satisfied. Those features were not added in Phase 2H-C.

## Protected final behavior

Phase 2H-C is now consolidated into the governing documentation:

- `CONTRACT.md` — **Section 9, Phase 2H-C planner protection**;
- `REGRESSION_CHECKLIST.md` — **Planner checks — Phase 2H-C protected baseline**.

Those protections cover:

- one physical stop per planner card;
- exact work identity beneath that stop;
- separate work-item and physical-stop counts;
- honest pay/service completeness;
- current-only Google timing confidence;
- Basic Route's explicit lack of traffic-aware Google confidence;
- saved-display-coordinate-only planner markers;
- unplottable-stop retention;
- presentation-only marker/card focus;
- one planner model across desktop and phone;
- independently scrollable desktop/tablet card presentation beside the map;
- preserved phone List/Map behavior;
- five-page navigation and protected Build Route controls;
- no new provider, permission, schema, Drive file, handoff, or Google routing contract.

## Deliberately excluded from Phase 2H-C

Phase 2H-C does **not** include:

- multi-day planning;
- Replan Remaining;
- detailed completion-history archive;
- a sixth top-level page;
- a new map provider or map package;
- paid Google Maps JavaScript;
- a new OAuth permission;
- a new Drive file or broader Drive ownership;
- a storage or backup schema change;
- a workbook handoff or route-order schema change;
- replacement of the current routing algorithms.

These exclusions remain exclusions after closeout. They are not implied future work inside Phase 2H-C.

## Closeout verification boundary

This closeout PR is documentation-only. It changes no runtime, test, workflow, dependency, build, schema, permission, Drive, workbook, or deployment code.

Under `TESTING_CONTRACT.md`, the prior exact runtime-head verification and live smoke remain valid because the closeout does not modify runtime behavior. Normal repository CI still runs on the closeout PR as the documentation gate.

## Rollback

The closeout itself can be reverted as documentation-only with no runtime or data effect.

Historical pre-Phase-2H-C runtime baseline:

`e6f02f045c0a833fa1a24539b12c8071c98f0c2c`

That historical SHA is recorded for governance only. Closing this phase does not recommend or require runtime rollback.

## Final phase state

**Phase 2H-C is complete and closed.**

Any multi-day planner, completion-history expansion, Replan Remaining behavior, or other post-C planner work must begin as a separately scoped and governed phase. It must not be treated as unfinished Phase 2H-C work.
