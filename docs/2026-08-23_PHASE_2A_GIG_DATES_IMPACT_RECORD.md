# Phase 2A Manual Gig Dates Impact Record

## Exact problem and approved scope

Manual gig occurrences currently cannot retain their due date or completion date. Phase 2A upgrades only the local/recovery manual-gig occurrence schema from version 1 to version 2, adds optional Due Date and editable Completed Date to Addresses → Manual Gigs, adds one Complete Today action, and carries the current scheduled due date into a repeat-created occurrence before cadence advancement.

Phase 2A is a Level 3 stored-data schema change. Rollback point: `ee9b672e1dcd2c1bdbda97cb0a70e4d4767a4e7e`.

## Required and optional data

Existing required identity and attachment remain unchanged: immutable `Gig_ID` (`id`) and `stopId`. Existing source normalization remains unchanged. `dueDate` and `completedDate` are optional and normalize to either a real local calendar date in `YYYY-MM-DD` form or `null`.

## Schema migration

`GIG_SCHEMA_VERSION` changes from 1 to 2. Valid version-1 rows normalize in place to version 2 with `dueDate: null` and `completedDate: null`. The existing local-storage key remains unchanged so prior records remain readable. Identity, stop attachment, source, work-order ID, expected pay, notes, route inclusion, `createdAt`, and `updatedAt` are preserved. Whole-app backup version remains 2; its existing gig normalization path reads both valid version-1 and version-2 gig rows.

## Owning files and functions

- `gig-contract.js`: schema version, calendar-date normalization, local-date derivation, gig normalization, create/edit/storage migration.
- `manual-gigs.js`: form capture/edit, list display, Complete Today, and repeat-schedule Add to Route occurrence creation.
- `index.html`: two optional date inputs on the existing Manual Gigs form and cache-version updates for changed modules.
- Focused tests under `tests/` cover migration, persistence, correction/clear, local date, backup/restore, route isolation, repeat due-date capture, and immutable identity.

## Protected behavior

The five top-level pages, physical-stop identity, Google Route and Basic Route membership/order, permanent address corrections, Manual Work Library property/template identity, repeat cadence calculations, Drive permissions/files, workbook Order IDs, InspectorADE source/history/predictions, and route-order handoff remain unchanged. Completing a gig updates only that gig occurrence and does not remove or alter a physical route stop. No workbook/router integration impact.

## Realistic migration fixtures

- A valid HNP version-1 gig with immutable ID, saved stop, work-order ID, `$18.00` expected pay, notes, route inclusion, and distinct creation/update timestamps migrates with every existing field preserved and both dates null.
- A version-2 whole-app backup containing a version-1 gig row restores the same Gig ID and blank dates.
- A version-2 gig with due date `2026-08-25` and completed date `2026-08-23` survives backup and restore.
- A repeat template due `2026-09-18` creates an occurrence due `2026-09-18` before the template advances.

## Failure behavior

A nonblank date that is not an exact real `YYYY-MM-DD` calendar date invalidates only the affected gig under the existing skip-invalid damaged-record model. Other valid gigs, Home, stops, and routes remain recoverable. Interactive invalid input throws before prior stored gig data is replaced. A blank Completed Date normalizes to null and does not delete the gig.

## Focused tests

- version-1 to version-2 migration and immutable field preservation;
- due/completed date validation, persistence, edit, and completed-date clear;
- Complete Today local-calendar behavior across a UTC/local date boundary;
- repeat Add to Route carries the pre-advance scheduled due date;
- backup/restore compatibility for old and new gig rows;
- route membership/history unchanged by completion;
- Gig ID preserved through migration and edits.

## Live smoke-test plan

Create one manual gig with a Due Date and no Completed Date; verify it remains in both selected route slots. Tap Complete Today and verify the local date appears while the stop stays in Google Route and Basic Route. Edit the gig, change the Completed Date, save, then edit again and clear it. Refresh and verify the Gig ID-backed occurrence, dates, pay, notes, work-order ID, and route inclusion persist. Create due repeat work with Add to Route and verify the new gig shows the old scheduled due date while the template shows its next date. Download a backup and restore it in the controlled test browser.

## Exclusions

Phase 2B route pay, Phase 2C `Gig_Log` handoff, Phase 2D weekly pay Dashboard, Phase 2E Google Print, Received Date, lifecycle/status, paid/invoice state, Calendar, notifications, timers, polling, background behavior, new pages, new Drive files, broader permissions, live gig sync, and cadence changes are explicitly excluded.
