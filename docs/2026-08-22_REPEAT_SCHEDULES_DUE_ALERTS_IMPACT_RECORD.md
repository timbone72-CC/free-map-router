# Phase 1C — Repeat Schedules and Automatic Due Alerts

**Change class:** Level 3 — persistent Manual Work Library schema plus automatic narrow Drive writes  
**Approved scope:** 2026-08-22 operator approval for Phase 1C  
**Rollback commit:** `b862ba792d6259d8e1a178872d56df9bc65b2127`  
**Pull request:** #58  
**Final runtime head:** `03ab871b210c8e0f03980e243f157acd5e7c5fed`

## Problem

Reusable manual/HNP properties now survive outside today's route, but repeat work still has no durable cadence, next-due date, or automatic in-app warning. The operator must remember recurring work manually.

## Approved behavior

- One reusable Manual Work Library property may have one initial repeat schedule in this phase.
- The repeat schedule stores source/company, default expected pay, default notes, cadence, next due date, and a four-day alert lead.
- Cadence is intentionally limited to every X days, weeks, or months.
- The app derives `Upcoming`, `Due Soon`, `Due Today`, and `Overdue` from local calendar dates when the app opens/renders. No timer, polling loop, background notification, push permission, or Google Calendar integration is added.
- Home shows a compact due-work summary and can open the existing Addresses → Work Library view.
- Due Soon / Due Today / Overdue work exposes `Add to Route`. It never auto-adds.
- `Add to Route` creates a new manual gig occurrence through the existing Gig_ID contract, includes its physical stop in both saved route versions, and advances the repeat template from the scheduled due date to the first future scheduled date. Adding early therefore does not cause cadence drift.
- The generated occurrence inherits template source, expected pay, and default notes. Work-order/job ID remains blank because recurring vendor work-order IDs may change per occurrence and can be entered on the created gig later.
- Existing version-1 Manual Work Library files migrate in memory to version 2 with zero schedules; property IDs, addresses, aliases, pins, archive state, and updated timestamps remain intact.
- Schedule saves and schedule advancement reuse the existing `Free Map Router Manual Work.json` file and existing `drive.file` permission.

## Owning files changed

- `manual-work-library.js` — version-2 normalized schedule/template data, migration, due-state derivation, recurrence advancement, stale-safe template merge, and damaged-record fail-closed behavior.
- `manual-gigs.js` — Work Library schedule editor, due rendering, Home summary, explicit Add to Route action, and existing Drive sync path.
- `index.html` — cache-version bumps for the two changed runtime scripts only.
- `CONTRACT.md` — governs repeat-template identity, persistence, due states, and explicit route materialization.
- `REGRESSION_CHECKLIST.md` — records repeat-schedule and data-preservation checks.
- this impact record.
- focused tests under `tests/`.

No `styles.css`, routing, optimizer, backend, Google Drive permission, workbook handoff, or deployment runtime file is changed.

## Read surfaces

- existing Manual Work Library property records;
- existing manual gig collection;
- current saved stops and named route snapshots;
- operator local calendar date;
- existing Manual Work Library Drive file during explicit/schedule-triggered sync.

## Write surfaces

- existing browser Manual Work Library local-storage record;
- existing `Free Map Router Manual Work.json` Drive file;
- existing local manual-gig collection when the operator presses `Add to Route`;
- existing Google and Basic route snapshots when the operator presses `Add to Route`.

No other Drive file, workbook file, backend, route-order file, InspectorADE history, or prediction surface is written.

## Required and optional data

Required for a repeat schedule:
- immutable schedule/template ID;
- existing Manual Work Library `propertyId`;
- source/company;
- cadence count;
- cadence unit (`days`, `weeks`, or `months`);
- next due date as an ISO local calendar date (`YYYY-MM-DD`);
- active state and `updatedAt`.

Optional:
- expected pay;
- default notes.

Initial alert lead is fixed at 4 days and normalized into the stored template.

## Schema and permission changes

- Manual Work Library `manualWorkVersion` changes from 1 to 2.
- Version 2 adds `templates[]`; existing `properties[]` structure is preserved.
- Version-1 local/Drive records remain accepted and migrate to version 2 with `templates: []`.
- Version-2 Drive records fail closed if repeat-schedule data is malformed or references a missing property; damaged schedule rows are not silently discarded and overwritten.
- The Drive filename and folder stay unchanged.
- No new Google permission is requested; existing `drive.file` remains the only Manual Work Library Drive scope.
- Manual gig schema stays version 1; schedule creation does not add fields to gig records.

## Hard limits

- Initial UI supports one repeat template per property to avoid list and workflow bloat.
- Cadence count must be an integer from 1 through 365.
- Unit must be days, weeks, or months.
- Alert lead is 4 days in this phase.
- Calendar dates must be valid `YYYY-MM-DD` values.
- No background alert delivery exists while the app is closed.

## Stale-output behavior

- Template merge uses immutable `templateId` and per-template `updatedAt`, matching property merge behavior.
- Unchanged older device state cannot replace a newer remote schedule during merge.
- An explicit later operator edit is treated as a later update.
- A Drive failure leaves the local schedule/gig/route action intact and visibly reports that permanent Drive storage did not complete; later Sync Library can retry.

## Protected behavior

- InspectorADE workbook inbox and route-order handoff are unchanged.
- ADE permanent address corrections stay in their existing separate correction file.
- Manual Work Library property IDs, addresses, aliases, pins, archive/restore, and deletion protection remain intact.
- Manual gigs remain separate from InspectorADE prediction/history and use immutable Gig_ID identity.
- Google and Basic optimization/navigation behavior is unchanged.
- Whole-app Back Up Now remains separate from narrow Manual Work Library persistence.
- No automatic Add to Route.

**No workbook/router integration impact.** The workbook inbox, Order IDs, source fields, route-order return file, and import semantics are not changed, so no companion workbook change or cross-project runtime test is required under `INTEGRATION_CONTRACT.md`.

## Primary risks and controls

1. A version-1 Manual Work Library could be rejected or lose properties during migration. Covered by explicit v1→v2 preservation tests.
2. A stale schedule from another device could overwrite a newer next-due date. Covered by immutable template identity plus per-template `updatedAt` merge tests.
3. A due-state date calculation could be off by one around local midnight/DST. Due classification uses local calendar dates and day ordinals rather than elapsed 24-hour timestamps; exact boundary tests cover the four-day window.
4. `Add to Route` could accidentally create duplicate physical route stops or contaminate workbook Order IDs. A realistic route fixture verifies one physical stop per named route, preserved ADE Order IDs, and unchanged pending route.
5. Advancing recurrence from the action date instead of the scheduled due date could cause cadence drift. Daily, weekly, and month-end tests verify scheduled-date anchoring.
6. A failed Drive write could falsely claim the new schedule is permanent. Runtime messaging preserves and identifies the local state and points to Sync Library for retry.
7. A damaged v2 schedule could be silently dropped and then overwritten during sync. The v2 Drive parser now fails closed instead.

## Focused verification

Covered by the final suite:
- version-1 → version-2 migration preserves all properties and produces no schedules;
- schedule normalization rejects invalid dates/counts/units/pay;
- one property remains one property while a schedule receives a stable template ID;
- newer template wins stale-safe merge;
- malformed v2 repeat-schedule data fails closed;
- Due Soon starts exactly four local calendar days before due date; Due Today and Overdue boundaries are exact;
- daily/weekly/monthly advancement remains anchored to the scheduled due date and skips forward to the first future scheduled date when overdue;
- month-end recurrence preserves its anchor where possible (`Jan 31 → Feb 28 → Mar 31` in the fixture);
- due `Add to Route` creates one new Gig_ID, one physical route stop in each route slot, no workbook Order ID, and advances the template once;
- the realistic ADE+manual route fixture preserves existing ADE Order IDs and leaves the pending workbook route unchanged;
- Home summary and Work Library schedule controls exist without adding a sixth page, timer, observer, calendar, push permission, or automatic route insertion;
- Drive tests confirm the same file/folder and `drive.file` permission remain in use.

## Final automated verification

- Baseline at rollback commit: **267/267 tests passed**, JavaScript syntax passed in PR #57 CI.
- Final runtime head: `03ab871b210c8e0f03980e243f157acd5e7c5fed`.
- GitHub Actions run: `32615932680` — **SUCCESS**.
- Complete suite: **284/284 tests passed, 0 failed**.
- First-party JavaScript `node --check`: **passed**.
- Runtime/test diff review completed against rollback baseline; no unrelated backend, optimizer, workbook-handoff, Drive-permission, or deployment runtime changes were found.

This final impact-record update is documentation-only; under `TESTING_CONTRACT.md` it does not invalidate the successful runtime verification above.

## Safe live validation plan

After merge/publication only:
1. Update App.
2. Use the disposable/manual test property, not an ADE address.
3. Create one repeat schedule with a near test due date and confirm the correct due label/Home summary.
4. Confirm no route change occurs until `Add to Route` is pressed.
5. Press `Add to Route` once; confirm one new manual gig, one physical stop in Google and Basic routes, and the next due date advances from the prior scheduled date.
6. Sync Library and refresh; confirm the schedule/next due survive.
7. Confirm the ADE route and permanent ADE correction behavior remain untouched.

## Failure recovery

- Before merge: do not merge; correct the branch or close the PR.
- After publication: revert/rollback to `b862ba792d6259d8e1a178872d56df9bc65b2127` if live validation reveals data loss, route contamination, or unusable migration.
- Version-1 data remains structurally understood by the new parser; rollback does not authorize deleting the version-2 Drive file. If rollback is required after a version-2 save, preserve the Drive file for recovery and diagnose before further writes.

## Pre-merge approval

Implementation authorization is approved. **Final Level 3 pre-merge operator approval is pending.** No merge may occur until the operator explicitly approves PR #58 after this final verification record.