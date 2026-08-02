# Cloud Address Memory and Synchronization Contract

## Purpose

This contract defines the required behavior for moving Free Map Router address
memory from browser-only storage to an authenticated cloud store while preserving
field usability, manual pins, address corrections, imports, routes, backups,
Google Maps, and Garmin exports.

It supplements `CONTRACT.md`, `CHANGE_CONTROL_CONTRACT.md`,
`TESTING_CONTRACT.md`, `INTEGRATION_CONTRACT.md`, and the standalone import and
Google routing planning documents.

If this contract conflicts with a broader repository contract, the more
protective rule controls until the conflict is deliberately resolved.

## Authority rule

The cloud address-memory store is the authoritative source for reusable saved
router destinations.

Browser storage is:

- a cache;
- a temporary working copy;
- an offline aid;
- never the only accepted copy after migration is complete.

A browser reset, cleared site data, device loss, or new browser profile must not
erase the authoritative address memory.

## Workbook boundary

The cloud address memory is not `Job_Log` and does not replace the workbook.

The workbook remains authoritative for:

- imported job history;
- completion and turn-in records;
- forecasting and prediction history;
- conflict review;
- printing;
- workbook-specific source data.

The cloud memory is authoritative only for reusable routing destinations and
router-owned metadata.

The app must not write cloud corrections, pins, notes, deletions, or route order
back into workbook `Job_Log` unless a separate coordinated change is approved.

## Supported import origins

Every accepted address-memory record may retain an import-origin value:

- Workbook;
- Local File;
- Manual.

Import origin is provenance only. It is not the route source label.

Route source remains limited to:

- GIS;
- DCFS;
- blank.

MCS must not be introduced as a dedicated route source.

## Stable identity rule

Each address-memory record requires one stable cloud ID.

The stable ID must survive:

- corrected display text;
- additional original aliases;
- geocoding;
- manual pinning;
- notes and label edits;
- repeated workbook or file imports;
- route selection and optimization;
- device changes;
- browser cache replacement.

Coordinates, current address text, array position, file row number, and normalized
address are not sufficient by themselves as permanent identity.

## Address correction rule

The cloud memory may store:

- current approved routing address;
- original address aliases;
- normalized keys;
- narrowly documented correction provenance.

Automatic corrections may fix only governed, high-confidence formatting and
exact known corrections.

The system must not silently change:

- house number;
- city;
- state;
- ZIP code;
- apartment or unit identity;
- physical destination.

A geocoder result is a suggestion, not authority for changing identity-bearing
address fields.

Any proposed correction that could change the physical destination requires
operator review or a manual pin.

## Duplicate rule

Duplicate detection must distinguish:

- exact same physical address;
- known alias for the same address;
- same coordinates with different legitimate units or jobs;
- similar text that is not proven identical;
- repeated import of an existing record.

A duplicate merge may occur only under approved exact rules.

When records merge, preserve the strongest available data:

1. stable manual pin;
2. approved corrected address;
3. original aliases;
4. existing notes and label unless deliberately replaced;
5. GIS or DCFS source under the approved source rule;
6. earliest created timestamp;
7. latest valid update metadata.

An uncertain match must be shown for review and must not be silently merged.

## Pin priority rule

Pin strength is ordered as follows unless the final schema records a more
specific equivalent:

1. manual pin;
2. operator-approved geocode;
3. ordinary geocode;
4. unresolved.

A cloud import, workbook inbox, local file, restore, migration, or Google routing
response must not weaken or replace a stronger pin automatically.

Google Route Optimization may read coordinates but may not write or alter saved
coordinates or pin status.

## Revision rule

Every writable cloud record requires revision or equivalent concurrency control.

A write must identify the version it is based on. When the cloud record has
changed since that version:

- the stale write must not overwrite the newer record automatically;
- the app must show a conflict or refresh requirement;
- both versions must remain recoverable until resolved;
- manual pins and identity fields receive the strongest protection.

Last-write-wins without a revision check is not sufficient for the authoritative
store.

## Serialized write rule

Cloud writes must be serialized or otherwise ordered safely.

The app must prevent an older asynchronous write from completing after a newer
write and becoming authoritative.

The interface must distinguish:

- pending;
- saved;
- offline/queued;
- failed;
- conflict;
- loaded from cache;
- verified from cloud.

A failed or queued write must not display as safely stored in cloud.

## Read and startup rule

On authenticated startup, the app should:

1. retain the last verified cache without deleting it;
2. authenticate the operator;
3. fetch cloud revisions;
4. validate schema and ownership;
5. merge only under approved rules;
6. show cloud timestamp and record count;
7. identify whether current data is cloud-current, cached, stale, or offline.

An empty, malformed, unauthorized, or failed cloud response must not silently
replace a nonempty valid cache.

## Offline rule

The app may use the last verified cache while offline.

Offline operation must:

- clearly show that cloud freshness is unverified;
- allow route selection, free optimization, Google Maps generation where
  available, and Garmin export from cached records;
- avoid claiming cloud save success;
- keep queued changes bounded and visible;
- require conflict-safe synchronization when connectivity returns.

The first version may choose read-only offline mode if safe queued writes are not
yet proven.

## Delete and archive rule

Ordinary address deletion must not immediately destroy the only cloud copy.

The initial production design should use a recoverable archived or soft-deleted
state for an approved retention period.

A delete must:

- require clear confirmation when it affects saved memory;
- preserve stable ID and audit metadata during the recovery period;
- remove the record from normal route selection;
- avoid deleting workbook history;
- avoid changing Drive snapshots;
- be restorable through an explicit review action.

Permanent purge requires separate confirmation and must not be bundled with
ordinary route clearing.

`Clear Route` continues to remove only current route selection. It must never
delete cloud address memory.

## Backup rule

The authoritative cloud store and recovery snapshots serve different purposes.

Recovery snapshots must:

- be dated and immutable after creation;
- include schema version, record count, timestamp, and integrity information;
- remain separate from live synchronization;
- not be selected automatically merely because they look recent;
- require preview and confirmation before restore;
- never allow an older snapshot to silently reintroduce deleted records.

At least one verified pre-migration snapshot is required before cloud migration.

## Restore rule

Restore is a staged operation, not a direct blind replacement.

Before applying a restore, show:

- snapshot timestamp;
- record count;
- new records;
- records that would change;
- archived records that would return;
- conflicts;
- manual-pin impacts;
- schema compatibility.

A restore must preserve the current live state until the restored set is
validated and explicitly approved.

## Import rule

Workbook inbox, local file, and manual imports use the same cloud validation
pipeline after parsing.

Before cloud write, the app must classify every candidate as:

- new;
- exact existing match;
- approved alias update;
- duplicate;
- uncertain;
- invalid;
- conflicting.

The operator must be able to review original and proposed corrected addresses.

An import may update existing memory only under the approved correction,
duplicate, source, and pin rules.

## Route-state separation rule

Saved cloud addresses and current route selection are separate data surfaces.

Cloud address changes must not automatically add every address to the active
route.

Route optimization may replace current route order after validation, but it may
not rewrite cloud address records.

Google Maps and Garmin export use the final visible current route order.

## Data minimization rule

The cloud address memory may store only data needed for reusable route
destinations and safe synchronization.

It must not store without separate approval:

- InspectorADE passwords or sessions;
- Gmail content;
- workbook contents or full `Job_Log` rows;
- payment or billing information;
- customer documents;
- photos;
- unrelated Drive files;
- full Google routing provider responses;
- hidden analytics profiles.

Complete addresses and coordinates are sensitive operational data and must not be
written to ordinary production logs.

## Authentication and authorization rule

Anonymous cloud access is prohibited.

The approved initial operators are:

- `InandOutInspections2026@gmail.com`;
- `timbone72@gmail.com`.

The backend must verify identity server-side and enforce the allowlist or an
approved equivalent role model.

An email string supplied in ordinary request JSON is not authentication.

The runtime service account receives only the minimum permissions required for
the approved address-memory operations and Google routing call.

## Public-app rule

The static GitHub Pages app must not contain:

- service-account keys;
- confidential client secrets;
- unrestricted API keys;
- long-lived bearer tokens;
- database administrator credentials.

The browser calls only the authenticated private backend or an equally reviewed
Firebase client path protected by Authentication, Security Rules, and app-level
validation.

## Logging rule

Allowed production logs include:

- timestamp;
- minimized operator identifier;
- request ID;
- operation type;
- record count;
- record IDs when necessary and nonrevealing;
- revision conflict category;
- latency;
- success or sanitized failure category.

Production logs must not include full addresses, coordinates, notes, OAuth
tokens, API keys, or raw database/provider payloads.

## Migration rule

Browser-to-cloud migration is one controlled operation.

Required protections:

- stable production baseline recorded;
- current browser export preserved;
- latest valid Drive backup preserved;
- dry-run comparison before writes;
- exact counts for accepted, duplicate, conflicting, and unresolved records;
- explicit operator approval of the migration set;
- post-write re-read and field comparison;
- no deletion of local or Drive recovery data during verification;
- rollback instructions tested before production migration.

A migration cannot run automatically on ordinary page load.

## Schema rule

The cloud schema must be versioned.

The app must reject an unsupported future schema without overwriting cloud or
cache data.

Backward-compatible optional fields are preferred. Any destructive schema
migration requires a separate Level 3 impact record, fixture, backup, rollback,
and explicit pre-merge approval.

## Failure rule

Authentication failure, cloud outage, malformed data, revision conflict,
quota exhaustion, timeout, partial migration, invalid import, or failed write
must:

- preserve current valid cache;
- preserve cloud data already committed;
- leave current route recoverable;
- show a clear operator-facing status;
- prevent false save confirmation;
- keep workbook data unchanged;
- keep the free optimizer and Garmin export available from valid cached records
  where safe.

## Testing requirement

Before production migration, tests must cover:

- browser clearing followed by cloud recovery;
- new-device sign-in;
- unauthorized account rejection;
- empty and malformed cloud responses;
- old cache versus newer cloud revision;
- older write finishing after newer write;
- simultaneous edits and conflict handling;
- manual pin preservation;
- corrected-address alias migration;
- exact duplicate and uncertain-match behavior;
- archive, restore, and permanent purge boundaries;
- stale snapshot restore preview;
- workbook, local file, and manual origin preservation;
- GIS/DCFS/blank source behavior;
- MCS prohibition;
- 500 or more address-memory records;
- offline read-only or queued-write behavior;
- cloud outage during route building;
- Google Maps and Garmin order after cloud load;
- rollback to the last browser/Drive-backed app version.

Live production data must not be used for destructive tests.

## Cost and quota rule

The cloud project requires budgets, alerts, conservative quotas, and request
limits before production enablement.

The application must not create background loops, unrestricted listeners,
unbounded retries, or writes on every render.

Usage and cost must be reviewable without logging address contents.

## Change classification

Planning documents are Level 1.

Any runtime storage, authentication, permission, migration, backup, deletion,
restore, or synchronization implementation under this contract is Level 3 and
requires:

- a dedicated implementation branch and pull request;
- full impact record;
- realistic sanitized fixtures;
- complete focused and full-suite verification;
- safe test environment;
- exact rollback steps;
- explicit operator approval before merge;
- post-publication live verification.
