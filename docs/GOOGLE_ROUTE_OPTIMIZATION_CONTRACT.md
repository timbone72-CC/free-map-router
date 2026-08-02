# Google Route Optimization Behavior Contract

## Current controlling scope

The current implementation is optimization only. Read
`docs/CURRENT_OPTIMIZATION_ONLY_SCOPE.md` first.

Garmin, BaseCamp, GPX destination testing, phone navigation, car navigation,
cloud address-memory migration, standalone file import, Excel support, Obsidian,
and reporting are not part of the current implementation or its acceptance
gate.

Where older planning text conflicts, the optimization-only scope controls.

## Purpose

This contract defines the required user-visible and data-preservation behavior
for Google road-aware route optimization in Free Map Router.

It supplements `CONTRACT.md`, `CHANGE_CONTROL_CONTRACT.md`,
`INTEGRATION_CONTRACT.md`, and `TESTING_CONTRACT.md`. If this document conflicts
with a broader repository contract, the more protective rule controls until the
conflict is deliberately resolved.

## Scope

The feature may:

- send one selected batch of stop IDs and coordinates to an authenticated
  private backend;
- request one-vehicle route optimization;
- receive and validate a complete ordered set of stop IDs;
- replace the current selected route order only after validation;
- show method, status, timestamp, road distance, and estimated drive time;
- display the complete returned order inside Free Map Router.

The feature may not:

- change workbook imports or the inbox schema;
- rewrite saved addresses, notes, source labels, coordinates, or manual pins;
- alter Home;
- run automatically;
- create one optimization request per job;
- silently skip jobs;
- remove the current free optimizer;
- place Google credentials in browser code or storage;
- require Garmin or another navigation system before optimization is usable.

## Full-batch rule

A Google optimization request represents one complete selected route for one
vehicle.

The app must send the complete selected batch together, subject to the app-owned
hard limit. It must not optimize one job at a time or require the operator to
request the next job after each completion.

## Home rule

- Home is required before Google optimization.
- Home is the route start and finish.
- Home is not assigned a numbered job position.
- Google must not replace, geocode, migrate, or persist a different Home value.
- A Google response cannot change the stored Home record.

## Job identity rule

The request must use stable app stop IDs. Coordinates are routing inputs; they
are not job identity.

The response is valid only when:

- every requested stop ID appears exactly once;
- no unknown stop ID appears;
- no requested stop is missing;
- no requested stop is duplicated;
- no skipped or unassigned job is present;
- the count matches the selected route count.

Validation happens before `routeIds` or any equivalent route state is replaced.

## Failure rule

A timeout, authentication failure, quota error, API error, malformed response,
skipped job, duplicate ID, missing ID, unknown ID, or count mismatch must:

- leave the current route unchanged;
- preserve all saved addresses and route selections;
- show a clear operator-facing error;
- keep the current free optimizer available;
- prevent an invalid Google result from replacing the visible order.

The app must not silently substitute a partial Google result.

## Optimization method rule

The Build Route page must clearly distinguish:

- the existing free coordinate-based optimizer; and
- Google road-aware optimization.

The app must show which method produced the current route order. A fallback must
be labeled as a fallback; it must not be presented as a successful Google
result.

Google optimization remains an explicit operator action. Importing jobs,
opening the app, reconnecting Drive, restoring a backup, or editing an address
must not automatically call the paid API.

## Manual control rule

After a valid Google order is applied:

- Up, Down, and Remove continue to work;
- manual changes become the current route order;
- the app displays the visible current order;
- Google does not automatically reapply its previous order;
- re-optimization requires another explicit operator action.

## Coordinate rule

- Every selected stop requires usable coordinates before a Google request.
- Manual pins are authoritative and must not be weakened or replaced.
- Existing geocoded coordinates may be used.
- Missing coordinates must be resolved through the existing controlled workflow
  before optimization.
- The Google backend must not write returned coordinates into saved stops unless
  a separate migration is approved.

## Source and label rule

- GIS and DCFS remain the only dedicated route source labels.
- MCS must not be introduced as a dedicated source label.
- Source labels are app display metadata; they are not required by Google for
  optimization.
- Source values, notes, and job details are not sent to the routing backend
  unless a later approved constraint requires them.

## Display rule

After a valid route is applied:

- the Build Route list is the authoritative visible order;
- every selected stop appears exactly once;
- Home is clearly shown as start and finish;
- route method, road distance, and estimated drive time are shown when available;
- the user can review the complete order without relying on an external
  navigation device.

Navigation exports are outside the current optimization milestone.

## Route size rule

The first production version supports:

- one vehicle;
- one Home location;
- up to 100 selected jobs per request;
- no appointment windows;
- no pickups and deliveries;
- no multiple depots;
- no automatic route splitting;
- no multi-day scheduling.

The app must reject an over-limit request before contacting the backend.
Changing these limits requires a separate impact review.

## Objective rule

The backend request must define an explicit route objective suitable for a
single field-inspection vehicle. It must not rely on an unspecified or accidental
Google default.

The initial objective should prioritize practical road travel time or distance
while returning to Home. The exact cost model must be recorded in the Level 3
impact record and fixed by tests before release.

Traffic-dependent routing must not be enabled by accident. If live or
historical traffic is introduced later, its effect, cost, departure-time
assumptions, and reproducibility must be separately approved.

## State and backup rule

- A pending request does not overwrite the current route.
- A valid result may replace only the current route order.
- Saved address records remain unchanged.
- Existing backup and restore formats remain backward-compatible unless a
  separately approved schema change is made.
- Restoring a backup must not call Google automatically.

## Privacy rule

The first version sends only the minimum routing data:

- opaque stop ID;
- latitude;
- longitude;
- Home coordinates;
- approved route objective and limits.

It must not send:

- customer names;
- job notes;
- workbook history;
- InspectorADE credentials;
- Gmail content;
- Drive file contents;
- company payment details;
- unnecessary address text.

## Workbook boundary

The workbook remains one source of jobs. The app remains responsible for route
selection and optimization.

Google optimization happens after import and does not change the workbook inbox
contract. No workbook change is planned.

No workbook/router integration impact.

## Change classification

Planning documents are Level 1.

Any runtime implementation under this contract is Level 3 and requires:

- a dedicated implementation branch;
- full impact record;
- realistic route fixtures;
- complete tests and syntax checks;
- private-backend validation;
- explicit operator approval before merge;
- post-publication live optimization verification.
