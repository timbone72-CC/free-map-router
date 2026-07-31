## Exact user-facing problem

Describe only the problem being changed.

## Reproducible evidence

State what was observed and how to reproduce it.

## Requested change

State the approved behavior. Do not include adjacent cleanup or redesign.

## Expected files and functions

List every file and function expected to change.

## Ownership and surfaces

- Read surfaces:
- Write surfaces:
- Protected behavior:
- Required and optional data:
- Hard limits:
- Stale-output behavior:

## Risk and rollback

- Primary risks:
- Failure modes:
- Rollback commit:

## Verification record

- Baseline full-suite result:
- Focused tests added or updated:
- Expected post-change test result:
- JavaScript syntax checks:
- Required live smoke checklist section:

## Contract checklist

- [ ] I read `CONTRACT.md`.
- [ ] I read `CHANGE_CONTROL_CONTRACT.md`.
- [ ] I read `REGRESSION_CHECKLIST.md`.
- [ ] This change is on a branch, not direct feature work on `main`.
- [ ] Every changed block belongs to the approved scope.
- [ ] No experimental script was added to `index.html`.
- [ ] No unapproved `MutationObserver`, polling loop, or post-render UI rewrite was added.
- [ ] Focused regression coverage was added or updated.
- [ ] The complete `npm test` suite passed.
- [ ] All first-party root JavaScript files passed `node --check`.
- [ ] The affected live page was smoke-tested after publication.
- [ ] The operator approved the intended behavior before merge.
