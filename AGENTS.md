# Free Map Router Agent Guardrails

This repository publishes the live app from `main`. Every human or automated
agent must use these guardrails before changing application behavior.

## Mandatory contract read

Before changing runtime code, tests that define runtime behavior, deployment
configuration, or the app's data contract, read:

1. `CONTRACT.md`
2. `CHANGE_CONTROL_CONTRACT.md`
3. the relevant sections of `REGRESSION_CHECKLIST.md`
4. `TESTING_CONTRACT.md`
5. `INTEGRATION_CONTRACT.md` when the change may touch the workbook handoff

Documentation-only edits must still read the document they change and the
change-class rules below. No one may treat `main` as an experiment surface.

## Choose the smallest honest change class

### Level 1 — low risk

Examples: documentation, comments, test wording, noninteractive copy, and
appearance-only changes that cannot alter state, controls, stored data, route
order, imports, or exports.

Use a short change record and a branch. Documentation-only changes require diff
and contract review, not runtime tests. A Level 1 runtime change uses focused
coverage while developing and one final runtime verification before merge. Do
not require Level 3 paperwork for a Level 1 change.

### Level 2 — normal feature or fix

Examples: route labels, numbering, controls, Garmin names, import parsing,
Google Maps behavior, and normal page interactions.

Record the problem, scope, owning files, protected behavior, focused tests,
rollback point, and affected smoke check. Run focused tests during development,
then the complete automated suite once on the final runtime head before merge.

### Level 3 — high risk

Examples: storage schemas, migrations, deletion, automatic writes, Drive or API
permissions, route-algorithm replacement, deployment changes, and anything that
could broadly lose data or disable the app.

Use a detailed impact record, realistic fixtures or a safe test environment,
explicit rollback steps, focused development tests, one final complete automated
verification, and explicit pre-merge operator approval.

When uncertain between two levels, use the higher level. Do not classify a
change as high risk merely because it is important.

## Authorization without repeated permission loops

- The user's request and approval authorize the documented scope.
- Do not ask for the same approval again after implementation when the scope has
  not changed.
- Ask again only when scope expands, assumptions prove false, or Level 3
  pre-merge approval is required.
- Contract findings and adjacent defects are not automatic authorization.

## Connected-workflow check

The InspectorADE workbook is the upstream source for the app's Drive inbox.
Apply `INTEGRATION_CONTRACT.md` only when a proposed change can affect that
handoff. When the handoff is not affected, record `No workbook/router
integration impact.` and continue with the normal risk-matched process; do not
open the other repository or add cross-project tests merely as paperwork.

When the handoff is affected, satisfy the **Cross-System Reality Gate** in
`INTEGRATION_CONTRACT.md` before calling the change ready, mergeable, or
publishable. Trace the real operator action through the actual handoff state or
file to the receiving system, verify the target environment prerequisites, and
do not assume that a workbook named Sandbox means the shared Free Map Router
handoff resources are isolated.

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

`TESTING_CONTRACT.md` owns test selection, timing, reuse, and failure-stop
behavior.

- During development, run only the focused tests that cover the changed behavior.
- After fixing a focused failure, rerun that focused test before unrelated tests.
- For runtime changes, run the complete suite and syntax checks once on the final
  runtime head before merge; successful CI on that exact head satisfies this.
- Documentation-only changes do not require runtime tests or syntax checks.
- A test failure must stop any automated command sequence before commit, push,
  merge, publication, or deployment.

Final runtime commands are:

```bash
npm test
for file in *.js; do node --check "$file"; done
```

Inspect every changed block, remove unrelated changes, and identify the prior
working commit for runtime changes. Do not claim a published fix is complete
until its required live check passes.
