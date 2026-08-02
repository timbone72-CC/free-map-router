# Google Route Optimization Roadmap

## Purpose

Add an optional Google road-aware optimizer to Free Map Router while preserving
the existing workbook handoff, standalone file import plan, cloud address memory,
route controls, Google Maps sections, Garmin GPX workflow, saved addresses,
manual pins, and current free optimizer.

This is a Level 3 project because it adds a billed external API, a private cloud
service, authentication, new permissions, and a second route-ordering method.
Implementation requires a dedicated runtime branch, complete testing, and
explicit operator approval before merge.

Planning is documentation-only. Nothing in this roadmap authorizes direct work
on `main`, Cloud billing changes, API enablement, deployment, or live-data
changes.

## Account and ownership plan

The Google accounts do not have to match the account used to open the workbook,
Drive, or GitHub Pages app.

Recommended ownership:

- `InandOutInspections2026@gmail.com`
  - permanent business owner of the Google Cloud project;
  - permanent Cloud Billing administrator;
  - recovery account for the service;
  - recipient of billing and budget alerts.
- `timbone72@gmail.com`
  - daily operator and development administrator;
  - project access sufficient to deploy, inspect logs, and manage the service;
  - billing visibility without making the business depend solely on a personal
    account.
- dedicated service account
  - runtime identity used only by the private backend;
  - receives only the permissions required to call Route Optimization and access
    the approved cloud address-memory store;
  - no Gmail, workbook, GitHub, or billing-administration access.

The existing workbook and router Drive sign-in may continue using
`timbone72@gmail.com`. The router backend will allow both approved operator
accounts. No business workflow must be migrated merely to enable routing.

## Target architecture

```text
Workbook inbox ---------+
Local file import ------+--> Free Map Router --> Cloud address memory
Manual entry/paste -----+          |
                                    | user selects one complete batch
                                    v
                         Private authenticated backend
                                    |
                                    v
                         Google Route Optimization API
                                    |
                                    v
                         Validated ordered stop IDs
                                    |
                         +----------+----------+
                         |                     |
                   Google Maps            Garmin GPX
```

The cloud address memory is the authoritative source for reusable router
addresses. Browser storage is only a cache after migration. Google Route
Optimization reads selected stable stop IDs and coordinates; it does not own or
rewrite address-memory records.

The Google service determines stop order for the full selected batch. Garmin
continues to provide turn-by-turn navigation. The workflow must never degrade
into one-job-at-a-time navigation.

## Protected behavior

The project must preserve all of the following:

- Home remains the unnumbered start and finish.
- Every selected job appears exactly once in the returned route.
- The app rejects a response containing skipped, duplicated, missing, unknown,
  or extra jobs.
- GIS and DCFS labels remain available; MCS is never introduced as a dedicated
  route source.
- Manual pins remain stronger than ordinary geocoded coordinates.
- Manual Up, Down, and Remove controls continue to work after optimization.
- Google Maps sections and Garmin GPX use the same final visible order.
- Garmin export remains one complete route, not separate navigation requests.
- The existing free straight-line optimizer remains available as a fallback.
- A failed Google request leaves the current route unchanged and recoverable.
- No optimization runs automatically during workbook import, file import, cloud
  sync, or app startup.
- Google may read selected stop IDs and coordinates but may not alter saved
  address text, source, notes, coordinates, pin status, or cloud records.
- No API secret, service-account key, or unrestricted credential is placed in
  GitHub Pages, source control, browser storage, Drive backups, or the workbook.

## Phase 0 — planning and contracts

Deliverables:

- this roadmap;
- behavior contract;
- security and billing contract;
- testing and rollback contract;
- cloud address-memory roadmap and contract;
- standalone import roadmap and contract;
- documented account-ownership model;
- exact Level 3 impact record before runtime implementation begins.

Exit condition:

- documentation reviewed;
- no runtime code changed;
- no Cloud project or billing account created by automation.

## Phase 1 — operator-owned Google Cloud setup

Operator actions:

1. Sign in with `InandOutInspections2026@gmail.com`.
2. Create a dedicated Google Cloud project named for Free Map Router.
3. Create or select the business billing account.
4. Add `timbone72@gmail.com` with the approved project role.
5. Configure the cloud address-memory database in an isolated test state.
6. Enable Route Optimization API only after ownership is verified.
7. Configure conservative quotas, budgets, and billing alerts.
8. Record project ID, region, account owners, and recovery procedure without
   storing payment data or secrets in the repository.

Exit condition:

- both accounts can access the project as intended;
- company account controls billing and recovery;
- no credential has been downloaded into the repository;
- cloud address-memory and routing permissions are separated and minimal.

## Phase 2 — cloud address memory first

Before Google becomes a route source, implement and verify cloud-backed address
memory under its own Level 3 impact record.

Required result:

- cloud is authoritative for reusable addresses;
- browser storage is cache only;
- browser clearing does not erase memory;
- stable IDs, corrected aliases, GIS/DCFS/blank source, notes, coordinates, and
  manual pins are preserved;
- stale writes cannot overwrite newer records;
- a pre-migration recovery snapshot exists;
- workbook remains a separate optional source.

Google routing must not become dependent on unproven browser-only identity.

## Phase 3 — isolated backend prototype

Preferred first backend: a small authenticated Cloud Run service.

Prototype responsibilities:

- accept one Home point and one selected batch of stable stop IDs and
  coordinates;
- permit one vehicle only;
- enforce an app-owned hard limit of 100 jobs per request;
- call Google Route Optimization through the backend service identity;
- return only ordered stop IDs, method metadata, and basic totals needed by the
  app;
- reject skipped or incomplete results;
- avoid receiving job notes, customer names, workbook history, or unnecessary
  address text;
- write sanitized operational logs without route addresses or coordinates;
- never write Google results into cloud address-memory records.

The prototype must not be called by the live app.

Exit condition:

- fixed test fixtures return complete, deterministic-enough ordered job sets;
- malformed and incomplete responses fail closed;
- cost and quota behavior is measured rather than assumed.

## Phase 4 — app integration behind an explicit control

Add a separate action such as `Optimize with Google Roads` while retaining the
existing `Optimize Route` control.

Required app behavior:

- user initiates every Google optimization;
- app shows which method produced the current order;
- app shows request success, failure, fallback, and timestamp clearly;
- route is replaced only after full response validation;
- old route remains intact during the request;
- cloud address-memory records remain unchanged;
- exports remain disabled only when the returned job set is invalid, not merely
  because the Google service is unavailable;
- the user may choose the existing free optimizer after any Google failure.

Exit condition:

- focused tests pass;
- no workbook change is required;
- app route order, Google Maps order, and Garmin order match.

## Phase 5 — real-route comparison

Use representative GIS and DCFS batches, including:

- a normal 15–25 job route;
- a scattered 40–50 job route;
- a 60–70 job route;
- rural roads, divided highways, bridges, dead ends, and manually corrected
  pins where available.

Compare:

- all jobs present exactly once;
- road miles;
- estimated drive time;
- obvious backtracking;
- route practicality;
- Google Maps section continuity;
- BaseCamp and Garmin stop order after recalculation;
- API usage and cost;
- confirmation that address-memory records did not change.

The current free optimizer is the control result. Google does not become the
default merely because it returns successfully.

Exit condition:

- route quality demonstrates a meaningful practical benefit;
- no missing or duplicated jobs;
- Garmin workflow remains complete and usable;
- operator accepts the real-route results.

## Phase 6 — production release

Before merge:

- final Level 3 impact record complete;
- focused tests, full suite, syntax checks, and contract gates pass on the exact
  final head;
- Cloud backend rollback revision identified;
- current app rollback commit identified;
- billing quota and budget protection verified;
- cloud address-memory backup and rollback path verified;
- explicit operator approval obtained.

Deployment order:

1. Deploy private backend in disabled or allowlisted test mode.
2. Verify authentication and fixed fixture.
3. Publish app integration.
4. Perform one live route smoke test.
5. Confirm cloud records remain unchanged.
6. Keep the free optimizer available.

## Phase 7 — post-release controls

Monitor:

- request count and shipment usage;
- failed and rejected responses;
- latency;
- quota exhaustion;
- unexpected billing;
- incomplete-route attempts;
- operator fallback frequency;
- route quality compared with field results;
- any attempted write to protected address-memory fields.

Review after the first three real batches and again after the first full month.
Do not increase quotas automatically.

## Success criteria

The project succeeds only when:

- a selected batch is optimized together as one vehicle route;
- Home starts and ends the route;
- every selected job appears exactly once;
- no skipped shipment is silently accepted;
- the app, Google Maps links, printed order, BaseCamp, and Garmin show the same
  stop sequence;
- the current free optimizer remains functional;
- a Google outage or authentication failure does not destroy the active route;
- cloud address-memory records remain unchanged by optimization;
- browser clearing does not erase the address memory;
- credentials remain private;
- company ownership and billing recovery do not depend solely on one personal
  account;
- measured cost remains within the operator-approved budget.

## Workbook impact

The workbook continues to send the same selected addresses, source values, and
order through `Free Map Router Address Inbox.json`. It remains one optional
source beside local file import and manual entry.

Google optimization occurs after the app has loaded cloud address-memory records
and selected stops. It does not change workbook data or the inbox contract.

A companion workbook change is required only if later scope changes the inbox
schema, exported address text, source values, order meaning, duplicate handling,
or import-preservation rules.

## Rollback direction

At every runtime phase, the system must be able to return to:

- the last known-good app commit;
- the existing free optimizer;
- the cloud address-memory recovery snapshot;
- the current workbook inbox contract;
- the existing Garmin export workflow.

Disabling or deleting the Cloud routing service must not prevent the app from
loading cloud address memory or using the free optimizer. Disabling cloud
address-memory writes must not delete the stored records.