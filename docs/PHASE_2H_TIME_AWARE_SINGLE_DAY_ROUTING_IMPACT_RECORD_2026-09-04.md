# Phase 2H — Time-Aware Single-Day Routing and Planner UI Foundation

Date: 2026-09-04  
Status: DESIGN COMPLETE — IMPLEMENTATION NOT STARTED  
Governed baseline: `main` merge commit `7444e17d0ab9657adac2f9f53a730aa5de629019` (Phase 2G)  
Change class: Phase 2H overall is Level 3 because it changes route-history/backup schema and the Google routing contract.  
Implementation branch: not created by this record.  
Pre-merge approval: required separately for each runtime slice under `CHANGE_CONTROL_CONTRACT.md`.

## 1. Purpose

Phase 2H turns the current single-day route into a time-aware planning surface without starting multi-day assignment yet.

It must build on the exact work-item planning foundation delivered by Phase 2G:

- exact work identity is separate from physical-stop identity;
- several exact work items may share one physical driving stop;
- service duration is planned per exact work item and aggregated at the stop;
- unknown manual-gig service time remains unknown rather than becoming zero;
- planning edits do not reorder the route or mutate workbook identity.

Phase 2H adds three governed slices only:

- **2H-A — Workday Context and Timing Controls**
- **2H-B — Time-Aware Google Optimization**
- **2H-C — Planner Map/List and Summary Foundation**

No Phase 2H runtime code may be written until this record and the Phase 2G contract/regression documentation are reviewed as the governing plan.

## 2. Baseline evidence

Phase 2G is merged into `main` through PR #77. Its implementation established:

- exact planning identity `kind + workItemId`;
- route-work projection from exact workbook Order IDs / `Source_ID`s and exact manual `Gig_ID`s;
- one physical stop for multiple exact work items at the same location;
- five-minute ordinary workbook default;
- twenty-minute interior default only through an explicitly verified interior resolver;
- explicit unknown duration for manual gigs with no override;
- per-stop service aggregation and route total service time;
- revision-checked planning writes;
- backup version 3 with planning preservation;
- Build Route planning controls that refresh planning projection without changing route order.

The route-planner audit and consolidated roadmap already establish the Phase 2H product direction:

- 3:00 PM is a preferred field-work finish, not a hard cutoff;
- 5:00 PM is the default editable home-by bound;
- future departure time must drive traffic-aware optimization;
- Google schedule/ETA facts should be retained for cards and summaries;
- the planner belongs inside the existing Build Route page;
- exact work items remain visible beneath one physical stop;
- expected pay, service time, drive time, work finish, and home time belong in the modern planning summary;
- no generic High/Medium/Low priority is part of the first planner release;
- no permanent detailed completed-route history is introduced here;
- Replan Remaining From Here is later Phase 2K work.

## 3. Phase-wide protected invariants

Every 2H slice must preserve all of the following:

1. Home remains the unnumbered start and finish of the ordinary single-day round trip.
2. Google Route and Basic Route remain separate usable route slots.
3. Basic Route remains the non-Google fallback and must not claim traffic-aware ETA/home-by confidence it does not possess.
4. Every selected physical stop remains exactly once unless the operator explicitly changes route membership.
5. Exact work identity remains independent from physical-stop identity.
6. Multiple workbook jobs and/or manual gigs at one physical address remain distinct work items under one driving stop.
7. No address text, stop ID, vendor work-order text, or display label may substitute for exact workbook Order ID / `Source_ID` or immutable `Gig_ID`.
8. Phase 2G service-duration rules remain unchanged.
9. Unknown manual work duration is never silently treated as zero.
10. Planning/timing changes never modify workbook history, prediction data, pending inbox identity, manual-gig identity, reusable Manual Work Library identity, or address-correction identity.
11. Manually corrected pins remain protected.
12. Google request-only geocoding must not silently rewrite saved coordinates or address text.
13. The existing 30-second solver budget through 32 stops and 60-second budget beginning at 33 stops remain protected unless a separate governed reliability change is approved.
14. Whole-second Google timestamps remain protected; fractional protobuf nanos must not be reintroduced.
15. A partial, skipped, duplicate, unknown, stale, or otherwise incomplete Google route is never applied as a complete route.
16. Existing workbook route-order return behavior and exact IDs remain unchanged by 2H.
17. The app remains a five-page application. Phase 2H adds no sixth/top-level planner page.

## 4. Slice 2H-A — Workday Context and Timing Controls

### Goal

Give the current one-day route an explicit day/time context before any Google request starts using it.

### User-facing controls

Build Route gains one compact workday-controls area containing:

- **Route date** — local calendar date;
- **Departure** — local time;
- **Preferred field-work finish** — local time, default `15:00`;
- **Home by** — local time, default `17:00`.

For a route with no saved context:

- Route date defaults to the operator's current local date;
- Departure defaults to the operator's current local clock time at minute precision;
- Preferred finish defaults to 3:00 PM;
- Home by defaults to 5:00 PM.

Defaults make an ordinary same-day route immediately usable. They are not a wizard and do not require a separate setup step.

### Time semantics

The durable values are local planning values, not UTC calendar fields:

```text
routeDate            YYYY-MM-DD
 departureTime       HH:MM
 preferredFinishTime HH:MM
 homeByTime          HH:MM
 timeZone            IANA time-zone identifier
```

The browser resolves these local planning values to whole-second RFC3339 instants only when a Google request needs them.

Rules:

- `homeByTime` must resolve later than `departureTime` for the selected route date;
- preferred finish is soft and may fall before the actual last work completion without invalidating the route;
- a nonexistent/invalid local time caused by timezone/DST rules fails visibly instead of silently shifting to another clock time;
- changing browser/device timezone must not reinterpret an already saved route day as another calendar day because the saved IANA timezone remains part of the context.

### Storage/schema decision

Phase 2H-A advances route history from version 5 to **version 6**.

Version 6 adds one top-level single-day context shared by the Google and Basic slots:

```text
dayContext:
  routeDate
  departureTime
  preferredFinishTime
  homeByTime
  timeZone
```

Version 6 also reserves an optional normalized `schedule` field on route snapshots. 2H-A initializes/preserves that field but does not populate Google schedule data; 2H-B owns population.

This is deliberately part of route history rather than a new independent store because the values describe the current one-day route. Phase 2I can therefore migrate the existing route plus `dayContext` into its future one-day Route Plan/Day model without leaving behind a temporary 2H-only datastore.

Migration behavior:

- valid route-history versions before 6 remain readable;
- existing Google, Basic, and pending route identity/order/metadata are preserved;
- older history begins with `dayContext = null` and `schedule = null` rather than receiving fabricated historical timing;
- the UI derives the normal defaults when no saved context exists;
- the context becomes durable after the operator changes timing or begins a time-aware Google optimization.

### Backup decision

Whole-app backup advances from version 3 to **version 4** so the route-history v6 day context and optional schedule are governed recovery data.

- valid backup versions 1, 2, and 3 remain restorable;
- version 3 planning records remain preserved;
- older backups restore with no saved day context/schedule and use normal UI defaults;
- no new Drive file, folder, OAuth scope, or permission is introduced.

### 2H-A existing checks depended on

- Home remains separate from job stops.
- Google and Basic snapshots preserve their own exact Order IDs / `Gig_ID`s.
- Phase 2G planning identity and service-duration behavior remain unchanged.
- Backup recovery remains backward compatible.
- Build Route remains responsive and one selected page is visible.

### 2H-A new regression checks required before implementation is complete

- route-history v5 migrates to v6 without route/order/work identity loss;
- day context round-trips exact local date/time/timezone values;
- backup v4 preserves day context and valid planning;
- backup v1/v2/v3 restores safely with no invented day context;
- home-by earlier than/equal to departure is rejected visibly;
- DST/nonexistent local time fails closed;
- timing edits do not change route order, membership, optimizer status, work identity, source, pay, or workbook data;
- starting a genuinely new workbook route clears stale schedule data and begins with a fresh/default day context rather than inheriting an old route's ETA.

### 2H-A acceptance criteria

A1. An ordinary current-day route opens with useful timing defaults and no extra setup page.  
A2. The operator can edit all four visible timing controls.  
A3. Saved local values survive reload without UTC/date drift.  
A4. Existing routes/backups migrate without identity/order loss.  
A5. Timing edits alone never optimize or reorder a route.  
A6. No Google API request behavior changes in this slice.

## 5. Slice 2H-B — Time-Aware Google Optimization

### Goal

Make Google Optimize model the actual workday rather than a zero-service route starting at button-press time.

### API-contract decision — resolved before code

Phase 2H-B **extends the existing FMR `/optimize` contract additively**. It does not create `/optimize-v2`, does not replace the existing endpoint, and does not create a second Google routing system.

This decision is intentional because the existing endpoint already owns authentication, request validation, request-only Google geocoding, one-vehicle routing, complete-response validation, timeout policy, and Google error reporting.

#### Backward-compatible request extension

Existing request fields remain valid:

```text
requestId
home
stops[]
```

Each stop gains one optional normalized field:

```text
serviceDurationSeconds
```

The request gains one optional top-level object:

```text
timing:
  departureTime
  homeByTime
```

Contract rules:

- `serviceDurationSeconds` is a finite nonnegative whole number;
- the browser derives it from the Phase 2G physical-stop service projection;
- a work-bearing stop with an unknown Phase 2G duration blocks the new time-aware Google request and identifies the missing work item(s);
- an app-only stop with no exact work item may explicitly carry zero service duration because no work duration exists to model;
- `departureTime` and `homeByTime` are whole-second RFC3339 instants;
- `departureTime < homeByTime`;
- `preferredFinishTime` is deliberately **not sent** as a Google hard constraint because it is a soft operator preference;
- legacy callers that omit `timing` and `serviceDurationSeconds` remain accepted under the legacy behavior while rollout is in progress.

#### Safe deployment implication

Because the extension is additive:

1. the backend may be deployed first and continue accepting the old browser request;
2. an older browser may ignore additive response fields without route loss;
3. the new browser must not be published until the compatible backend is live;
4. rollback may restore the prior browser while leaving the additive backend temporarily in place.

This ordered rollout is required for 2H-B.

### Google request mapping

For a time-aware request:

- each physical stop remains one Google shipment/visit;
- the visit `duration` is the aggregate Phase 2G service duration for that physical stop;
- `model.globalStartTime` equals the selected departure instant;
- `model.globalEndTime` equals the selected home-by instant;
- the single vehicle keeps Home as both start and end;
- `startTimeWindows` pins the vehicle departure to the selected departure instant using an exact hard window (`startTime == endTime == departureTime`);
- `endTimeWindows` allows return to Home from departure through the selected home-by instant;
- `costPerTraveledHour` remains the routing objective;
- `considerRoadTraffic` remains true;
- no distance cost is added;
- the 30s/60s solver-timeout boundary remains unchanged;
- Google timestamps remain whole-second values.

Google's published Route Optimization model explicitly supports visit duration plus vehicle start/end time windows. Hard time windows can make work infeasible; they are therefore appropriate for Home By, while Preferred Finish remains an app-side soft comparison.

Reference documentation used for this design:

- Google Route Optimization `ShipmentModel`, `VisitRequest`, `TimeWindow`, and `Vehicle` reference: https://developers.google.com/maps/documentation/route-optimization/reference/rest/v1/ShipmentModel
- Time-window concepts: https://developers.google.com/maps/documentation/route-optimization/concepts/time-windows
- Response fields / schedule facts: https://developers.google.com/maps/documentation/route-optimization/parameter-list
- Timeout guidance: https://developers.google.com/maps/documentation/route-optimization/timeouts

### Geocoding boundary

When the backend resolves a written address for Google routing, it must preserve that stop's `serviceDurationSeconds` while replacing only its request location with Google coordinates.

Google request-only geocoding coordinates remain request-only. Phase 2H does **not** return those Google geocoding coordinates for display on the Leaflet planner map and does not persist them as saved pins.

### Additive response extension

Existing response fields remain:

```text
requestId
orderedStopIds
skippedStopIds
totalDistanceMeters
totalDurationSeconds
```

A valid time-aware result adds:

```text
schedule:
  vehicleStartTime
  vehicleEndTime
  travelDurationSeconds
  totalServiceDurationSeconds
  waitDurationSeconds
  visits[]:
    stopId
    startTime
```

Rules:

- schedule timestamps are whole-second RFC3339 instants;
- `visits[]` must map one-to-one to the accepted ordered stop IDs;
- no duplicate/unknown/missing visit may be accepted;
- `totalServiceDurationSeconds` must agree with the normalized stop-service input, not a guessed UI value;
- transition geometry and dense timetable data are not required in 2H;
- Google geocode coordinates are not part of this response contract.

### Home-by conflict / overflow behavior

Home By is a hard planning bound.

If the selected work cannot be completed and the vehicle returned Home within the requested window:

- no partial Google route is applied;
- no skipped stop is silently omitted;
- the operator receives a visible **Home By conflict** explaining that the selected work does not fit the current day/time/service assumptions;
- the operator must change the selected work, service duration, departure, or Home By and run Google Optimize again;
- a separate silent automatic relaxation is prohibited.

Editing Home By later is an explicit operator adjustment and therefore satisfies the roadmap's requirement for an operator-controlled override path without adding a second hidden mode.

If Google reports traffic infeasibility or an incomplete schedule, the app must not label that result Home-By-safe. The result fails visibly and the prior accepted route remains recoverable.

### Preferred-finish behavior

Preferred finish is evaluated after a complete accepted schedule:

- field-work finish = the end of service at the final physical work stop;
- finishing after the preferred field-work time produces a visible overrun/warning;
- that warning does not invalidate the route if the route still returns Home within Home By;
- no Google shipment time window is created from the preferred-finish value in Phase 2H.

### Schedule persistence and stale-output protection

The accepted Google schedule is stored only with the Google route snapshot in route-history v6. Basic Route has no authoritative Google schedule.

The schedule must carry or be validated against a deterministic schedule basis containing the facts that make its ETA valid:

- current Google route stop order;
- Home location identity used for routing;
- per-stop service-duration seconds;
- departure instant;
- home-by instant.

A schedule is stale and must not be displayed as current if any basis input changes.

Examples that make a schedule stale:

- Up/Down/manual route reorder;
- route membership change;
- Start New Route;
- Home change;
- service-duration planning change for routed work;
- route date/departure/home-by change.

A stale schedule does not delete the route order. It simply removes ETA/home-time confidence until Google Optimize is run again.

### 2H-B existing checks depended on

- Google traffic-aware time objective remains active.
- Home round trip remains one vehicle.
- complete-response validation rejects skipped/missing/duplicate/unknown stops.
- 30s through 32 stops / 60s from 33 stops remains protected.
- whole-second traffic timestamps remain protected.
- Phase 2G one-stop/multiple-work identity and service aggregation remain protected.
- manual pins remain protected and ordinary Google geocoding remains request-only.

### 2H-B new regression checks required

- exact aggregate service duration is emitted on every work-bearing Google visit;
- two work items at one stop remain one Google visit with summed service duration;
- unknown manual-gig duration blocks time-aware optimization rather than becoming zero;
- selected future departure, not Optimize button time, controls the model start;
- Home By controls the hard model end/vehicle end window;
- exact departure is pinned by the vehicle start window;
- preferred finish is absent from the Google hard constraints;
- provider retains vehicle start/end, visit start times, travel/service/wait totals;
- schedule visit IDs match the complete accepted route exactly;
- infeasible Home By / skipped work fails visibly and applies no partial route;
- traffic-infeasible or structurally incomplete schedule is not presented as Home-By-safe;
- schedule becomes stale after timing/service/order/membership/Home changes;
- legacy request without timing remains accepted during ordered rollout;
- backend-first / browser-second compatibility is verified;
- 32-stop request retains `30s`; 33-stop request retains `60s` with the new timing constraints.

### 2H-B acceptance criteria

B1. Google uses realistic aggregate stop service duration.  
B2. Google uses the operator-selected departure and Home By rather than button-press time plus an arbitrary 24-hour horizon.  
B3. Every selected stop is either present exactly once in one complete route or the entire result is rejected.  
B4. A route that cannot meet Home By fails visibly and does not silently drop work.  
B5. A route that exceeds Preferred Finish but still meets Home By remains valid and clearly reports the overrun.  
B6. Useful schedule/ETA facts survive validation and are available to 2H-C.  
B7. Basic Route remains unchanged as the protected fallback.

## 6. Slice 2H-C — Planner Map/List and Summary Foundation

### Goal

Turn Build Route from a utility list into the first real planner surface without adding multi-day behavior or decorative redesign.

### Page/navigation boundary

- Build Route remains the owning page.
- No new top-level page or sixth navigation item is added.
- Existing route-slot selection remains available.
- Primary planning/execution controls are visually/structurally separated from workbook handoff, Garmin, clearing, and maintenance controls.
- This slice may reorganize Build Route markup/styles only as required for the planner surface; it must not rename or remove protected controls without separate approval.

### Map implementation decision

Phase 2H-C reuses the app's already-vendored **Leaflet 1.9.4** map stack and the same approved map/tile attribution model already used for pin placement.

It adds:

- no new map provider;
- no new JavaScript package dependency;
- no new API key;
- no new paid Google Maps client API;
- no new OAuth permission.

The planner map uses only FMR-owned/saved coordinates that are already valid for display. It must not use Google request-only geocoding coordinates from 2H-B.

If a selected stop lacks a displayable saved coordinate:

- the stop remains present in the list and route identity;
- it is reported as not currently plotted;
- it is never dropped from the route merely because the map cannot plot it;
- existing approved location-resolution controls remain the path to obtaining a saved coordinate.

### Reusable planner models

2H-C introduces read-only derived models rather than making the DOM the source of truth.

#### Day summary model

At minimum the summary exposes:

- selected route slot/status;
- route date and departure;
- exact work-item count;
- physical-stop count;
- expected pay and whether that pay total is complete;
- total known service time and whether service time is complete;
- Google travel time when a current valid schedule exists;
- estimated field-work finish;
- estimated Home time;
- Preferred Finish status/overrun;
- Home By status/conflict;
- count of selected stops not currently plottable on the internal map.

Missing pay or service data is shown as incomplete. It is never converted into a false complete zero-dollar or zero-minute total.

#### Stop-card model

One stop card represents one physical driving stop and at minimum exposes:

- route number;
- exact `stopId` internally;
- address and approved source display;
- ETA/start time when a current valid Google schedule exists;
- aggregate service time and completeness;
- every exact work item attached to that stop, retaining workbook/manual kind and exact ID;
- current planning detail needed to distinguish multiple work items at one address.

The stop card never duplicates the physical stop merely because two work items exist there.

### Responsive ownership

The same derived planner models power desktop and phone layouts.

- Desktop may show map and list together when space permits.
- Phone may switch/focus between map and list rather than shrinking both into unusable columns.
- No separate mobile data model or second route state is created.

### Route-slot confidence

Google Route with a current schedule may show ETA, drive time, preferred-finish status, and Home time.

Basic Route may show:

- stop/work counts;
- known service totals;
- expected pay;
- its protected order.

Basic Route must clearly indicate that traffic-aware ETA/Home-By validation is unavailable until Google Optimize supplies a current schedule. It must not fabricate comparable confidence from straight-line/basic optimization.

### 2H-C existing checks depended on

- one physical stop for same-address work;
- exact workbook Order IDs and manual `Gig_ID`s remain attached to route snapshots;
- Build Route route numbering matches selected route order;
- Google/Basic slot separation remains intact;
- protected controls remain responsive;
- saved pin/manual-coordinate priority remains intact;
- no new top-level page.

### 2H-C new regression checks required

- one physical stop with two exact work items renders one numbered card with two work rows;
- day summary reports work-item count separately from physical-stop count;
- expected pay aggregation reports incomplete rather than false zero when required pay is missing;
- service aggregation reports incomplete when an unknown manual duration exists;
- current Google schedule drives ETA/finish/Home values only when schedule basis matches;
- stale schedule is hidden/flagged after timing/service/order/membership/Home changes;
- Basic Route never displays traffic-aware ETA/Home-By confidence as though it were Google-derived;
- every route stop remains in the list even when it lacks map coordinates;
- unplottable stop count is visible and no work identity is lost;
- clicking/selecting a map marker and its list/card representation identifies the same physical stop without changing route membership;
- desktop/mobile layout changes do not create duplicate event handlers, render loops, or a second route state;
- no sixth page, new permission, new paid map API, or new map dependency appears.

### 2H-C acceptance criteria

C1. Build Route has a real Map/List planner surface using existing Leaflet infrastructure.  
C2. Jobs/work items and physical stops are counted separately and shown without duplication.  
C3. The day summary communicates pay, service, travel, field finish, and Home timing honestly, including incomplete data.  
C4. Google schedule confidence is shown only when current; Basic remains clearly less time-aware.  
C5. The same planner data drives desktop and phone presentation.  
C6. No multi-day assignment, completion-history archive, or Replan Remaining behavior is introduced.

## 7. Per-slice dependency / regression matrix

| Slice | Existing guarantees it depends on | Existing checks that must stay green | New protection required before slice code is accepted | Contracts / surfaces touched |
| --- | --- | --- | --- | --- |
| **2H-A Workday Context** | named Google/Basic routes; exact work identity; Phase 2G planning; backup recovery | Build Route, saved-data/backup, Phase 2G work-item planning | route-history v6 migration; backup v4 compatibility; local date/timezone round trip; invalid day window fail-closed | `route-history.js`, backup/restore, Build Route controls, `CONTRACT.md`, `REGRESSION_CHECKLIST.md` |
| **2H-B Time-Aware Google** | one-driver Home round trip; traffic-aware objective; complete-response validation; 30s/60s timeout; whole-second timestamps; Phase 2G stop-service aggregation | Google provider/contract/server/browser tests; Build Route route-preservation checks; Phase 2G work-item planning checks | additive API compatibility; visit durations; selected departure; hard Home By; preferred-finish soft comparison; schedule validation/staleness; visible conflict/no partial apply | `google-route-contract.js`, `google-route-browser.js`, `google-route-server.js`, `google-route-provider.js`, route-history schedule field, focused tests, `CONTRACT.md`, `REGRESSION_CHECKLIST.md` |
| **2H-C Planner Foundation** | exact jobs vs stops; route numbering; Google/Basic separation; saved coordinate rules; protected Build Route controls | Build Route, responsiveness, address/pin, Phase 2G planning, 2H-A/B schedule checks | summary/card model tests; map/list identity; incomplete pay/service; stale schedule UI; unplottable stop handling; Basic confidence boundary | derived planner-model module(s), Build Route markup/styles, existing Leaflet stack, focused UI/model tests, `CONTRACT.md`, `REGRESSION_CHECKLIST.md` |

## 8. Hard limits, permissions, billing, and cross-system boundary

### Hard limits

- Existing maximum of 100 Google-selected stops remains unchanged.
- Existing request-body limit remains unchanged unless implementation evidence proves it insufficient; such a change requires a design-record update first.
- Existing 30s/60s Google solver timeout policy remains unchanged.
- Phase 2H is single-day only.

### Permissions and billing

- No new Google OAuth scope.
- No broader Drive access.
- No new Drive file/folder.
- No new Google Maps JavaScript API.
- No new paid map service.
- Google Route Optimization remains the existing billed routing call; 2H-B does not add a second optimization request merely to calculate overflow.

### Workbook / InspectorADE boundary

Phase 2H does not change:

- workbook Address Inbox schema;
- selectable workbook sync behavior;
- `Source + Source_ID` identity rules;
- route-order return JSON schema;
- workbook `Job_Log`, prediction history, prediction grading, or completion data;
- manual gig identity or Manual Work Library schema.

No workbook repository runtime change is part of Phase 2H.

## 9. Stale-output and failure behavior

Phase 2H is fail-closed where timing confidence could be false.

- Invalid day context: do not issue time-aware Google request.
- Unknown duration on routed manual work: do not issue time-aware Google request; name the missing work.
- Google auth/provider/network failure: preserve the prior accepted route and prior recoverable state.
- Google skipped/missing/duplicate/unknown stop: reject the entire new result.
- Home By infeasible: report conflict; do not apply a partial result.
- Traffic/schedule infeasibility: do not claim Home-By-safe status.
- Schedule basis mismatch: keep route order but hide/mark schedule stale until reoptimized.
- Planner-map missing coordinates: keep the work in the route/list; report the map omission only.
- Backup/route-history migration failure: stop restore/migration before corrupting valid current data and retain the previous known-good data for recovery.

## 10. Realistic fixtures and safe-environment plan

Each runtime slice must use the smallest realistic fixtures that prove its boundary.

### Required shared-stop fixture

Use a route fixture with at least:

- one physical stop containing two distinct exact work items;
- at least one ordinary workbook five-minute item;
- at least one explicit service-duration override;
- one manual gig with known duration for the successful time-aware route;
- a separate fixture with an unknown manual-gig duration that must block optimization.

The shared-stop fixture must prove:

```text
work item count > physical stop count
```

while every exact Order ID / `Gig_ID` survives and the physical stop remains once.

Do not hard-code a production-specific `84 jobs / 83 stops` count as the only invariant. A realistic 84/83 fixture may be added if useful, but the protected rule is general: work count and stop count are separate, and same-stop work never duplicates the driving stop.

### Time fixtures

Include:

- same-day default context;
- future route date/departure;
- preferred finish exceeded but Home By met;
- Home By infeasible;
- DST/local-time edge validation;
- 32-stop and 33-stop timeout boundary requests.

### Google provider tests

Provider/server tests must mock the billed Google call. They must inspect the exact generated request and interpreted response without making routine paid requests.

A real authenticated route smoke check is required only after the final 2H-B runtime deployment and must use one representative route with operator-controlled scope.

## 11. Implementation order and stop gates

Implementation order is fixed:

1. **2H-A** only.
2. Verify its focused tests, migration/backup checks, and final CI on its runtime head.
3. Review/merge under its required change-control approval.
4. **2H-B** only.
5. Deploy backend compatibility first, verify, then publish the new browser path.
6. Complete one real affected Google route smoke check.
7. **2H-C** only after 2H-B schedule facts are governed and available.
8. Verify planner model/UI responsiveness and map/list identity.

Do not combine all three slices into one uncontrolled implementation branch merely because they share the Phase 2H label.

If a slice reveals a required architecture change outside this record, implementation stops and this design record is amended before the expanded code is written.

## 12. Rollback strategy

### 2H-A rollback

- restore the pre-2H runtime commit;
- preserve existing route-history/backup data rather than destructively downgrading it;
- version-6 normalization must be designed so older route identity can still be recovered;
- no Drive migration is required because whole-app backup remains the existing file and permission model.

### 2H-B rollback

- stop using the new browser time-aware request;
- retain Basic Route as the operational fallback;
- route Cloud Run traffic to the prior verified backend revision if the additive backend itself is faulty;
- because the backend extension is additive, the prior browser can operate against the compatible backend during rollback;
- never repair a failed Google result by accepting skipped work.

### 2H-C rollback

- revert the planner presentation/model changes while preserving route-history v6 and valid Google schedule data;
- no route identity, planning record, workbook data, or Drive file should require deletion to remove the planner UI.

## 13. Explicit non-goals / out of scope

Phase 2H does **not** include:

- multi-day route splitting or Day 1 / Day 2 assignment;
- generic priority fields;
- appointment windows for individual jobs;
- automatic job selection based on due dates;
- permanent detailed completed-route history;
- continuous GPS/fleet tracking;
- Replan Remaining From Here;
- known-road/construction avoidance;
- automatic workload balancing across multiple days;
- a new top-level planner page;
- a new map vendor or paid map client API;
- a new Google optimization endpoint/version;
- workbook runtime/schema changes;
- automatic relaxation of Home By;
- visual-polish work whose only purpose is animation, branding, decorative effects, or redesign beyond what the planner hierarchy requires.

Those belong to later governed phases or a separately approved scope change.

## 14. Scope enforcement rule

**If a Phase 2H code change cannot be traced to an approved slice and an acceptance criterion in this record, it is scope expansion and must not be implemented until this design record is deliberately updated and reviewed.**

Code review is therefore mechanical at the boundary:

- maps to an approved criterion -> review whether it satisfies that criterion;
- does not map to an approved criterion -> stop and classify it as scope expansion.

Adjacent defects discovered while implementing 2H may be recorded, but they are not automatically authorized fixes.

## 15. Planning-complete gate

Planning for Phase 2H is complete when all of the following are true:

- Phase 2G current behavior is documented in `CONTRACT.md`;
- Phase 2G invariants are present in `REGRESSION_CHECKLIST.md`;
- this record defines 2H-A, 2H-B, and 2H-C;
- the FMR/Google API contract decision is concrete and backward compatible;
- schema/migration/backup boundaries are concrete;
- each slice names dependencies, new regression protection, acceptance criteria, failure behavior, and non-goals;
- implementation order and rollback boundaries are explicit.

This record satisfies the design side of that gate. Runtime implementation remains a separate, governed step.