# Address Checkbox Visual Polish — Level 1 Change Record

**Date:** 2026-08-22  
**Repository:** `timbone72-CC/free-map-router`  
**Branch:** `fix/address-checkbox-visual-polish-20260822`  
**Rollback commit:** `78db39ab0ee7067052dfecc91d1962a351a2ef27`  
**Change level:** Level 1 — appearance-only runtime correction

## Problem

Live validation of the new Addresses internal views exposed two visual defects:

1. **Show Archived** is clickable but its checkbox state is visually hidden, so the operator cannot tell whether archived properties are being shown.
2. Saved-address route-selection checkboxes inherit the page-wide input width and render on their own line above the address instead of inline with the address row.

## Approved scope

Correct only those two visual issues:

- make the existing **Show Archived** checkbox visibly show its checked/unchecked state;
- keep each existing Saved Addresses route-selection checkbox inline with its address row.

No control semantics, route selection, archive state, storage, Google Drive behavior, workbook handoff, page structure, or data contract changes.

## Owning files

- `styles.css` — narrow checkbox presentation overrides only.
- `tests/address-internal-views.test.js` — focused structural coverage for the visual overrides.

## Protected behavior

- the four Addresses internal views remain unchanged;
- Show Archived remains off by default and continues to control only archived-row visibility;
- Saved Addresses checkboxes keep the same route-selection behavior;
- address edit/delete controls remain unchanged;
- Manual Work Library archive/restore behavior remains unchanged;
- no storage, Drive, route-order, optimizer, workbook, or permission changes.

## Verification

Focused coverage checks that the Show Archived checkbox is no longer visually clipped and Saved Addresses selection checkboxes override the global full-width input rule. Final CI must pass on the exact PR head before merge.

## Live smoke check

After publication:

1. Open **Addresses → Work Library** and confirm a visible checkbox appears beside **Show Archived** and its state is obvious when toggled.
2. Open **Addresses → Saved Addresses** and confirm route-selection checkboxes sit inline with their address rows.
3. Check and uncheck one saved address and confirm route selection still behaves normally.

**No workbook/router integration impact.**
