# Google Route Optimization Roadmap

## Operator priority

The primary purpose of this project is better route optimization. Google
road-aware optimization is the first required working milestone. Cloud address
memory and standalone file import are also required, but they must not postpone
the first usable optimization release.

The approved operating goals are:

1. optimize the complete selected batch using roads rather than straight-line
   distance;
2. keep one complete Garmin route in the same stop order;
3. make the app usable from workbook jobs, local files, or manual entry;
4. correct and remember routing addresses safely;
5. move permanent address memory out of browser-only storage;
6. keep the workbook as a separate optional source.

Nothing in this roadmap treats optimization as optional or as a final
convenience feature.

## Purpose

Add Google road-aware route ordering to Free Map Router first, then complete the
same system with durable cloud address memory and independent file import. The
existing workbook handoff, route controls, Google Maps sections, Garmin GPX
workflow, saved addresses, manual pins, and free optimizer remain protected.

The runtime work is Level 3 because it adds a billed external API, a private
cloud service, authentication, routing-algorithm replacement, new storage, and
migration. Each runtime stage uses its own branch, impact record, tests,
rollback, and explicit pre-merge operator approval.

Planning is documentation-only. It does not enable billing, create Cloud
resources, alter browser data, or change the live application.

## Account and ownership plan

The Google accounts do not have to match the account used to open the workbook,
Drive, or GitHub Pages app.

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
  - calls Route Optimization and, in the later storage stage, accesses only the
    approved address-memory records;
  - no Gmail, workbook, GitHub, or billing-administration access;
  - no downloadable long-lived key when platform-managed identity is available.

The workbook and current Drive sign-in may continue using `timbone72@gmail.com`.

## Target architecture

```text
Workbook inbox ---------+
Local file import ------+--> Free Map Router
Manual entry/paste -----+          |
                                    | selected complete batch
                                    v
                         Private authenticated backend
                                    |
                                    v
                         Google Route Optimization
                                    |
                                    v
                         Validated complete stop order
                                    |
                         +----------+----------+
                         |                     |
                   Google Maps            Garmin GPX

Later durable-memory stage:
Free Map Router <------> Cloud address memory
Browser storage = cache, not the only copy
```

Google determines the stop order for the complete selected batch. Garmin remains
the turn-by-turn navigation device. The workflow never becomes one job at a
time.

## Non-negotiable behavior

- Home is the unnumbered start and finish.
- The complete selected batch is sent together for one vehicle.
- Every selected job must return exactly once.
- Missing, skipped, duplicated, unknown, or extra jobs invalidate the result.
- An invalid or failed response leaves the current route unchanged.
- Google Maps and Garmin use the final visible route order.
- Garmin receives one complete route.
- GIS and DCFS remain the only dedicated route-source labels; blank is allowed.
- MCS is not introduced as a dedicated source label.
- Manual pins remain stronger than automatic geocoding.
- Up, Down, Remove, Clear Route, and the free optimizer remain available.
- Google optimization runs only after an explicit operator action.
- No credential is placed in public JavaScript, browser storage, Drive files, or
  the workbook.
- Optimization cannot rewrite address text, notes, source, coordinates, pins,
  workbook data, or cloud memory.

## Stage 0 — contracts and baseline

Deliverables:

- Google optimization behavior contract;
- security and billing contract;
- testing and rollback contract;
- cloud address-memory roadmap and contract;
- standalone import and correction roadmap and contract;
- exact production baseline and rollback commit;
- Level 3 impact record for the first runtime stage.

Exit condition:

- documentation reviewed;
- current app suite and Garmin behavior recorded;
- no runtime or Cloud change made.

## Stage 1 — Google Cloud ownership and cost protection

Operator actions:

1. Create the dedicated project under business control.
2. Connect the business billing account.
3. Add the daily operator account with approved roles.
4. Enable only the services needed for the private routing prototype.
5. Configure a conservative budget, alerts, request limits, and quotas.
6. Record project ID, region, owners, and nonsecret recovery instructions.

This stage does not require Firestore or address migration before the first
routing prototype.

Exit condition:

- both accounts have their intended access;
- company account controls billing and recovery;
- no secret has been placed in the repository;
- billing protection is active.

## Stage 2 — optimization-first backend prototype

Build a small authenticated Cloud Run service that works with the app's current
selected stop IDs and coordinates. Current browser storage and workbook import
may supply those stops during this temporary stage; neither becomes the final
permanent memory design.

Prototype responsibilities:

- accept Home and one complete selected batch;
- use one vehicle;
- enforce the approved hard stop-count limit;
- call Google Route Optimization;
- return only ordered stop IDs and approved route totals;
- reject incomplete or skipped results;
- avoid receiving notes, customer names, workbook history, or unnecessary text;
- log no addresses or coordinates;
- never write to saved addresses.

Exit condition:

- fixed small and large fixtures return complete validated orders;
- failure paths leave the original order unchanged;
- actual request usage and cost are measured;
- no live app publication yet.

## Stage 3 — first usable optimization release

Add an explicit **Optimize with Google Roads** control while keeping the current
free **Optimize Route** control.

Required result:

- Google optimization works on jobs already available in the app;
- the complete batch is optimized together;
- the app visibly identifies the method used;
- exports preserve the optimized order;
- the current route survives timeout, quota, authentication, and provider
  failure;
- the free optimizer remains usable at all times.

Real-route validation must include:

- a normal 15–25 job route;
- a scattered 40–50 job route;
- a 60–70 job GIS/DCFS batch;
- comparison of road miles, estimated drive time, backtracking, Google Maps
  continuity, BaseCamp order, Garmin order, and API usage.

Google does not become the default until the operator confirms it produces a
meaningfully better practical route.

Exit condition:

- complete tests and security gates pass;
- explicit Level 3 pre-merge approval is recorded;
- published app smoke test passes;
- Garmin receives the full route in visible order.

This is the first operational milestone and the first priority of the project.

## Stage 4 — durable cloud address memory

After optimization is working, move reusable address memory from browser-only
storage to the authenticated cloud store under a separate Level 3 change.

Required result:

- cloud records become authoritative;
- browser storage becomes a cache and offline aid;
- browser clearing or changing computers does not erase permanent memory;
- stable IDs used by optimization are preserved;
- corrected addresses and original aliases are retained;
- notes, GIS/DCFS/blank source, coordinates, and manual pins are preserved;
- stale writes cannot overwrite newer records;
- deletion is recoverable;
- a dated pre-migration snapshot exists.

Optimization must continue to work during and after migration, and it may read
selected stable IDs and coordinates without changing memory records.

## Stage 5 — independent CSV import and address review

Make the app independently usable without the workbook.

Supported origins:

- Workbook Drive inbox;
- local InspectorADE CSV;
- manual entry or paste.

Required result:

- file parsing occurs locally before accepted records are saved;
- the app shows an Import Review;
- safe formatting and governed exact corrections may be automatic;
- house number, city, state, or ZIP changes require review;
- duplicates and uncertain matches are shown rather than silently merged;
- original and corrected address values are retained;
- accepted jobs are saved to cloud memory and can be routed immediately;
- the workbook remains a separate optional source and is never rewritten.

CSV is the first required file format. `.xlsx` follows after CSV works with real
sanitized files. Legacy `.xls` follows only after a safe bundled parser is
reviewed.

## Stage 6 — recovery and convenience

After the required operating path is proven:

- create dated Drive recovery snapshots;
- complete the separate route-backup document and email workflow;
- add optional human-readable Obsidian reports;
- add Excel import support;
- add route analytics only when they help field decisions.

Obsidian remains outside the app's required operating path.

## Required project order

The runtime projects are separate so one large change cannot damage every
surface:

1. **Google road-aware optimization — first and highest priority.**
2. **Cloud address memory and safe migration.**
3. **Standalone CSV import and address correction.**
4. **Excel and optional reporting conveniences.**

The later stages are not removed. They are required follow-on projects, but they
are not allowed to hold the first useful optimization release hostage.

## Success criteria

The plan succeeds only when:

- Google produces a complete road-aware route for the selected batch;
- every selected job appears exactly once;
- Home starts and finishes the route;
- app, Google Maps, printed order, BaseCamp, and Garmin agree on stop sequence;
- the free optimizer remains available;
- provider failure does not destroy the current route;
- permanent addresses survive browser loss after the memory stage;
- local CSV jobs can be imported without the workbook after the import stage;
- address corrections preserve original values and manual pins;
- company ownership and billing recovery do not depend on one personal account;
- measured cost stays within the approved budget.

## Workbook boundary

The workbook remains responsible for forecasting, completion history, printing,
and its own job workflow. It remains one supported source of route jobs.

Free Map Router owns address review, reusable route memory, route selection,
optimization, Google Maps output, and Garmin GPX output.

The current workbook inbox contract remains unchanged unless a later separately
approved integration change modifies its schema or meaning.

## Rollback direction

At every stage the system must be able to return to:

- the last known-good app commit;
- the current free optimizer;
- the current workbook inbox contract;
- the current Garmin export workflow;
- the pre-migration address snapshot once cloud migration begins.

Disabling Google routing must not prevent the free optimizer from working.
Disabling cloud-memory writes must not delete stored addresses.