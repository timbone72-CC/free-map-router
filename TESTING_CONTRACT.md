# Free Map Router Lean Testing Contract

## Purpose

This contract controls which tests run, when they run, and what happens after a failure. It keeps verification proportional to the change without weakening the final merge gate.

Where older project text uses broader wording such as “every pull request” or “complete suite,” this contract controls test frequency and failure handling.

## Development loop

- Documentation-only changes require diff and contract review only. They do not require runtime tests, JavaScript syntax checks, browser smoke tests, or live publication checks.
- For runtime changes, run the smallest focused test or tests that directly cover the changed behavior while developing.
- After correcting a focused-test failure, rerun that focused test first. Do not rerun unrelated tests after every small edit.
- Do not run the complete suite repeatedly during the edit-fix cycle unless the change is broad enough that no meaningful focused boundary exists.

## Final runtime gate

Before merging a runtime change:

1. all focused tests for the changed behavior must pass;
2. the complete repository suite and required syntax checks must pass once on the final runtime head; and
3. only the smoke checks for the affected surface and risk level must be completed.

A successful CI run on the exact final runtime head satisfies the final complete-suite requirement. Do not duplicate it locally without a specific reason.

A documentation-only commit after a successful runtime test does not invalidate that runtime result when no runtime, test, workflow, dependency, or build file changed.

## Failure gate

- A required test failure stops verification, merge, publication, and deployment for that change.
- Any script, workflow, or pasted command block that tests and then commits, pushes, merges, or deploys must use fail-fast behavior such as `set -euo pipefail` or `&&` chaining.
- No automated sequence may continue into commit, push, merge, publication, or deployment after a required test returns a nonzero status.
- A failing run may not be reported as passed or verified.
- Fix the failure, rerun the failed focused test, then run the final complete suite once when the branch is ready.

## Cross-project changes

For a workbook-router handoff change, run focused handoff coverage in each repository whose runtime changes. Run one final complete suite in each runtime-changed repository before merge. A repository receiving documentation only does not need runtime tests.

For a cross-system workflow, focused coverage must exercise the real state-building path through the changed handoff boundary. A helper test that injects the expected internal state directly into the final serializer, writer, parser, or consumer is useful unit coverage but is not sufficient by itself to prove the operator workflow.

The focused evidence must include the actual producer path that creates the handoff state or artifact and the receiving path that consumes it. `INTEGRATION_CONTRACT.md` owns the required Cross-System Reality Gate, including environment-prerequisite checks, actual handoff-artifact inspection, and ordered-rollout stops. This does not add repeated full-suite runs or unrelated smoke tests.

## Reporting

- Label focused runs as focused or targeted.
- Report full-suite counts only from an actual complete-suite run.
- Do not require unrelated tests, repeated full suites, or extra smoke checks merely as paperwork.

## Relationship to other contracts

- `CHANGE_CONTROL_CONTRACT.md` owns change classification, approval, and rollback.
- `REGRESSION_CHECKLIST.md` owns the behavior checks available for affected surfaces.
- `INTEGRATION_CONTRACT.md` owns when the workbook and app must be reviewed together.
- This contract owns test selection, timing, reuse of valid results, and failure-stop behavior.
