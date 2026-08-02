# Google Route Optimization Roadmap

## Current controlling scope

The current implementation project is optimization only. Read
`docs/CURRENT_OPTIMIZATION_ONLY_SCOPE.md` first.

The first required working milestone is a correct road-aware stop order inside
Free Map Router for the complete selected batch. Garmin, BaseCamp, GPX testing,
turn-by-turn navigation selection, cloud address-memory migration, standalone
file import, Excel support, Obsidian, and reporting conveniences are not part of
the current implementation or its acceptance gate.

Where older text in this roadmap mentions Garmin or another later project as a
required condition for the first optimization release, the optimization-only
scope controls.

## Purpose

Add Google road-aware route ordering to Free Map Router using the jobs already
available in the app. The app must optimize the full selected batch for one
vehicle, preserve Home as start and finish, reject incomplete results, and show
the complete ordered route inside the app.

The runtime work is Level 3 because it adds a billed external API, a private
cloud service, authentication, and a new route-ordering method. Implementation
requires a dedicated branch, impact record, realistic fixtures, complete tests,
rollback instructions, and explicit operator approval before merge.

Planning is documentation-only. It does not enable billing, create Cloud
resources, alter browser data, or change the live application.

## Account and ownership plan

Recommended ownership:

- `InandOutInspections2026@gmail.com`
  - permanent business owner of the Google Cloud project;
  - permanent Cloud Billing administrator;
  - recovery account;
  - recipient of billing and budget alerts.
- `timbone72@gmail.com`
  - daily operator and development administrator;
  - permission to deploy, test, inspect logs, and operate the service;
  - billing visibility without making the business depend solely on a personal
    account.
- dedicated runtime service account
  - calls Route Optimization only;
  - no Gmail, Drive, workbook, GitHub, or billing-administration access;
  - no downloadable long-lived key when platform-managed identity is available.

The workbook and current Drive sign-in may continue using `timbone72@gmail.com`.

## Target architecture

```text
Jobs already in Free Map Router
            |
            | complete selected batch
            v
Private authenticated backend
            |
            v
Google Route Optimization
            |
            v
Validated complete stop order
            |
            v
Displayed inside Free Map Router
```

Optimization and navigation are separate. This project ends when the app can
reliably calculate, validate, preserve, and display the correct road-aware order.
No Garmin or other navigation test is required for this milestone.

## Non-negotiable behavior

- Home is the unnumbered start and finish.
- The complete selected batch is sent together for one vehicle.
- Every selected job must return exactly once.
- Missing, skipped, duplicated, unknown, or extra jobs invalidate the result.
- An invalid or failed response leaves the current route unchanged.
- The app clearly shows which optimizer produced the current order.
- GIS and DCFS remain the only dedicated route-source labels; blank is allowed.
- MCS is not introduced as a dedicated source label.
- Manual pins remain stronger than automatic geocoding.
- Up, Down, Remove, Clear Route, and the free optimizer remain available.
- Google optimization runs only after an explicit operator action.
- No credential is placed in public JavaScript, browser storage, Drive files, or
  the workbook.
- Optimization cannot rewrite address text, notes, source, coordinates, pins,
  workbook data, or browser storage records.

## Stage 0 — contracts and baseline

Deliverables:

- optimization-only scope;
- Google optimization behavior contract;
- security and billing contract;
- testing and rollback contract;
- exact production baseline and rollback commit;
- Level 3 impact record for runtime implementation.

Exit condition:

- documentation reviewed;
- current complete app test result recorded;
- no runtime or Cloud change made.

## Stage 1 — Google Cloud ownership and cost protection

Operator actions:

1. Create the dedicated project under business control.
2. Connect the business billing account.
3. Add the daily operator account with approved roles.
4. Enable only the services needed for the private routing prototype.
5. Configure a conservative budget, alerts, request limits, and quotas.
6. Record project ID, region, owners, and nonsecret recovery instructions.

Exit condition:

- both accounts have their intended access;
- company account controls billing and recovery;
- no secret has been placed in the repository;
- billing protection is active.

## Stage 2 — isolated optimization backend

Build a small authenticated Cloud Run service that works with the app's current
selected stop IDs and coordinates.

Backend responsibilities:

- accept Home and one complete selected batch;
- use one vehicle;
- enforce the approved hard stop-count limit;
- call Google Route Optimization;
- return only ordered stop IDs and approved road metrics;
- reject incomplete or skipped results;
- avoid receiving notes, customer names, workbook history, or unnecessary text;
- log no addresses or coordinates;
- never write to saved addresses.

Exit condition:

- fixed small and large fixtures return complete validated orders;
- failure paths leave the original order unchanged;
- actual request usage and cost are measured;
- no live app publication yet.

## Stage 3 — app integration

Add an explicit **Optimize with Google Roads** control while keeping the current
free **Optimize Route** control.

Required result:

- Google optimization works on jobs already available in the app;
- the complete batch is optimized together;
- the app visibly identifies the method used;
- the app displays the full returned order;
- the current route survives timeout, quota, authentication, and provider
  failure;
- the free optimizer remains usable at all times.

No Garmin, BaseCamp, GPX, phone, or car-navigation work is included.

## Stage 4 — real-route comparison

Use representative GIS and DCFS batches:

- a normal 15-25 job route;
- a scattered 40-50 job route;
- a 60-70 job route;
- rural roads, divided highways, bridges, dead ends, and manually corrected
  pins where available.

Compare:

- selected and returned counts;
- missing, duplicate, skipped, and unknown counts;
- total road distance;
- estimated drive time;
- obvious backtracking;
- route practicality when reviewed on a road map;
- API request and shipment usage.

The current free optimizer is the control result. Google does not become the
default merely because it returns successfully.

Exit condition:

- every route is complete;
- route quality demonstrates a meaningful practical benefit;
- the operator accepts the app-generated order;
- no navigation-device test is required.

## Stage 5 — production release

Before merge:

- final Level 3 impact record complete;
- focused tests, complete app suite, syntax checks, and security gates pass on
  the exact final head;
- Cloud backend rollback revision identified;
- current app rollback commit identified;
- billing quota and budget protection verified;
- explicit operator approval obtained.

Deployment order:

1. Deploy private backend in disabled or allowlisted test mode.
2. Verify authentication and fixed fixtures.
3. Publish app integration.
4. Perform one live app optimization smoke test.
5. Keep the free optimizer available.

## Completion criteria

The first optimization milestone is complete only when:

- Google produces a complete road-aware route order for the selected batch;
- every selected job appears exactly once;
- Home starts and finishes the route;
- the app displays and preserves the complete order;
- invalid responses never replace the current route;
- provider failure does not destroy the current route;
- the free optimizer remains available;
- representative 15-25, 40-50, and 60-70 stop batches pass;
- measured road distance, estimated time, and backtracking demonstrate practical
  improvement;
- company ownership and billing recovery are verified;
- measured cost stays within the approved budget.

Garmin and all other turn-by-turn navigation systems are outside this completion
standard.

## Later separate projects

After the optimization project is complete, separately approved projects may
address:

- durable cloud address memory;
- standalone CSV import and address correction;
- navigation-provider selection;
- Excel support;
- Obsidian and reporting conveniences.

None is a prerequisite for the first correct optimization release.

## Workbook boundary

The workbook remains unchanged and continues to be one source of jobs. Google
optimization occurs entirely after jobs are already in Free Map Router.

No workbook/router integration impact.

## Rollback direction

At every stage the system must be able to return to:

- the last known-good app commit;
- the current free optimizer;
- the current workbook inbox contract.

Disabling Google routing must not prevent the free optimizer from working.
