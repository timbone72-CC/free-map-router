# Phase 2H-C — Planner Map/List and Summary Foundation Implementation Record

Date: 2026-09-08  
Status: **IMPLEMENTATION PLAN COMPLETE — RUNTIME NOT STARTED**  
Governed runtime baseline: `d68263ce736e4f54ebc37e308dac5c65f4da06bb`  
Parent design: `docs/PHASE_2H_TIME_AWARE_SINGLE_DAY_ROUTING_IMPACT_RECORD_2026-09-04.md`  
Change class: **Level 2 runtime feature**. This implementation record itself is Level 1 documentation-only.  
Workbook/router integration: **No workbook/router integration impact.**

## 1. Purpose

Phase 2H-C turns the existing Build Route utility surface into the first real single-day planner surface while preserving the route, identity, timing, storage, and handoff behavior already protected by Phases 2G, 2H-A, and 2H-B.

This record narrows the already-approved parent Phase 2H-C design into two independently reviewable runtime slices:

- **2H-C1 — Derived Planner Models**
- **2H-C2 — Planner Map/List and Responsive Presentation**

No Phase 2H-C runtime code is authorized outside these two slices by this record.

## 2. Verified current-state evidence

The current product shape and module ownership were checked on `main` before this record was written.

### Build Route today

`index.html` currently owns one existing Build Route page containing:

- the Google Route / Basic Route selector;
- the Phase 2H-A Workday controls;
- Check Workbook Route;
- Basic Optimize;
- Google Optimize;
- Clear Route;
- Open in Google Maps;
- Send Route Order to Workbook;
- Garmin GPX export;
- Clear InspectorADE Jobs;
- Clear Manual Gig Work;
- Google authentication/status;
- optimizer/pay/status messages;
- Start Navigation;
- Done & Navigate Next;
- the current route list.

The capabilities themselves are protected and useful. The product problem is that Build Route still behaves primarily as a utility panel rather than a planner centered on the current day, route summary, map, physical stops, exact work, and timing.

### Runtime ownership today

- `app.js` owns page state and the rendered Build Route list.
- `renderRouteList()` is the existing Build Route list-rendering owner and already refreshes route choice, optimization status, pay summary, map-link actions, and the current list.
- `activeRouteSlot`, `routeIds`, `routeHistory`, saved stops, Home, manual gigs, and the existing Phase 2G/2H planning data are already available without a new durable store.
- `index.html` owns page structure and script loading.
- `styles.css` owns appearance/responsive layout only.
- Leaflet 1.9.4 and its existing tile/attribution model are already vendored and loaded for saved-location pin work.

Therefore Phase 2H-C does not require a storage migration, new routing API, new Drive schema, or new permission.

## 3. Approved user-facing behavior

Phase 2H-C must produce a planner that is truthful before it is decorative.

### Day summary

The Build Route planner summary must expose, at minimum:

- selected route slot and optimizer status;
- route date and departure;
- exact work-item count;
- physical-stop count;
- expected pay and whether the total is complete;
- total known service time and whether the service total is complete;
- Google travel time only when a current valid Google schedule exists;
- estimated field-work finish only when supported by current schedule data;
- estimated Home time only when supported by current schedule data;
- Preferred Finish status/overrun when supported;
- Home By status/conflict when supported;
- count of selected route stops that cannot currently be plotted on the internal map.

Missing pay or service duration must be represented as **incomplete**. The planner must not convert missing required information into a false complete `$0` or `0 min` total.

### Physical-stop cards

Each route card represents exactly one physical driving stop.

At minimum each card must expose:

- visible route number;
- internal exact `stopId`;
- address;
- approved source display where one exists;
- Google ETA/start time only when a current valid schedule supports it;
- aggregate service time and completeness;
- every exact work item attached to the stop;
- each work item's workbook/manual kind and exact identity;
- enough current planning detail to distinguish multiple work items at one address.

Two work items at one address remain two exact work items under one card. They must never create two driving cards merely because there are two assignments.

### Planner map

The internal planner map must:

- reuse the vendored Leaflet 1.9.4 stack;
- use only FMR-owned/saved coordinates that are already valid for display;
- never use Google request-only geocoding coordinates from Phase 2H-B;
- plot at most one route marker for one physical stop;
- preserve the route/list/card entry for an unplottable stop;
- report unplottable count honestly;
- allow marker/card focus to identify the same exact physical stop without changing route membership or route order.

A missing map coordinate is a display limitation, not a reason to drop work from the route.

### Google versus Basic confidence

A current Google Route schedule may support:

- stop ETA/start time;
- traffic-aware travel time;
- estimated field-work finish;
- estimated Home time;
- Preferred Finish status;
- Home By status.

Basic Route may show:

- protected stop order;
- work-item count;
- physical-stop count;
- known/incomplete service total;
- known/incomplete expected pay.

Basic Route must clearly state that traffic-aware ETA/Home-By confidence is unavailable. Phase 2H-C must not invent Google-like timing confidence from the Basic optimizer.

## 4. Hard non-goals

Phase 2H-C does **not** add:

- multi-day assignment or Route Plan/Day storage;
- Replan Remaining From Here;
- permanent completed-route history;
- generic High/Medium/Low priority;
- known-road or construction restriction behavior;
- a sixth top-level app page;
- a second route state or mobile-only data model;
- a new map provider;
- a new JavaScript package dependency;
- a new API key;
- a paid Google Maps JavaScript client API;
- a new OAuth scope or broader Drive access;
- a new Drive file/folder;
- a route-history or backup schema change;
- a workbook Address Inbox schema change;
- a route-order return schema change;
- a Google optimization request/response contract change.

Protected controls may be regrouped visually, but they are not renamed or removed by this phase without separate approval.

## 5. Phase 2H-C1 — Derived Planner Models

### Goal

Create pure, read-only planner derivation so desktop and phone presentation consume the same trustworthy planner facts and the DOM never becomes the source of route truth.

### Proposed owning module

Add one narrow first-party module:

`planner-model.js`

It must be loaded before `app.js` and expose pure planner-model helpers through one FMR namespace. It is not a post-load UI rewriter and must not register event handlers, timers, polling, or observers.

### C1 read surfaces

The model may read normalized/current inputs supplied by its caller from:

- selected route snapshot and exact route order;
- route optimization status;
- route-history v6 `dayContext`;
- current Google schedule when structurally/currently valid;
- saved physical stops and their saved display coordinates;
- exact workbook Order IDs / `Source_ID`s attached to the selected route;
- exact manual `Gig_ID`s attached to the selected route;
- Phase 2G route-work projection and planning metadata;
- manual gig metadata needed for display/pay;
- existing expected-pay data.

### C1 write surfaces

None.

The derived planner module must not write:

- `localStorage`;
- route history;
- route membership/order;
- optimization status;
- Workday context;
- planning records;
- saved stops or pins;
- manual gigs;
- workbook handoff state;
- Drive files;
- DOM state.

### C1 required outputs

The model must return normalized derived data sufficient for:

1. a `daySummary` model;
2. ordered `stopCards` models;
3. map-plottable versus unplottable stop identity;
4. explicit timing-confidence state that distinguishes current Google schedule from Basic/no-current-schedule states.

The exact internal property names may be chosen during implementation, but they must preserve the behavior in this record and the parent Phase 2H design.

### C1 focused regression fixtures

Focused tests must prove at least:

1. one physical stop with two exact work items produces one card with two exact work rows;
2. work-item count may exceed physical-stop count without identity loss;
3. missing required pay produces an incomplete pay summary rather than a false complete zero;
4. unknown manual service duration produces incomplete service status rather than zero;
5. a current valid Google schedule supplies ETA/travel/field-finish/Home facts;
6. stale or mismatched schedule facts are not exposed as current;
7. Basic Route receives no traffic-aware ETA/Home-By confidence;
8. a route stop lacking saved display coordinates remains a full stop card and increments unplottable count;
9. model derivation does not mutate any supplied route, stop, work-item, gig, planning, day-context, or schedule input.

### C1 likely files

Expected narrow scope:

- `planner-model.js` — new pure derived-model module;
- `index.html` — script load only, if required;
- `tests/phase-2h-c-planner-model.test.js` — focused model tests;
- contract/regression documentation required to protect the implemented C1 boundary.

If implementation proves another runtime owner is required, work stops before adding that owner and this record is amended.

### C1 acceptance gate

C1 is accepted when the model is independently testable, produces truthful planner facts for Google/Basic/shared-stop/incomplete/unplottable fixtures, mutates no durable state, and exact-head CI is green.

C1 does **not** need to expose the final Map/List UI yet.

## 6. Phase 2H-C2 — Planner Map/List and Responsive Presentation

### Goal

Render the C1 planner models into Build Route as the first modern planner surface while preserving all current route actions and state ownership.

### C2 owning surfaces

- `app.js` remains the owner of Build Route render/interaction state.
- `index.html` owns the Build Route structural markup.
- `styles.css` owns hierarchy and responsive presentation.
- existing vendored Leaflet owns map rendering only; it does not become a new route state.

No separate post-load script may rewrite `app.js` output.

### C2 presentation structure

Build Route should be reorganized around this hierarchy:

1. **Current route/day context**
   - route slot selector/status;
   - existing Workday controls;
   - day summary.

2. **Planner**
   - internal Leaflet map;
   - ordered physical-stop cards / work rows;
   - marker/card focus synchronization by exact `stopId`.

3. **Primary planning/execution actions**
   - existing optimization actions;
   - existing Start Navigation / Done & Navigate Next field actions.

4. **Utility / integration / maintenance actions**
   - Check Workbook Route / Start New Route state;
   - Open in Google Maps;
   - Send Route Order to Workbook;
   - Garmin export;
   - route/work clearing controls;
   - existing Google auth/status messaging.

This is a hierarchy change, not permission to delete useful controls.

### Responsive behavior

The same C1 models must drive both layouts.

Desktop may show map and cards together when space permits.

Phone may use a bounded Map/List focus control or stacked/focused presentation so the operator is not forced to view two unusably narrow columns. Any phone mode is presentation state only; it must not create a second route, second planner model, or duplicated event-registration loop.

### Map/list interaction

Marker/card focus may change only the currently highlighted planner stop.

It must not by itself:

- add/remove a route stop;
- reorder the route;
- mark work complete;
- change route optimization status;
- edit a saved pin;
- write planning data;
- trigger Google Optimize;
- write Drive/workbook state.

Existing explicit controls remain the only owners of those mutations.

### C2 focused regression checks

Focused UI/model integration tests must prove at least:

1. one shared physical stop renders one numbered planner card with every exact work row;
2. route numbers remain aligned with selected Google/Basic route order;
3. map markers are derived only from valid saved display coordinates;
4. unplottable route stops remain visible in cards/list and are never removed from route state;
5. marker selection and card selection resolve to the same exact `stopId`;
6. marker/card focus does not change route membership/order/optimizer status;
7. current Google schedule timing appears only while current;
8. Basic planner view clearly withholds traffic-aware ETA/Home-By confidence;
9. every existing protected Build Route control remains present and responsive after regrouping;
10. desktop/phone presentation does not create duplicate event handlers, render loops, polling, MutationObservers, or alternate route state;
11. the navigation menu remains exactly the existing five top-level pages;
12. no new map dependency/provider/API key/OAuth permission is introduced.

### C2 affected live smoke check

After publication, the affected Build Route smoke must verify:

- Google Route opens with planner summary/cards;
- switching to Basic Route preserves its order and visibly removes Google timing confidence;
- one shared-stop example remains one physical card with multiple work rows;
- at least one unplottable-stop case, if available in the safe/live fixture, stays in the list and is reported rather than dropped;
- marker/card focus works without changing route membership;
- primary navigation/optimization controls still respond;
- utility/maintenance controls remain reachable;
- desktop and phone layouts remain usable and responsive.

A new billed Google optimization request is not required merely to smoke-test presentation when a current valid saved schedule is already available. If a new Google call is necessary to prove a changed runtime boundary, use the smallest affected route.

## 7. Protected behavior across both C slices

Both slices must preserve:

1. one physical driving stop per saved physical location;
2. every exact workbook Order ID / `Source_ID` and manual `Gig_ID`;
3. same-address work remaining distinct under one physical stop;
4. Google Route and Basic Route as separate usable route slots;
5. current route numbering/order;
6. Phase 2G service-duration rules and planning revision rules;
7. Phase 2H-A local Workday context semantics;
8. Phase 2H-B Google schedule validity/staleness rules;
9. Basic Route as non-Google fallback with no invented traffic confidence;
10. manually verified pin priority and saved-address text;
11. route-order return behavior;
12. workbook inbox behavior;
13. Garmin export behavior;
14. Start Navigation / Done & Navigate Next behavior;
15. current five-page navigation;
16. existing storage schemas, Drive files, OAuth permissions, Google routing contract, and backup format.

## 8. Risks and failure behavior

### Risk: DOM becomes planner truth

Control: C1 is pure derived data; `app.js` renders from current governed state. DOM selection never becomes route membership.

### Risk: shared work duplicates a driving stop

Control: stop cards are keyed by physical `stopId`; exact work remains nested beneath the stop.

### Risk: stale Google ETA is displayed as current

Control: schedule-derived fields are exposed only through existing governed current-schedule validation. Stale/mismatched schedule state must be withheld/flagged.

### Risk: Basic Route appears traffic-aware

Control: Basic has an explicit no-current-Google-schedule confidence state and never receives Google ETA/Home-By facts.

### Risk: map omissions lose work

Control: map-plottability is derived display metadata only. Cards/list and route identity remain complete.

### Risk: responsive UI freezes or duplicates handlers

Control: no observer/polling/timer solution; event registration remains bounded; render functions are idempotent; same derived model powers both layouts.

### Risk: UI cleanup expands into unrelated redesign

Control: only Build Route hierarchy needed for planner behavior is in scope. Other pages are preserved.

## 9. Rollback

The known-good pre-2H-C runtime baseline is:

`d68263ce736e4f54ebc37e308dac5c65f4da06bb`

C1 and C2 should be separate PRs so either can be reverted independently.

Rollback must require only reverting planner model/presentation code. It must not require deleting or migrating:

- route-history v6;
- valid Google schedule data;
- planning records;
- saved stops/pins;
- manual gigs;
- workbook data;
- Drive files.

## 10. Verification plan

For each runtime slice:

1. run only the focused tests for the changed behavior during development;
2. stop on any focused failure and repair before continuing;
3. inspect every changed block for scope drift;
4. run the complete repository suite and JavaScript syntax checks once on the exact final runtime head, with successful CI satisfying that gate;
5. merge through its own PR only after the Level-2 gates are green;
6. perform only the affected Build Route live smoke check after publication.

No Level-3 second approval is required while the work remains inside this Level-2 presentation/derived-model scope. If implementation discovers a need for storage schema, migration, permissions, Google routing-contract changes, deployment changes, or cross-system synchronization changes, implementation stops and the change must be reclassified before expanded work continues.

## 11. Implementation order

The governed order is:

1. merge this documentation-only implementation record;
2. implement and validate **2H-C1 — Derived Planner Models** only;
3. publish/live-check C1 only if it changes a live loaded module, then close that slice;
4. implement and validate **2H-C2 — Planner Map/List and Responsive Presentation** only;
5. complete the affected desktop/phone Build Route smoke;
6. update the product contract/regression protection to the final implemented 2H-C behavior and close Phase 2H-C before beginning multi-day work.

Do not combine later multi-day, route-plan, road-restriction, or Replan Remaining work into these PRs.

## 12. Integration statement

**No workbook/router integration impact.**

Phase 2H-C reads already-present route/work identity for display. It does not change the InspectorADE workbook producer, FMR inbox consumer, selectable sync behavior, `Source + Source_ID` identity, route-order return, workbook history, prediction data, or manual-gig handoff schema.
