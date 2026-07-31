# Free Map Router Change Control Contract

## Purpose

This contract controls how changes are approved, implemented, tested, reviewed, merged, and rolled back. It prevents a requested fix from becoming an unrequested redesign or an untested live edit.

## Change classes

### Normal behavior change

Examples include route labels, numbering, optimization, imports, Garmin export, Google Maps export, saved addresses, and page controls.

Rules:

- Work on a branch.
- Record the exact problem and scope before implementation.
- Change only the owning module and its tests.
- Preserve unrelated pages, stored data, route order, exports, and controls.
- Merge only after complete automated verification and the required operator smoke test.

### Presentation-only change

Examples include wording, spacing, visibility, and display labels.

Rules:

- Presentation changes may not alter saved data, selection state, route order, coordinates, or export contents unless explicitly approved.
- A presentation change must be implemented in the owning render function or style sheet.
- A post-render observer, polling loop, or unrelated script may not rewrite an owned surface.

### Repair or rollback

Rules:

- A repair may restore a prior known-good file or commit.
- A repair must not introduce a new feature.
- The rollback point must be identified before deployment.
- When the live app is frozen or unusable, restoring responsiveness takes priority over preserving an incomplete feature.

## Before implementation

The change record must state:

- exact user-facing problem;
- reproducible evidence;
- requested change;
- files and functions expected to change;
- read surfaces;
- write surfaces;
- protected behavior;
- required and optional data;
- hard limits;
- stale-output behavior;
- realistic test fixture;
- baseline full-suite result;
- expected post-change tests;
- validation commands;
- risks;
- rollback commit; and
- required live checks.

Implementation stops when structural assumptions remain unverified.

## Authorization

- A contract finding is not implementation authorization.
- An audit observation is not implementation authorization.
- Explicit operator approval is required for intentional behavior changes.
- Adjacent defects are reported separately.
- No direct feature work is performed on `main`.
- No file is added to `index.html` merely to patch another module's live output.
- Targeted tests may not be reported as the complete suite.

## Ownership boundaries

- `contract.js` owns normalized stored-data behavior.
- `app.js` owns page state, address selection, and rendered lists.
- `routing.js` owns route ordering and Google Maps route construction.
- `garmin-gpx.js` owns GPX content and Garmin point names.
- `garmin-export-ui.js` owns the Garmin download button and export invocation only. It does not own address-page or route-list rendering.
- `index.html` owns script loading and page structure.
- CSS owns appearance only.

A helper may not silently take ownership from another module.

## DOM safety

- First-party code must not create an unbounded render or mutation cycle.
- A `MutationObserver` is prohibited by default on first-party app surfaces.
- An exception requires an explicit contract amendment, a bounded and idempotent callback, an allowlist entry naming the file and test, and a regression test proving that the callback cannot trigger itself.
- Event handlers may update state and call the owning render function. They may not repeatedly mutate an observed subtree.
- Address checkboxes, Select All, Clear, Delete, Edit, route Up/Down/Remove, and page navigation are protected controls.

## Diff control

- Inspect every changed file and function.
- Explain every changed block.
- Remove unrelated changes.
- A display-only request may not alter optimization, storage, imports, exports, or selection behavior.
- A Garmin-label request may not change the Address page or Build Route controls.

## Verification

Every behavior change requires:

1. focused regression tests;
2. the complete `npm test` suite;
3. JavaScript syntax checks;
4. contract-gate checks when present;
5. diff inspection; and
6. the relevant live smoke test from `REGRESSION_CHECKLIST.md`.

A failure at any step stops deployment.

## Deployment

- Commit and push the branch before review.
- Use a pull request into `main`.
- Do not merge until checks pass and the operator approves the intended behavior.
- After merge, verify the published GitHub Pages version before declaring success.
- If the live smoke test fails, roll back to the recorded working commit before attempting another feature change.

## Maintenance rule

A documented imperfection may remain when the risk of changing it is greater than its current impact. Working behavior is not changed merely because a cleaner implementation exists.
