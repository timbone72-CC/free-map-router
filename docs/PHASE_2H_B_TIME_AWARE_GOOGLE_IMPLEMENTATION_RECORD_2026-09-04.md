# Phase 2H-B — Time-Aware Google Optimization Implementation Record

Date: 2026-09-04  
Change level: Level 3  
Governed design: `docs/PHASE_2H_TIME_AWARE_SINGLE_DAY_ROUTING_IMPACT_RECORD_2026-09-04.md`  
Governed baseline / rollback commit: `8147c0143e3b2a2b7115b8d5a8849014b865e53e`  
Status: IMPLEMENTATION IN PROGRESS  
Pre-merge operator approval: required after implementation and verification

## Exact scope

Implement Phase 2H-B only:

- extend the existing `/optimize` request contract additively with optional per-stop `serviceDurationSeconds` and optional top-level `timing` containing whole-second RFC3339 `departureTime` and `homeByTime`;
- derive Google stop duration from the existing Phase 2G physical-stop planning projection;
- block time-aware Google optimization when routed manual work has unknown duration rather than treating it as zero;
- preserve zero service only for physical stops with no exact work items;
- use the selected workday Departure as the Google model start and Home By as the hard model end/vehicle return bound;
- keep Preferred Finish out of Google hard constraints and evaluate it only after an accepted schedule;
- retain useful Google schedule facts in the additive response;
- validate schedule stop identity one-to-one before accepting it;
- store an accepted schedule only on Google Route and invalidate it when its timing/service/order/membership/Home basis changes;
- fail visibly on Home By conflict, skipped work, traffic infeasibility, or structurally incomplete schedule while preserving the previously accepted route;
- preserve legacy `/optimize` requests during ordered backend-first rollout;
- preserve the existing 30-second through 32 stops / 60-second from 33 stops solver timeout policy;
- focused regression coverage for the above.

## Explicitly excluded

- no Phase 2H-C planner Map/List redesign;
- no multi-day planning or automatic route splitting;
- no generic priority field;
- no appointment windows on individual jobs;
- no automatic relaxation of Home By;
- no new Google endpoint/version;
- no Google Maps JavaScript API or new map provider;
- no workbook repository or handoff schema changes;
- no Drive file, folder, OAuth scope, or permission changes;
- no Replan Remaining From Here behavior.

## Owning surfaces

Read/write:

- `google-route-contract.js` — additive request/response normalization and complete schedule validation;
- `google-route-provider.js` — Google Route Optimization model mapping and schedule extraction;
- `google-route-server.js` — preservation of additive timing/service fields through request-only geocoding;
- `google-route-browser.js` — existing `/optimize` call and user-visible result/error status;
- one narrow Phase 2H-B browser adapter loaded before `google-route-browser.js` — bridge enrichment from Phase 2G route planning + Phase 2H-A day context, schedule persistence, and stale-basis handling without taking ownership from `app.js`;
- `route-history.js` only if required to normalize/persist the already-reserved Google `schedule` field safely;
- `index.html` only for the cache-versioned Phase 2H-B adapter/script loading;
- focused tests for contract, provider, server/geocoding preservation, browser request, bridge integration, schedule persistence/staleness, conflict behavior, and timeout boundary.

Read-only dependencies:

- Phase 2G `FMRWorkItemPlanningRuntime.projectRoute(...)` and `FMRRouteWorkPlanning` projection;
- Phase 2H-A `dayContext` and local-time validation;
- existing Google/Basic route slots and Home state;
- existing Google authentication and Cloud Run endpoint.

## Required data

For a time-aware request:

- Home;
- selected Google physical stops;
- exact Phase 2G route-work projection;
- complete service duration for each work-bearing physical stop;
- Phase 2H-A day context;
- resolved whole-second departure instant;
- resolved whole-second Home By instant.

Optional/legacy request behavior remains valid when the new timing/service fields are absent.

## Protected behavior

- one physical stop remains one Google shipment/visit even when several exact work items share it;
- exact workbook Order IDs / `Source_ID`s and manual `Gig_ID`s remain unchanged;
- Google and Basic route slots remain separate;
- Basic Route is not changed by Google Optimize;
- Home remains both Google vehicle start and end;
- `costPerTraveledHour` and traffic-aware routing remain active;
- no distance-cost objective is added;
- manually corrected pins remain protected;
- ordinary written addresses continue through request-only Google geocoding without rewriting saved pins or address text;
- complete-response validation rejects skipped, missing, duplicate, or unknown stops;
- whole-second timestamps remain required;
- 32-stop timeout remains `30s`; 33-stop timeout remains `60s`;
- workbook inbox, route-order return, InspectorADE history/predictions, manual-gig identity, and Manual Work Library remain unchanged.

## API decision

The existing `/optimize` endpoint is extended additively. There is no `/optimize-v2`.

Backward-compatible request shape:

```text
requestId
home
stops[]:
  id
  address OR coordinates
  serviceDurationSeconds? 
timing?:
  departureTime
  homeByTime
```

Backward-compatible response shape retains the existing fields and adds optional:

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

Preferred Finish is not sent as a Google hard time window.

## Ordered rollout gate

2H-B changes both the Cloud Run backend contract implementation and browser caller.

Required order:

1. merge only after all focused/full verification and explicit operator approval;
2. deploy the additive-compatible backend first;
3. verify backend health/compatibility before relying on the new browser request;
4. publish/verify the browser path only after the compatible backend is live;
5. complete one representative authenticated live route smoke check;
6. if backend rollout fails, do not publish the new browser behavior;
7. if browser live validation fails, the prior browser remains compatible with the additive backend and the governed baseline is the rollback point.

## Hard limits

- maximum Google-selected stops remains 100;
- request-body limit remains unchanged;
- 30s solver timeout through 32 stops;
- 60s solver timeout beginning at 33 stops;
- one vehicle;
- one-day only.

## Stale-output behavior

An accepted Google schedule is current only while its deterministic basis still matches:

- Google route stop order;
- Home identity/location used for the request;
- per-stop aggregate service-duration seconds;
- departure instant;
- Home By instant.

Any change to route order, route membership, Home, routed service duration, route date, Departure, or Home By makes the stored schedule stale. Staleness removes ETA/Home-By confidence but must not delete the route order.

## Failure behavior

- missing/invalid day context: no time-aware Google request;
- unknown service duration on routed manual work: no time-aware Google request; identify the missing work item(s);
- invalid timing/service contract field: reject before provider call;
- Google skipped/missing/duplicate/unknown stop: reject entire result;
- Home By infeasible: visible Home By conflict and no partial route apply;
- traffic/schedule infeasibility: do not report Home-By-safe status;
- provider/network/auth failure: preserve prior accepted route;
- stale schedule: keep route order, clear/hide current timing confidence;
- request-only geocoding must preserve stop service duration and timing fields.

## Realistic fixtures / safe test plan

Focused fixtures must include:

- one physical stop with two distinct exact work items and summed service duration;
- ordinary workbook default duration;
- explicit service-duration override;
- manual gig with known duration;
- manual gig with unknown duration that blocks time-aware optimization;
- future departure;
- preferred finish exceeded while Home By is met;
- Home By infeasible;
- complete schedule response;
- skipped/duplicate/missing/unknown schedule visit;
- 32-stop and 33-stop timeout requests;
- legacy request with no timing/service extension.

Provider/server tests mock Google calls. Routine verification must not make billed Route Optimization requests.

## Required focused checks

- additive request normalization preserves legacy callers;
- service duration must be finite nonnegative whole seconds;
- timing timestamps must be valid whole-second RFC3339 and departure must precede Home By;
- address geocoding preserves `serviceDurationSeconds` and top-level timing;
- Google visit duration equals aggregate Phase 2G stop duration;
- selected departure drives global start and exact vehicle start window;
- Home By drives global end and vehicle end window;
- Preferred Finish is absent from Google hard constraints;
- provider retains start/end/visit times and travel/service/wait totals;
- schedule visits map one-to-one to accepted stop IDs;
- unknown manual duration blocks before network call;
- Home By conflict/incomplete Google result applies no partial route;
- current schedule persists only on Google Route;
- timing/service/order/membership/Home changes make schedule stale;
- Basic Route never gains Google schedule confidence;
- legacy backend request remains accepted;
- 32 stops uses `30s`; 33 stops uses `60s`.

## Rollback

Exact rollback runtime: `8147c0143e3b2a2b7115b8d5a8849014b865e53e`.

- Browser rollback: restore prior browser/script versions; the additive backend remains compatible with old requests.
- Backend rollback: route Cloud Run traffic to the prior verified revision if the additive backend itself is faulty.
- Do not repair a failed result by accepting skipped work or silently relaxing Home By.
- No Drive/workbook data migration or destructive rollback is required.

## Integration statement

No workbook/router integration impact. Phase 2H-B does not change workbook inbox fields, selectable sync, address/source identity, route-order return schema, Gig Handoff, Drive handoff files, or workbook runtime.
