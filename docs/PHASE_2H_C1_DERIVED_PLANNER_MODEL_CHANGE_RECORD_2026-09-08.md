# Phase 2H-C1 — Derived Planner Models Change Record

Date: 2026-09-08  
Status: **IMPLEMENTED ON BRANCH — FOCUSED VERIFICATION PASSED — FINAL CI PENDING**  
Governed base: `e6f02f045c0a833fa1a24539b12c8071c98f0c2c`  
Implementation branch: `feat/phase-2h-c1-derived-planner-models`  
Change class: **Level 2 runtime feature**  
Workbook/router integration: **No workbook/router integration impact.**

## Purpose

Implement only **Phase 2H-C1 — Derived Planner Models** from
`docs/PHASE_2H_C_PLANNER_FOUNDATION_IMPLEMENTATION_RECORD_2026-09-08.md`.

C1 creates one pure read-only planner model that can later power the Phase 2H-C2 Build Route Map/List surface. It does not render the planner yet and does not change live Build Route behavior by itself.

## Exact user-facing problem being prepared for

Build Route currently has route/work/pay/timing facts spread across existing route, work-item planning, gig, and Google schedule state. A modern planner needs one trustworthy derived representation before desktop and phone UI are allowed to render those facts.

Without a derived model, the DOM could become a second source of route truth, shared physical stops could be duplicated, missing pay/service data could look like zero, and stale Google schedule data could be shown as current.

## Approved C1 behavior

`planner-model.js` derives, without mutation:

- one ordered stop card per physical `stopId` in the selected route;
- every exact workbook Order ID / `Source_ID` and manual `Gig_ID` nested under its physical stop;
- exact work-item count separately from physical-stop count;
- known service time plus explicit completeness;
- known expected pay plus explicit completeness;
- approved GIS/DCFS source display only;
- map-plottable versus unplottable route-stop identity using only saved display coordinates;
- current Google ETA/travel/field-finish/Home facts only when the supplied current schedule basis matches the stored Google schedule and service totals still agree;
- explicit Basic/no-current-Google timing-confidence states.

Missing required pay or service time remains **incomplete** rather than becoming a false complete zero.

A route stop without a saved display coordinate remains a full stop card and remains part of route identity. Map plottability is display metadata only.

## Runtime ownership and files

### New runtime module

`planner-model.js`

- UMD-style module for Node tests and future browser use;
- exposes `FMRPlannerModel` when loaded in a browser;
- pure functions only;
- no event handlers;
- no timers, polling, observers, network calls, storage access, or DOM access.

### Focused tests

`tests/phase-2h-c-planner-model.test.js`

### Deliberately unchanged in C1

- `index.html` — the module is not loaded into the live page yet;
- `app.js` — no planner rendering/integration yet;
- `styles.css` — no C2 presentation yet;
- route-history schema/version;
- backup schema/version;
- Google optimization request/response contract;
- Drive files/permissions;
- workbook handoff and route-order return.

C2 owns browser loading and presentation integration when the planner Map/List surface is implemented.

## Read surfaces

The pure model accepts caller-supplied current state only:

- selected route slot and route snapshot;
- Phase 2G route planning projection;
- existing route expected-pay summary;
- saved stop display data/coordinates;
- optional exact work-item display details;
- shared Workday `dayContext`;
- caller-computed current Google schedule basis key.

It does not fetch or mutate these sources itself.

## Write surfaces

**None.**

The module does not write:

- localStorage;
- route history;
- route order/membership;
- optimizer status;
- Workday timing;
- Phase 2G planning records;
- saved stops/pins;
- manual gigs;
- DOM state;
- Drive;
- workbook handoff state;
- network/API state.

## Schedule-confidence boundary

C1 does not take ownership of Google request preparation or schedule-basis construction.

The caller supplies the current deterministic basis key already governed by Phase 2H-B. C1 exposes Google schedule facts only when all of these remain true:

1. selected slot is Google;
2. Google route status is `google_optimized`;
3. a stored schedule exists;
4. its `basisKey` equals the caller-supplied current basis key;
5. schedule visits map one-to-one to the current route IDs in exact order;
6. required schedule timestamps/durations are valid;
7. schedule total service seconds still agree with the C1-derived current route service total.

If any check fails, the route order remains available but ETA/travel/finish/Home confidence is withheld.

Basic Route never receives traffic-aware Google timing confidence.

## Pay/service honesty

C1 consumes the existing governed pay summary rather than recalculating workbook/gig pay ownership.

C1 consumes the existing Phase 2G per-stop work projection rather than recreating service-duration rules.

Therefore:

- ordinary workbook 5-minute/default/interior behavior remains owned by Phase 2G;
- unknown manual-gig service time remains unknown;
- shared-stop durations remain summed once at the physical stop;
- missing represented pay remains incomplete;
- the planner does not invent `$0` or `0 min` completeness from missing data.

## Coordinate boundary

Only a complete finite latitude/longitude pair is considered map-plottable.

A focused development test exposed and fixed a JavaScript coercion edge case where `Number(null)` could otherwise appear as coordinate `0`. The model now rejects null, undefined, and empty coordinate values before numeric conversion.

Google request-only geocoding coordinates are not an input to C1 and are never used for map plottability.

## Focused verification

Development focused run after the coordinate fix:

- **10 passed / 0 failed**
- `node --check planner-model.js` passed.

The focused suite proves:

1. one physical stop with two exact work items yields one card with two work rows;
2. work-item count remains separate from physical-stop count;
3. missing represented pay is incomplete rather than false zero;
4. unknown manual service duration remains incomplete rather than zero;
5. current Google schedule supplies ETA/travel/field-finish/Home facts;
6. stale/mismatched schedule basis hides Google timing confidence;
7. Basic Route never receives Google timing confidence;
8. an unplottable stop remains a full card and increments unplottable count;
9. planner derivation does not mutate supplied inputs;
10. a schedule whose service total disagrees with the derived current route service is not exposed as current.

Final complete repository CI and root JavaScript syntax checks remain required on the exact final branch head before merge.

## Contract protection introduced by C1

The following behavior becomes the C1 protected planner-model contract once merged:

1. Planner derivation is read-only and never becomes a second route/storage owner.
2. One planner stop represents one physical stop; exact workbook/manual work identities remain distinct beneath it.
3. Work-item count and physical-stop count are separate facts.
4. Missing required pay/service is represented as incomplete, never silently completed as zero.
5. Google timing facts are planner-current only when the governed current schedule basis and current service total still match.
6. Basic Route never claims traffic-aware Google ETA/Home-By confidence.
7. Missing saved map coordinates do not remove route work; the stop remains in planner identity and is counted unplottable.
8. C1 does not alter storage schemas, API contracts, workbook handoff, Drive permissions/files, route order, pins, or existing controls.

## Regression protection introduced by C1

The focused C1 regression baseline is:

- [ ] shared physical stop renders in the model once with all exact work rows;
- [ ] work-item count can exceed physical-stop count without identity loss;
- [ ] incomplete pay stays incomplete;
- [ ] unknown manual service time stays incomplete;
- [ ] only a current matching Google schedule exposes ETA/travel/finish/Home facts;
- [ ] mismatched schedule service total withholds timing confidence;
- [ ] Basic Route exposes no Google traffic timing confidence;
- [ ] unplottable route stop stays in stop cards and route identity;
- [ ] null/empty coordinates are not coerced into valid map points;
- [ ] model derivation leaves every supplied input unchanged;
- [ ] no C1 path writes storage, DOM, network, Drive, or workbook state.

These checks supplement the existing Phase 2G and Phase 2H-B sections of `REGRESSION_CHECKLIST.md`; they do not replace those protected baselines.

## Risks and controls

### Shared work duplicates a driving stop

Control: cards are built in exact route-ID order with one card per physical `stopId`; work items are nested rows.

### Stale Google ETA appears current

Control: timing confidence requires matching current basis, exact visit order, valid schedule structure, and matching current service total.

### Basic appears traffic-aware

Control: Basic always receives an explicit no-Google-confidence state.

### Missing coordinates drop work

Control: plottability is derived metadata; route cards and identities remain complete.

### Model mutates runtime state

Control: module has no write surface; focused input-immutability test protects this boundary.

## Rollback

Known-good pre-C1 runtime baseline:

`e6f02f045c0a833fa1a24539b12c8071c98f0c2c`

Rollback requires only reverting the C1 model/test/change-record commits. No data migration, Drive cleanup, route-history repair, or workbook action is required.

## Publication / live smoke

C1 deliberately does not load `planner-model.js` from `index.html` and does not render user-facing planner UI. Therefore it has no new affected live operator surface to smoke in this slice.

The publication check for C1 is that existing live behavior remains unchanged. Browser loading, model wiring, Map/List rendering, and the affected Build Route live smoke belong to **2H-C2**.

## Next slice after C1 acceptance

**Phase 2H-C2 — Planner Map/List and Responsive Presentation** only.
