# Manual Work Library Foundation — Level 3 Impact Record

**Date:** 2026-08-22  
**Repository:** `timbone72-CC/free-map-router`  
**Branch:** `work/manual-work-library-foundation-20260822`  
**Rollback commit:** `045f83ba9a9edd37bfd3dc0e3c0b8e7c41e15a1e`  
**Runtime head verified:** `e8e615d0ea2c406df1160fb558531cb124e521ca`  
**Change level:** Level 3 — new persistent Drive record plus automatic Drive writes  
**Status:** IMPLEMENTED / CI VERIFIED 261/261 / PRE-MERGE APPROVAL STILL REQUIRED

## Problem

Manual/HNP gigs currently survive browser refresh and whole-app backup, but reusable manual properties do not have their own permanent Drive-backed library. A route or gig action must not become the only thing keeping a repeat property alive, and the operator must not have to remember to create a recovery backup after every manual property save.

The existing permanent InspectorADE/workbook address-correction record already solves a different problem and must remain separate.

## Approved scope

Implement the smallest Phase 1B runtime piece: a permanent **Manual Work Library foundation** for reusable manual/HNP physical properties.

This change will:

- create one app-owned Drive file named **`Free Map Router Manual Work.json`** inside the existing **Free Map Router** folder;
- keep reusable manual properties separate from InspectorADE address corrections, workbook Order IDs, `Job_Log`, `Prediction_History`, and prediction scoring;
- automatically attempt to update the Manual Work Library when a manual gig creates or changes its physical property;
- reuse the existing `drive.file` permission only; no new Google permission or backend service is introduced;
- keep the reusable property when a gig is removed from a route or when a gig occurrence is deleted;
- provide an archive/restore path for reusable manual properties instead of treating routine cleanup as permanent deletion;
- prevent ordinary address deletion from silently destroying or orphaning a protected Manual Work Library property;
- merge remote and local Manual Work Library records by stable property identity and per-record timestamps so an older unchanged device state does not silently replace a newer property record during library synchronization;
- restore non-archived Manual Work Library properties into the local saved-address collection when the operator uses **Sync Library**;
- preserve current ADE permanent correction behavior unchanged.

## Explicitly excluded from this runtime piece

The following approved Phase 1B roadmap items remain for a following pull request after this storage foundation is live-proven:

- due dates;
- recurring templates;
- Every X days/weeks/months cadence;
- Due Soon / Due Today / Overdue Home alerts;
- Add to Route from a due alert;
- schedule advancement;
- Google Calendar;
- background push notifications;
- any InspectorADE workbook runtime/schema change;
- route-pay, photo, submission, or payment lifecycle work.

No workbook/router integration impact. The workbook inbox filename, structure, address text, source field, Order IDs, duplicate handling, route-order return, and workbook runtime remain unchanged.

## Data model

### Required Manual Work Library envelope

- `app = "free-map-router"`
- `manualWorkVersion = 1`
- `updatedAt`
- `properties[]`

### Required property data

- immutable `propertyId`
- normalized current `address`
- `addressAliases[]` for prior exact manual-property addresses
- `updatedAt`
- `archived`

### Optional property data

- `latitude`
- `longitude`
- `placeId`
- `pinStatus`

The permanent manual-property record does **not** store GIS/DCFS source, InspectorADE Order IDs, workbook route metadata, gig work-order IDs, gig pay, route membership, Home, or API keys.

## Identity and merge rules

- `propertyId` is the durable Manual Work Library identity.
- Physical-stop identity inside the route app remains normalized address-based.
- Exact current address or exact saved alias may associate a local stop with an existing property.
- A property address correction keeps `propertyId` and stores the prior exact address as an alias.
- Remote/local merge compares matching `propertyId`s and keeps the newer `updatedAt` record.
- When two records independently represent the same exact current address, normalization converges them without creating two local driving stops.
- A newer archived property is not resurrected by an older unchanged active copy during Sync Library.
- A deliberate later operator action such as restoring/reusing a property may create a newer property update; this is not treated as passive stale-device replacement.

## Drive behavior and permissions

- Existing scope remains `https://www.googleapis.com/auth/drive.file`.
- No broad Drive-read permission is added.
- The app may read/write only app-created or app-selected files available under that scope.
- Saving/editing a manual gig automatically attempts the small Manual Work Library write.
- If the Drive write fails or Google authorization is not approved, the local gig/property remains saved and the UI clearly states that the permanent Drive save did not complete.
- The app never claims a property is permanent when the Drive write failed.
- Existing **Back Up Now** remains a separate point-in-time recovery action and is not redefined as the Manual Work Library writer.
- **Sync Library** is the explicit recovery/cross-device refresh control for this property library; the change does not add polling, background sync, or live multi-device gig synchronization.

## Read/write surfaces

### Reads

- current saved stops;
- current manual gigs;
- local Manual Work Library state;
- remote `Free Map Router Manual Work.json` when Save Gig/Edit or Sync Library obtains a valid Drive token.

### Writes

- local Manual Work Library state;
- the one Manual Work Library Drive file;
- local saved stops only when restoring a non-archived library property that is missing locally;
- existing manual-gig/route state only through already-governed manual-gig actions.

No workbook file, route-order file, address inbox, permanent ADE correction record, Home record, routing algorithm, or backend is written by this feature.

## Protected behavior

The change preserves:

- five-page menu and current page names/order;
- workbook route import and pending-route behavior;
- permanent ADE/workbook address corrections and exact-alias matching;
- GIS/DCFS source ownership;
- Basic and Google route versions;
- manual gig `Gig_ID` identity and same-address multi-gig behavior;
- route inclusion and symmetric source clearing;
- manual pin priority;
- navigation, Google Maps and Garmin output;
- manual backup/restore;
- no automatic route addition.

## Deletion and archive safety

- **Remove** from Build Route is route-only and never changes Manual Work Library storage.
- **Delete Gig** deletes only that gig occurrence and keeps its property.
- A Manual Work Library property uses **Archive** for normal removal from reusable lists.
- Archived properties remain in the permanent record and can be restored.
- Ordinary Address-page deletion is blocked while a manual gig references the address or while the reusable property remains active.
- Archive requires an explicit confirmation and attempts to persist the archive state to Drive.
- Permanent hard-delete of Manual Work Library records is not introduced in this change.

## Hard limits

- One Manual Work Library Drive file per app folder.
- One active reusable property per exact normalized current address after normalization.
- No timers, polling loops, MutationObservers, service workers, or background notification processes are added.
- No automatic Add to Route behavior.

## Stale-output behavior

If Drive sync cannot complete, the local copy remains usable but is labeled as not yet saved permanently. A later successful Sync Library merges per-property records rather than replacing the whole library with an older unchanged device snapshot. This foundation does not claim transactional simultaneous-write conflict resolution or live multi-device gig synchronization.

## Realistic fixture / safe validation plan

Representative automated fixtures cover:

1. one HNP property with a normal street address and manual pin;
2. two gigs sharing one physical property;
3. the same Manual Work Library property present on two simulated device states with different `updatedAt` values;
4. an archived property versus an older active copy;
5. separation from ADE source and workbook Order IDs;
6. Drive-save failure messaging that leaves local work intact;
7. a remote property missing locally that restores as one unselected saved address;
8. exact Drive file create/update/load behavior under the existing limited scope.

No live workbook data is modified for development verification.

## Focused automated tests

Coverage now protects:

- Manual Work Library normalization and stable property identity;
- exact-address/alias association;
- timestamp-aware stale-safe merge;
- archive winning over an older active copy;
- Drive file find/create/update/load behavior under the existing scope;
- automatic manual-property save success/failure paths and status copy;
- Delete Gig preserving the property;
- Build Route removal preserving the property;
- library sync restoring one missing address without route inclusion;
- protected ADE source/Order-ID isolation;
- five-page navigation, script order, and no new permission/background process.

## Verification result

The first PR run failed only because two pre-existing backup tests still asserted the old wording that permanent address corrections were the sole narrow automatic Drive-write exception. Those assertions were updated to the newly approved contract; no runtime failure was bypassed.

Final runtime head `e8e615d0ea2c406df1160fb558531cb124e521ca` passed GitHub Actions run `32611876196`, job `97126125329`:

- **261 tests / 261 passed / 0 failed**;
- all focused Manual Work Library tests passed;
- all first-party root JavaScript files passed `node --check`;
- no workbook, backend, routing algorithm, deployment, or Drive-permission file changed.

Per `TESTING_CONTRACT.md`, this documentation-only verification record update does not invalidate that successful final runtime result.

## Final diff review

Compared with rollback/base `045f83ba9a9edd37bfd3dc0e3c0b8e7c41e15a1e`, the runtime scope is limited to:

- Manual Work Library property contract;
- narrow Drive adapter using the existing `drive.file` scope;
- Manual Gig integration and delete/archive protection;
- Addresses-page Manual Work Library controls;
- governing contract/checklist updates;
- focused tests and this impact record.

`app.js`, workbook handoff schemas, route-history logic, routing/optimization, backend, Cloud Run/deployment configuration, and InspectorADE repository/runtime are unchanged.

## Live smoke after publication

After merge/publication, validate with a disposable manual property:

1. save a manual gig/property and confirm the UI reports permanent Drive save success;
2. refresh and confirm the gig/property remains;
3. delete only the gig and confirm the reusable property remains;
4. remove the property from the route and confirm the reusable property remains;
5. archive and restore the property;
6. use **Sync Library** from a second/recovered browser state and confirm the non-archived property restores exactly once and is not automatically added to either route;
7. confirm a known ADE correction still resolves normally.

## Failure recovery / rollback

If tests or live validation fail:

- do not merge while the branch is failing;
- if a published build fails, restore runtime to `045f83ba9a9edd37bfd3dc0e3c0b8e7c41e15a1e` before further changes to the affected surface;
- the new Manual Work Library file is additive and separate, so rollback does not require deleting it;
- existing local stops/gigs and ADE correction records remain authoritative for the pre-change app after rollback.

## Pre-merge approval

Implementation is authorized by the operator's approved Phase 1B roadmap direction. Because this is Level 3, a separate explicit **pre-merge approval** is still required on PR #55 after this verification record.