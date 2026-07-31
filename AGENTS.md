# Free Map Router Agent Guardrails

This repository publishes the live app from `main`. Every human or automated
agent must use these guardrails before changing application behavior.

## Mandatory contract read

Before changing runtime code, tests that define runtime behavior, deployment
configuration, or the app's data contract, read:

1. `CONTRACT.md`
2. `CHANGE_CONTROL_CONTRACT.md`
3. the relevant sections of `REGRESSION_CHECKLIST.md`

Documentation-only edits must still read the document they change and the
change-class rules below. No one may treat `main` as an experiment surface.

## Choose the smallest honest change class

### Level 1 — low risk

Examples: documentation, comments, test wording, noninteractive copy, and
appearance-only changes that cannot alter state, controls, stored data, route
order, imports, or exports.

Use a short change record, a branch, automated CI, and a quick check of the
changed surface when runtime files are touched. Do not require Level 3 paperwork
for a Level 1 change.

### Level 2 — normal feature or fix

Examples: route labels, numbering, controls, Garmin names, import parsing,
Google Maps behavior, and normal page interactions.

Record the problem, scope, owning files, protected behavior, focused tests,
rollback point, and affected smoke check. Run the complete automated suite.

### Level 3 — high risk

Examples: storage schemas, migrations, deletion, automatic writes, Drive or API
permissions, route-algorithm replacement, deployment changes, and anything that
could broadly lose data or disable the app.

Use a detailed impact record, realistic fixtures or a safe test environment,
explicit rollback steps, complete automated verification, and explicit
pre-merge operator approval.

When uncertain between two levels, use the higher level. Do not classify a
change as high risk merely because it is important.

## Authorization without repeated permission loops

- The user's request and approval authorize the documented scope.
- Do not ask for the same approval again after implementation when the scope has
  not changed.
- Ask again only when scope expands, assumptions prove false, or Level 3
  pre-merge approval is required.
- Contract findings and adjacent defects are not automatic authorization.

## Live-app protection

- Never make an intentional behavior change directly on `main`.
- Create a branch and use a pull request. `main` is a deployment surface, not a
  workbench.
- A direct-to-`main` emergency action may only restore a previously working
  version. It may not add a feature, refactor, rename, or redesign.
- Do not load an experimental JavaScript file from `index.html`.
- Do not use a post-load script to rewrite another module's rendered UI. Change
  the owning render function instead.
- A first-party `MutationObserver`, polling loop, or timer that can rewrite an
  app surface requires a documented runtime exception and a bounded,
  idempotent regression test.

## Ownership and narrow scope

- Change the module that owns the behavior.
- State which surfaces are read and which are written.
- Preserve unrelated pages, controls, data, routes, and exports.
- Report adjacent defects separately.
- Do not turn a fix into cleanup, redesign, refactoring, renaming, relocation,
  or feature expansion without approval.

## Verification

CI runs the complete repository tests and JavaScript syntax checks for every
pull request. Add focused coverage for changed behavior and complete only the
smoke checks required by the selected risk level and affected surface.

At minimum, the automated commands are:

```bash
npm test
for file in *.js; do node --check "$file"; done
```

Inspect every changed block, remove unrelated changes, and identify the prior
working commit for runtime changes. Do not claim a published fix is complete
until its required live check passes.
