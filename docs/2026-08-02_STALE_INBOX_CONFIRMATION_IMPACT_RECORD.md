# Stale Workbook Inbox Confirmation — Level 3 Impact Record

## Operator goal and approval

Prevent a workbook inbox exported before the current local calendar day from
silently replacing the active route. The operator selected the previous-day
cutoff on 2026-08-02.

Implementation authorization is recorded. Explicit Level 3 pre-merge approval
is still required after the final branch checks pass.

## Problem and evidence

Connecting Google Drive currently applies every structurally valid nonempty
inbox immediately. A valid older inbox can therefore replace the current route
without warning.

## Scope and ownership

- `inbox.js` owns the local-calendar freshness check.
- `app.js` owns the confirmation, route-state decision, and visible result.
- `index.html` updates cache versions for the two runtime owners.
- `tests/inbox.test.js` covers local-calendar boundaries.
- `tests/drive-autosave.test.js` verifies that confirmation precedes route
  replacement and that cancellation keeps the route.

Read surfaces: the already-parsed inbox `updatedAt` value and address count.

Write surfaces after approval: the existing saved-stop merge and route
selection replacement. Cancellation performs neither of those writes; the
existing auto-save may save the unchanged app state after Drive connects.

## Required and optional data

Required for a nonempty inbox: the existing valid `updatedAt` value and at
least one valid address.

Optional fields and all existing address, source, alias, label, note, and
coordinate behavior remain unchanged.

## Schema, permissions, and integration compatibility

No filename, Drive folder, JSON version, JSON structure, field name, field
meaning, storage schema, OAuth scope, or permission changes.

The upstream workbook already exports the valid timestamp consumed by the
router. No workbook runtime change is required, and older structurally valid
inboxes remain readable.

## Freshness rule and hard limits

- An inbox exported on the operator's current local calendar date imports
  normally.
- An inbox exported on any other local calendar date requires confirmation.
- Missing or invalid timestamps continue to be rejected before route changes.
- The existing address count and import limits remain unchanged.

## Protected behavior

- A fresh valid inbox keeps the current automatic import behavior.
- Confirmation never changes saved addresses or the route by itself.
- Canceling preserves saved addresses, pins, Home, settings, and the complete
  current route selection.
- Approving uses the existing importer, print order, duplicate handling, alias
  migration, pin protection, and saved-address preservation.
- Empty inbox behavior and automatic backup status remain unchanged.

## Primary risks

- UTC comparison could incorrectly classify an export near midnight. The check
  therefore compares local year, month, and day components.
- Confirmation placed after import would be ineffective. A focused source-order
  check protects the decision before the existing apply call.
- A canceled import could misleadingly report success. Cancellation receives a
  separate status stating that the current route was kept.

## Validation plan

Focused development checks:

- same local day at opposite ends of the day;
- previous local calendar day;
- future/ambiguous local calendar day;
- confirmation source order before route replacement;
- cancellation status stating that the route was kept.

Final gate on the exact runtime head:

- complete `npm test` suite;
- all root JavaScript syntax checks;
- repository contract and diff checks;
- explicit pre-merge operator approval.

Post-publication live checks:

1. Confirm a same-day inbox imports without a warning.
2. Confirm a previous-day inbox shows the warning before replacement.
3. Cancel once and confirm the route remains unchanged.
4. Approve once and confirm every inbox stop appears exactly once in print
   order while saved addresses remain.

## Baseline, rollback, and recovery

Baseline and rollback commit: `94e1d5721e33bd88fc6a22cc04f40611cb92a87a`.

If the live confirmation or cancellation behavior fails:

1. stop reconnecting to the workbook inbox;
2. preserve browser data and the Drive backup;
3. restore the baseline through a dedicated rollback pull request;
4. verify Settings, saved addresses, and the prior route selection before any
   further change to this surface.

No partial migration or cleanup is required because this change creates no new
stored data.
