# Free Map Router Agent Guardrails

This repository publishes a live app from `main`. Every human or automated agent must follow this file before changing code, tests, configuration, or documentation.

## Mandatory read order

Before proposing or implementing any change, read all three documents in this order:

1. `CONTRACT.md`
2. `CHANGE_CONTROL_CONTRACT.md`
3. `REGRESSION_CHECKLIST.md`

No repository write is authorized until those documents have been read and a pre-change record has been written in the pull request or change record.

## Live-app protection

- Never make an intentional behavior change directly on `main`.
- Create a branch and a pull request. `main` is a deployment surface, not a workbench.
- A direct-to-`main` emergency change may only restore a previously working version. It may not add a feature, refactor, rename, or redesign.
- Do not load an experimental JavaScript file from `index.html`.
- Do not use a post-load script to rewrite another module's rendered UI. Change the owning render function instead.
- Do not attach a `MutationObserver` to a first-party app surface unless the contract explicitly approves it, the callback is proven idempotent and bounded, and a regression test proves it cannot trigger itself.
- Do not rewrite live DOM labels as a substitute for changing the underlying route-display model.

## Required pre-change record

Before implementation, state:

- the exact user-facing problem;
- reproducible evidence;
- the requested change;
- the files and functions expected to change;
- read and write surfaces;
- protected behavior;
- risks and failure modes;
- rollback commit;
- baseline full-suite result;
- expected tests to add or update;
- automated validation commands; and
- live smoke checks required after deployment.

Adjacent defects must be reported separately. A requested fix is not permission for cleanup, redesign, refactoring, renaming, relocation, or feature expansion.

## Required verification

Every behavior change must include focused regression coverage and pass the complete repository test suite. At minimum run:

```bash
npm test
for file in *.js; do node --check "$file"; done
```

Changes touching a user-facing page must also complete the matching live smoke checks in `REGRESSION_CHECKLIST.md` before merge.

## Diff and rollback control

- Inspect every changed file and function.
- Explain every changed block.
- Remove unrelated changes.
- Keep the prior working commit identified and recoverable.
- Do not report a targeted test as the full suite.
- Do not claim a live fix is complete before the operator verifies the affected screen.
