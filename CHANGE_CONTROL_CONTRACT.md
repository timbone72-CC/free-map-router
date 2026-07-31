# Free Map Router Change Control Contract

## Purpose

This contract controls how changes are approved, implemented, tested, reviewed,
merged, and rolled back. Its purpose is to prevent careless live damage while
keeping useful development moving.

The amount of process must match the amount of risk. Guardrails are not a reason
to turn every small improvement into a large project.

## Change levels

### Level 1 — low risk

Typical examples:

- documentation and comments;
- test descriptions or fixtures that do not redefine approved behavior;
- noninteractive wording;
- narrow appearance changes that cannot alter state, selection, storage, route
  order, imports, exports, or permissions.

Required process:

- use a branch;
- write a short scope record naming the changed surface and protected behavior;
- run automated CI;
- inspect the diff;
- perform one quick affected-surface check when runtime files change.

A full impact matrix, sandbox, or separate second approval is not required when
the change remains Level 1.

### Level 2 — normal feature or fix

Typical examples:

- route labels or numbering;
- page controls and normal interactions;
- Garmin point names or download behavior;
- import parsing;
- Google Maps route presentation;
- normal feature additions that do not alter the storage contract or broad
  permissions.

Required process:

- use a branch and pull request;
- record the exact problem, evidence, requested scope, owning files, protected
  behavior, risks, focused tests, rollback commit, and affected smoke checks;
- change only the owning module and its tests;
- pass focused coverage, the complete automated suite, and syntax checks;
- complete the affected live smoke check after publication.

The user's approved request is the implementation authorization. Do not ask for
the same approval again unless the scope changes.

### Level 3 — high risk

Typical examples:

- stored-data schema changes or migrations;
- deletion, bulk replacement, or automatic writes;
- Google Drive or API permission changes;
- routing-algorithm replacement;
- deployment or publishing changes;
- cross-application synchronization changes;
- changes whose failure could broadly lose data or make the app unusable.

Required process:

- use a dedicated branch and pull request;
- create the full impact record described below;
- use realistic fixtures and a safe validation environment when available;
- identify exact rollback steps before implementation;
- pass the complete automated suite and all affected smoke checks;
- obtain explicit operator approval before merge.

## Classification rules

- Choose the smallest level that honestly covers the risk.
- Importance alone does not make a change Level 3.
- When uncertainty remains between two levels, use the higher one.
- A change that expands while being implemented must be reclassified before the
  expanded work continues.
- Splitting unrelated work into separate changes is preferred over raising the
  risk of one broad change.

## Authorization

- The user's request and approval authorize the documented scope.
- No duplicate approval is required for Level 1 or Level 2 work when the scope
  remains unchanged.
- Level 3 requires explicit pre-merge approval even when implementation was
  previously authorized.
- A contract finding, code audit, or adjacent defect is not automatic
  implementation authorization.
- Adjacent defects must be reported separately.
- No direct feature work is performed on `main`.

## Required change records

### Level 1 record

State:

- what is changing;
- why it is low risk;
- the files expected to change;
- protected behavior; and
- the check that proves the changed surface still works.

### Level 2 record

State:

- exact user-facing problem;
- reproducible evidence;
- approved behavior;
- owning files and functions;
- read and write surfaces;
- protected behavior;
- focused tests;
- primary risks;
- rollback commit; and
- affected smoke checks.

### Level 3 impact record

In addition to the Level 2 record, state:

- required and optional data;
- schema or permission changes;
- hard limits;
- stale-output behavior;
- realistic fixture or safe-environment plan;
- baseline and expected full-suite results;
- failure recovery steps; and
- explicit pre-merge approval status.

Implementation stops when required structural assumptions remain unverified.

## Ownership boundaries

- `contract.js` owns normalized stored-data behavior.
- `app.js` owns page state, address selection, and rendered lists.
- `routing.js` owns route ordering and Google Maps route construction.
- `garmin-gpx.js` owns GPX content and Garmin point names.
- `garmin-export-ui.js` owns the Garmin download button and export invocation
  only. It does not own Address-page or route-list rendering.
- `index.html` owns script loading and page structure.
- CSS owns appearance only.

A helper may not silently take ownership from another module.

## DOM and responsiveness safety

- First-party code must not create an unbounded render, mutation, polling, timer,
  or event-registration cycle.
- A `MutationObserver` on a first-party app surface is prohibited unless the
  exception is recorded in `RUNTIME_EXCEPTIONS.json`, the callback is bounded
  and idempotent, and a focused test proves it cannot trigger itself.
- A script loaded after `app.js` must be listed in `RUNTIME_EXCEPTIONS.json` with
  a narrow ownership reason.
- Event handlers may update state and call the owning render function. They may
  not repeatedly mutate an observed subtree.
- Address checkboxes, Select All, Clear, Delete, Edit, route Up/Down/Remove, and
  page navigation are protected controls.

## Diff control

- Inspect every changed file and function.
- Explain every changed block at Level 2 and Level 3.
- Remove unrelated changes.
- A display-only request may not alter optimization, storage, imports, exports,
  or selection behavior.
- A Garmin-label request may not change the Address page or Build Route controls.

## Verification matrix

### Every pull request

- complete `npm test` suite;
- JavaScript syntax checks;
- contract-gate checks;
- diff inspection.

### Level 1 runtime change

- quick check of only the affected surface.

### Level 2 change

- focused regression test;
- affected workflow smoke test from `REGRESSION_CHECKLIST.md`.

### Level 3 change

- focused and full regression coverage;
- all affected workflow and data-preservation checks;
- safe-environment validation when available;
- explicit pre-merge approval;
- post-publication live verification.

A failure at a required step stops deployment for that change. It does not stop
unrelated future work after the branch is repaired or abandoned.

## Deployment and rollback

- Commit and push the branch before review.
- Use a pull request into `main`.
- Merge only after the checks required by the selected level pass.
- After merge, verify the published GitHub Pages version when runtime behavior
  changed.
- If live verification fails, restore the recorded working commit before adding
  more changes to the broken surface.
- A direct-to-`main` emergency action may only restore a known-good version.

## Maintenance rule

A documented imperfection may remain when the risk of changing it is greater
than its current impact. Working behavior is not changed merely because a
cleaner implementation exists.
