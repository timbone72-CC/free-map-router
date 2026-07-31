## Change level

Choose the smallest honest level:

- [ ] Level 1 — low risk
- [ ] Level 2 — normal feature or fix
- [ ] Level 3 — high risk

## Problem and approved scope

- User-facing problem:
- Evidence or reproduction:
- Approved result:
- Files/functions expected to change:
- Protected behavior:

For Level 1, a concise answer is enough.

## Ownership and effects

Required for Level 2 and Level 3:

- Owning module:
- Read surfaces:
- Write surfaces:
- Primary risks:
- Rollback commit:
- Focused tests:
- Affected smoke checklist section:

## Level 3 impact details

Complete only for Level 3:

- Stored-data, schema, permission, or deployment effects:
- Required and optional data:
- Hard limits:
- Stale-output behavior:
- Realistic fixture or safe environment:
- Recovery steps:
- Explicit pre-merge operator approval:

## Verification

- [ ] I read `CONTRACT.md`.
- [ ] I read `CHANGE_CONTROL_CONTRACT.md`.
- [ ] I read the relevant `REGRESSION_CHECKLIST.md` sections.
- [ ] The work is on a branch, not experimental work on `main`.
- [ ] The selected level matches the actual risk.
- [ ] Every changed block belongs to the approved scope.
- [ ] No unapproved runtime exception, observer, polling loop, timer, or
      post-render rewrite was added.
- [ ] Focused coverage was added when behavior changed.
- [ ] The complete automated CI suite passed.
- [ ] The required affected-surface smoke check was identified.
- [ ] The existing user approval covers this unchanged scope, or Level 3
      pre-merge approval is recorded above.

## Publication result

Complete after merge only when runtime behavior changed:

- Published commit:
- Live check result:
- Rollback used, if needed:
