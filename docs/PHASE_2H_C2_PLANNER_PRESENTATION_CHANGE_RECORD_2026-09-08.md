# Phase 2H-C2 — Planner Map/List and Responsive Presentation Change Record

Date: 2026-09-08  
Status: **IMPLEMENTED ON BRANCH — FINAL VERIFICATION PENDING**  
Governed base: `9ebafdef7ab356c59990d2bfae4bc5c762876255`  
Implementation branch: `feat/phase-2h-c2-planner-presentation`  
Change class: **Level 2 runtime feature**  
Workbook/router integration: **No workbook/router integration impact.**

## Purpose

Implement only **Phase 2H-C2 — Planner Map/List and Responsive Presentation** from `docs/PHASE_2H_C_PLANNER_FOUNDATION_IMPLEMENTATION_RECORD_2026-09-08.md`.

C2 turns the existing Build Route utility surface into the first responsive single-day planner presentation. It consumes the already-merged C1 `planner-model.js` model instead of creating a second route or planner state.

## Exact user-facing problem

Before C2, Build Route exposes useful route, Workday, optimization, navigation, integration, and maintenance controls, but the current day is still presented primarily as a utility panel and a plain ordered list.

The operator needs one planner-centered surface that can show:

- the current route/day summary;
- one numbered card per physical driving stop;
- every exact work item nested beneath that physical stop;
- current Google ETA/travel/finish/Home facts only when the C1 timing-confidence rules allow them;
- an internal map using only already-saved display coordinates;
- usable desktop and phone layouts without creating separate route state.

## Approved C2 behavior implemented

### Current route/day context

Build Route now groups the existing route selector, optimizer status, Workday controls, C1 day summary, and existing pay summary together.

The day summary displays C1-derived route/date/work/pay/service/timing/map facts. Missing pay or service information remains visibly incomplete; C2 does not convert missing information to a false complete zero.

### Planner cards

The route list is rendered as one planner card per C1 physical stop model.

Each card carries:

- current visible route number;
- exact internal `stopId`;
- saved address;
- governed GIS/DCFS source when present;
- Google ETA only when C1 exposes a current schedule;
- aggregate stop service time/completeness;
- every exact workbook Order ID or manual `Gig_ID` nested as a work row;
- current manual work-order, due-date, pay, assigned-date, locked-day, and service facts when available from governed data.

Several exact work items at one address remain several work rows under one physical driving card.

### Planner map

C2 reuses the already-vendored Leaflet 1.9.4 stack.

The map:

- receives markers only from C1 cards marked map-plottable from saved display coordinates;
- creates at most one numbered marker per physical `stopId`;
- leaves unplottable stops fully present in the ordered card list;
- reports plotted and unplottable counts;
- synchronizes marker/card focus by exact `stopId` only.

Marker/card focus changes only transient presentation state. It does not add/remove/reorder route stops, change optimizer status, complete work, edit pins, write planning data, call Google Optimize, or write Drive/workbook state.

### Responsive presentation

Desktop uses one responsive two-column planner workspace so map and cards can be visible together when space permits.

At phone width, the same C1 model powers a bounded **List / Map** presentation toggle. The toggle is local presentation state only and is not stored in localStorage, route history, backup, or Drive.

### Existing actions preserved

The existing Build Route controls remain present with their existing element IDs and owners. They are regrouped into:

- primary optimization/navigation actions; and
- a collapsible **Route tools & maintenance** area for lower-frequency integration/maintenance controls.

No protected control is renamed or removed by C2.

## Owning files and changed blocks

### `index.html`

Owns only Build Route structure and script loading.

C2:

- adds the planner context/summary/map/list structural containers;
- keeps the existing `routeList` and all existing protected control IDs;
- moves lower-frequency controls into a collapsible utility section;
- statically loads existing `route-work-planning.js` before the planning runtime so planner projection is ready deterministically;
- loads the merged C1 `planner-model.js` before `app.js`;
- bumps only the affected app/CSS cache query versions.

### `styles.css`

Owns only C2 hierarchy and responsive presentation.

The C2 styles are appended under a dedicated Phase 2H-C2 section. They provide summary, card, map, desktop grid, and phone List/Map layouts without changing stored state.

### `app.js`

Remains the Build Route rendering/interaction owner.

The original C1 `app.js` body is preserved byte-for-byte before one appended Phase 2H-C2 section. The initial implementation attempt was deliberately rejected because formatting churn created a noisy 1,558-line app diff. The branch was repaired by restoring the exact C1 app blob and reapplying C2 as an append-only integration block.

The C2 block:

- reads current governed route history and saved stops;
- obtains Phase 2G projection from the existing planning runtime;
- obtains existing manual-gig/pay/Workday facts;
- computes the existing Phase 2H-B current Google schedule basis through the Google browser helpers when available;
- passes those inputs to C1 `buildPlannerModel()`;
- renders summary/cards/map from that model;
- replaces the visible `renderRouteList` implementation only after the existing app has initialized, while continuing to use the same `routeIds`, route snapshots, mutation functions, and protected controls;
- refreshes presentation after route/page, Workday, planning, and Google-status changes.

No new durable route owner is introduced.

### `tests/phase-2h-c-planner-presentation.test.js`

Focused C2 structure/responsiveness/ownership regression suite.

## Read surfaces

C2 reads only existing governed runtime state:

- current selected route slot;
- route-history v6 route snapshot/day context/schedule;
- saved physical stops and saved display coordinates;
- Phase 2G route-work projection/planning data;
- manual gig display/pay data;
- existing route expected-pay summary;
- current Home;
- C1 derived planner model;
- Phase 2H-B schedule-basis helpers for current-schedule confidence.

## Write surfaces

C2 introduces **no new durable write surface**.

Existing explicit route controls continue to call the existing route mutation owners for Up, Down, Remove, optimization, navigation completion, clearing, and handoff actions.

New C2-only state is limited to in-memory presentation state:

- current planner List/Map view;
- currently focused `stopId`;
- Leaflet marker/map instances.

C2 does not add a route-history field, backup field, localStorage key, Drive file, workbook field, OAuth scope, or API key.

## Protected behavior

C2 must preserve:

1. one physical driving stop per saved physical location;
2. every exact workbook Order ID / `Source_ID` and manual `Gig_ID`;
3. same-address work as distinct work rows beneath one stop;
4. Google Route and Basic Route as the only two usable route slots;
5. current route numbering/order and existing Up/Down/Remove semantics;
6. Basic Optimize and Google Optimize ownership;
7. Phase 2G service-duration and planning revision rules;
8. Phase 2H-A local Workday semantics;
9. Phase 2H-B current/stale Google schedule rules and optional Home By behavior;
10. Basic Route withholding Google traffic ETA/Home-By confidence;
11. saved address text and manual-pin priority;
12. workbook inbox and route-order return behavior;
13. Garmin export behavior;
14. Start Navigation / Done & Navigate Next behavior;
15. the existing five top-level pages;
16. existing storage schemas, backup version, Drive files/permissions, workbook schema, and Google routing contract.

## Focused regression coverage

`tests/phase-2h-c-planner-presentation.test.js` protects the C2 integration boundary by checking that:

1. the approved five top-level pages remain exactly the existing set;
2. every protected Build Route control remains present exactly once;
3. one planner summary, map, route list, and bounded List/Map toggle exist;
4. existing planning projection and C1 planner model scripts load before `app.js`;
5. no paid/new Google Maps JavaScript provider is introduced;
6. planner cards consume C1 `stopCards` and nested exact `workItems`;
7. map markers are created only from C1 `mapPlottable` cards and keyed by exact `stopId`;
8. marker/card focus uses exact `stopId` and contains no route/storage mutation path;
9. desktop has a map/list grid while phone switches between one visible planner pane at a time;
10. the C2 section adds no `MutationObserver`, polling interval, alternate route array, or persisted planner-view state.

The existing `tests/phase-2h-c-planner-model.test.js` remains the semantic C1 foundation proving shared-stop identity, incomplete pay/service honesty, current/stale Google timing confidence, Basic no-Google timing confidence, unplottable-stop retention, and non-mutation.

## Primary risks and controls

### Risk: presentation becomes a second source of route truth

Control: C2 renders C1 models but continues to use the existing `routeIds`, route-history snapshots, and mutation functions. List/Map mode and focus are transient only.

### Risk: shared work duplicates a driving stop

Control: cards and map markers are keyed by C1 physical `stopId`; exact work items are nested rows.

### Risk: stale Google timing is displayed

Control: C2 reconstructs the existing Phase 2H-B deterministic schedule basis and supplies it to C1. C1 withholds schedule-derived timing when the basis or service total is stale/mismatched.

### Risk: Basic looks traffic-aware

Control: the same C1 Basic confidence state is rendered; no alternate Basic ETA estimate is created.

### Risk: map omission loses route work

Control: all C1 `stopCards` render in the list. Only the separate marker loop filters by `mapPlottable`.

### Risk: responsive UI creates duplicate events/render loops

Control: no MutationObserver, polling loop, timer loop, or separate mobile route model is added. Event registration is bounded to the existing page controls and C2 view/focus actions.

### Risk: script loading races planning projection

Control: existing `route-work-planning.js` is loaded statically before `work-item-planning-runtime.js`; the existing dynamic loader sees that the contract is already present and does not need to create a second route-work-planning script.

### Risk: review noise hides unrelated runtime changes

Control: the noisy initial `app.js` rewrite was rejected before PR. The final C2 app integration preserves the C1 file and appends one isolated C2 section only.

## Rollback

Known-good C1 runtime baseline:

`9ebafdef7ab356c59990d2bfae4bc5c762876255`

Rollback is a normal revert of this C2 branch/PR to that baseline. No storage migration, route-history repair, Drive cleanup, workbook change, or permission rollback is required.

## Required final verification

Before merge:

1. focused C2 presentation tests pass;
2. existing C1 planner-model tests remain green;
3. exact-head CI passes the complete repository suite and root JavaScript syntax checks;
4. final diff contains only C2 runtime/test/documentation scope.

After publication, the affected live Build Route smoke from the Phase 2H-C implementation record remains required:

- Google Route opens with planner summary/cards;
- Basic switch preserves order and removes Google timing confidence;
- a shared stop remains one physical card with multiple exact work rows;
- an unplottable stop, when available, remains in the list and is reported;
- marker/card focus does not change route membership;
- primary route/navigation actions respond;
- utility/maintenance actions remain reachable;
- desktop and phone layouts remain usable/responsive.

A new billed Google optimization call is not required merely to smoke-test the presentation if a valid saved schedule already exists.
