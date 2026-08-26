# Manual Gig Route Checkbox Change Record

Date: 2026-08-26
Change class: Level 2 — normal control / route-membership UX correction

## Problem

Manual gig route intent was stored in `routeIncluded`, but the operator could
only see or change that state by opening Edit. This made it difficult to know
which gigs would be reapplied when a workbook route was started.

## Approved behavior

- Every saved manual gig shows a visible **Include in Route** checkbox.
- Checked means that exact gig's physical stop is included in both saved route
  versions.
- Unchecked means that gig is not contributing route membership.
- Editing gig details does not change the current route checkbox state.
- Newly entered ordinary manual gigs start unchecked.
- Existing scheduled **Add to Route** behavior remains intentional route
  inclusion.
- Multiple included gigs at one physical address still produce one driving stop.
- Removing one gig's route membership does not remove a shared physical stop
  when another gig or workbook Order ID still needs it.
- **Clear Manual Gig Work** continues to turn off saved gig route inclusion
  without deleting the gigs.

## Owning files

Runtime:
- `manual-gigs.js`
- `index.html`
- `styles.css`

Protection:
- `tests/manual-gig-ui.test.js`
- `CONTRACT.md`
- this change record

## Read/write surfaces

Reads:
- saved manual gigs
- saved Google/Basic route history
- saved stop IDs

Writes only after the operator changes a checkbox:
- that gig's local `routeIncluded`
- corresponding Google/Basic route gig membership

No workbook sheet, Drive handoff schema, Gig Handoff schema, workbook Order ID,
prediction history, Manual Work Library property, or Drive permission is
changed.

## Protected behavior

- immutable Gig_ID
- exact physical-stop identity
- shared-stop de-duplication
- workbook Order IDs
- Google/Basic saved route ownership
- five-page navigation
- explicit manual Gig Handoff sync
- no automatic workbook synchronization
- no broader Drive permission

## Verification

Focused:
- 32 focused tests passed.

Final runtime gate:
- 318/318 repository tests passed.
- root JavaScript syntax checks passed.
- `git diff --check` passed.

## Rollback

Pre-change stabilization commit:

`d7a5c4756dadc437718f307a7b4691767b2e236b`

## Publication

No merge to `main` and no production deployment are included in this change.
