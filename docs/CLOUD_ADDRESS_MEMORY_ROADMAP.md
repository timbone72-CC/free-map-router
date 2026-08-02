# Cloud Address Memory Roadmap

## Purpose

Move Free Map Router address memory out of browser-only storage so saved addresses,
corrected address text, source labels, notes, coordinates, and manual pins are not
lost when browser storage is cleared, a device fails, or the app is opened on a
new computer.

The cloud store becomes the authoritative address memory. Browser storage becomes
an offline cache and temporary working copy only.

This is a Level 3 future runtime project because it changes the authoritative
storage location, adds authentication and cloud writes, requires migration of
existing saved stops, and introduces synchronization and recovery behavior.

Planning is documentation-only. Nothing in this roadmap authorizes changes to
`main`, live data, Google Cloud resources, billing, permissions, or the workbook.

## Recommended architecture

Use Cloud Firestore in the same business-owned Google Cloud project planned for
Google Route Optimization, accessed through the authenticated private backend.

```text
Workbook inbox ---------+
Local file import ------+--> Free Map Router --> private authenticated backend
Manual entry/paste -----+                            |
                                                     v
                                          Cloud address memory
                                          (authoritative records)
                                                     |
                                      +--------------+--------------+
                                      |                             |
                               browser cache                  Drive snapshots
                               for field use                  for recovery/export
```

The app must not depend on the workbook to create or retrieve address memory.
The workbook remains one optional job source.

## Why not browser-only storage

Browser storage can disappear when:

- site data is cleared;
- a browser profile is reset or replaced;
- the device fails;
- the app is opened in another browser or computer;
- privacy or cleanup tools remove local data;
- an accidental Delete All is followed by an overwritten backup.

Local storage remains useful for speed and offline access, but it must not be the
only copy of the address memory.

## Why Firestore is the preferred store

The address memory is a collection of small independent records that need stable
IDs, selective updates, querying, concurrency checks, and recovery metadata.
Firestore is a better fit than one continuously overwritten JSON file because a
single failed or out-of-order file upload should not be able to replace the whole
address memory.

A Drive JSON snapshot remains useful as a human-controlled export and recovery
copy, but it is not the primary live database.

## Account ownership

Use the same ownership model as the Google routing project:

- `InandOutInspections2026@gmail.com`
  - permanent business owner;
  - billing and recovery control;
  - recipient of alerts.
- `timbone72@gmail.com`
  - normal daily operator and development administrator;
  - approved to use and maintain the service.
- dedicated backend service account
  - minimum Firestore and routing permissions only;
  - no Gmail, Drive, workbook, GitHub, or billing-administration access unless a
    later narrowly approved backup function requires a specific Drive action.

## Address-memory record

Each physical address record should contain only fields approved by the final
Level 3 impact record. Expected fields are:

- stable address-memory ID;
- current corrected routing address;
- normalized address key;
- original address aliases;
- route source: `GIS`, `DCFS`, or blank;
- import origin: Workbook, Local File, or Manual;
- latitude and longitude;
- pin status: manual, geocoded, unresolved, or approved equivalent;
- optional label and route note;
- created timestamp;
- updated timestamp;
- revision number;
- last-seen timestamp;
- deleted or archived status;
- minimal correction provenance.

The cloud address memory is not a replacement for workbook `Job_Log`. It stores
reusable routing destinations, not complete job history, completion records,
forecasting history, payments, or InspectorADE credentials.

## Source separation

Import origin and route source remain separate:

- import origin: Workbook, Local File, Manual;
- route source: GIS, DCFS, blank.

A local file may contain GIS or DCFS jobs. The app must not label a route stop
`Local File` in place of GIS/DCFS, and it must not introduce MCS as a dedicated
route source.

## Phase 0 — planning and contracts

Deliverables:

- this roadmap;
- cloud address-memory contract;
- data migration plan;
- schema and access review;
- exact rollback plan;
- realistic migration fixtures;
- decision on Drive snapshot frequency and retention.

Exit condition:

- documents reviewed;
- no live code, data, billing, or permissions changed.

## Phase 1 — isolated cloud store

Create a test-only Firestore database in the business-owned project.

Prototype responsibilities:

- create, read, update, archive, and restore sanitized address records;
- enforce authentication and approved-operator access;
- reject malformed records;
- preserve stable IDs and revision numbers;
- prevent an older revision from overwriting a newer revision;
- keep manual pins stronger than geocoded pins;
- avoid storing unnecessary job or customer data;
- produce sanitized logs without complete addresses or coordinates.

Exit condition:

- fixed records survive browser clearing and device changes;
- stale writes fail safely;
- unauthorized access is rejected;
- no production address data has been migrated.

## Phase 2 — read-only app connection

Connect a development build of the app to the test cloud store in read-only
mode.

Required behavior:

- app signs in through the approved account flow;
- app downloads the cloud address memory;
- app marks whether displayed data came from cloud or cache;
- app remains usable with the last verified cache when temporarily offline;
- app does not silently replace newer cloud data with an older browser cache;
- route building, free optimization, Google Maps, and Garmin work from loaded
  cloud records.

Exit condition:

- cloud records appear correctly;
- browser clearing followed by sign-in restores the records;
- no write path is enabled yet.

## Phase 3 — controlled write and migration

Add serialized cloud writes and migrate existing saved app addresses.

Migration procedure:

1. Export and preserve a dated pre-migration snapshot.
2. Read current browser stops and the latest valid Drive backup.
3. Normalize and compare them without writing.
4. Present counts for new, matching, conflicting, duplicate, and unresolved
   records.
5. Require explicit operator approval for the migration set.
6. Write records using stable IDs and revision checks.
7. Re-read the cloud collection and compare counts and protected fields.
8. Keep the pre-migration snapshot until live verification is complete.

A migration must not infer a house-number change, weaken a manual pin, delete an
unmatched record, or rewrite the workbook.

Exit condition:

- all accepted records are present exactly once;
- manual pins and notes are preserved;
- browser data can be cleared and safely rebuilt from cloud;
- rollback snapshot is verified.

## Phase 4 — cloud-authoritative operation

After successful migration:

- cloud memory becomes authoritative;
- browser data becomes a cache;
- each edit, import, pin change, and delete uses a revisioned cloud operation;
- writes are serialized;
- the app shows pending, saved, failed, offline, and conflict states;
- an unsuccessful cloud write does not pretend to be saved;
- old cache data cannot overwrite newer cloud data automatically.

The app may queue a small number of offline changes, but queued changes must be
reviewable and conflict-safe before synchronization.

## Phase 5 — recovery snapshots

Add dated recovery snapshots separate from the live database.

Preferred behavior:

- create a dated snapshot after important migrations and at an approved manual
  or scheduled interval;
- store snapshots in the app-owned Drive backup folder or approved Cloud
  Storage location;
- never overwrite the only recovery copy;
- include schema version, record count, timestamp, and checksum;
- restore into a review stage before replacing live memory;
- keep ordinary address deletion recoverable for an approved retention period.

A snapshot is recovery data, not the current live address source.

## Phase 6 — standalone file imports

Once cloud memory is stable, direct CSV imports write accepted addresses to the
cloud address memory through the same validation and duplicate rules used by the
workbook inbox and manual entry.

The app must show:

- original file address;
- proposed corrected address;
- GIS/DCFS/blank source;
- new, existing, duplicate, uncertain, or conflicting status;
- whether the record will update an existing memory entry or create a new one.

## Phase 7 — Google road optimization

Google Route Optimization reads selected address-memory records but does not own
or rewrite them.

The optimizer receives stable stop IDs and coordinates only. A valid Google
response may change current route order, but it may not change address text,
source, notes, coordinates, pin status, or cloud address records.

## Cost expectation

The expected address volume is small: roughly hundreds, not millions, of records.
Actual costs must be measured and protected with budgets and quotas, but normal
use should remain far below typical database free-tier limits.

The project must not claim a guaranteed zero cost. Billing, quota, location, and
backup features must be verified during setup.

## Success criteria

The project succeeds only when:

- clearing browser storage does not erase the address memory;
- signing in on another approved device retrieves the same records;
- cloud and cache status are clearly identified;
- every saved address has one stable identity;
- manual pins are preserved;
- safe corrections preserve original aliases;
- stale writes cannot overwrite newer records;
- deletes are recoverable under the approved retention rule;
- a cloud outage does not destroy current cached routes;
- a failed sync does not falsely report success;
- workbook, local file, and manual imports remain distinguishable;
- the workbook continues operating independently;
- Google Maps and Garmin continue using the visible current route order.

## Workbook boundary

The workbook remains authoritative for its own `Job_Log`, history, completion,
turn-in, prediction, conflict, and print workflows.

The cloud address memory is authoritative only for reusable router destinations.
It does not write back to `Job_Log` and does not become a hidden second workbook.

The existing workbook inbox remains supported. A companion workbook change is
required only if future scope changes the inbox schema or handoff meaning.

## Rollback direction

At every runtime stage, the system must be able to return to:

- the last known-good app commit;
- the preserved pre-migration browser/Drive snapshot;
- the existing workbook inbox contract;
- the current free optimizer;
- the existing Google Maps and Garmin export workflow.

Disabling the cloud store must not delete the cloud records or require rewriting
the workbook.