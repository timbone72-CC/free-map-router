# Change-Control Violation Report — 2026-08-02

## Purpose

This report records confirmed control failures during publication of Google road
optimization and the later workbook-inbox status changes. It preserves the
historical record without rewriting working application code or pretending that
missing pre-merge approvals happened.

## Scope and evidence

Reviewed evidence:

- `CONTRACT.md`
- `CHANGE_CONTROL_CONTRACT.md`
- `TESTING_CONTRACT.md`
- `INTEGRATION_CONTRACT.md`
- `AGENTS.md`
- Google optimization PR #16 and commits on `main`
- workbook-inbox PRs #17 and #18
- automated test results and completed live checks recorded during the work

The repository rules required these contracts to be discovered and followed
before runtime work. The operator did not separately instruct the agent to read
them; detecting and applying repository instructions was the agent's
responsibility.

## Confirmed violations

| Severity | Violation | Evidence and impact |
|---|---|---|
| High | The Level 3 Google routing change reached `main` without the required PR-based merge process. | PR #16 remained a draft and its record said not to merge without explicit approval. The feature branch was fast-forwarded into local `main` and pushed directly. This bypassed the required Level 3 merge gate. |
| High | Required explicit Level 3 pre-merge approval was not recorded. | Running commands supplied by the agent was not presented as the contract-required informed approval decision. Later live acceptance does not retroactively create pre-merge approval. |
| High | The Google impact record was stale when production was published. | It still described a credential-free first slice that was not merged or connected, while production included authentication, a private backend, billing exposure, browser integration, and live route replacement. |
| High | Experimental sign-in work was published directly to `main`. | Commit `3b0bb83` published an isolated sign-in test page even though `main` is not an experiment surface. |
| High | A user-facing label change was committed directly to `main`. | Commit `d47092a` changed the Google optimizer label without a branch, PR, or prior test update; `main` temporarily contained a stale assertion. |
| High | PR #17 changed inbox acceptance without the required cross-project compatibility record. | A valid timestamp became mandatory for a nonempty inbox, changing field meaning and import acceptance. The integration contract required both repositories to be checked and compatibility recorded. |
| High | PR #17 was merged before automated review finished. | It merged at 12:57 PM Central; the later review posted the status-erasure defect at 1:00 PM. The claim that review was complete before merge was incorrect. |
| High | The recorded rollback rule was not followed after PR #17 failed live verification. | Instead of restoring the last working version before another change on the broken surface, work proceeded directly to PR #18. |
| Medium | The inbox-status feature was implemented before its exact scope was authorized. | A general request to continue was treated as approval for new timestamp rejection and handoff behavior. Publication was approved only after implementation. |
| Medium | PR #17 bundled unrelated wording and stale-label test cleanup with inbox work. | This exceeded the narrow owning-surface scope and made the change harder to review. |
| Medium | PR #18 did not simulate the actual delayed timer interaction in its focused test. | The check verified separate elements and source structure, not the delayed auto-save overwrite that caused the defect. The later live check did confirm the corrected display. |
| Medium | Account-switching advice was given before Drive ownership was established. | The workbook export and router connection used different Google accounts. Advising a switch could have moved the router folder, backup, and inbox activity to an unintended account. This was an unverified operational assumption, not a direct contract breach. |
| Medium | Completed export and connection steps were requested repeatedly. | Re-exporting replaces inbox contents and could overwrite a newer intended selection. No confirmed data loss occurred. |

## What was verified successfully

- The Google routing final pre-publication suite passed 117 of 117 tests.
- Live two-stop and five-stop Google road optimizations completed successfully.
- Every selected stop remained present exactly once.
- Home remained the start and finish.
- The Google Maps export preserved the optimized order.
- PR #17 passed 120 of 120 automated tests, although its coverage missed the
  delayed status overwrite.
- PR #18 passed 121 of 121 tests and the separated inbox status was later
  confirmed live.
- No evidence was found of deleted saved addresses, damaged workbook rows,
  exposed credentials, or lost route stops.

## Minimal corrective action

1. Keep the verified working optimizer and inbox behavior in place.
2. Correct the stale Google Level 3 impact record to describe the deployed
   system, validation, historical approval failure, and safe rollback approach.
3. Preserve this report as the permanent record of the violations.
4. Close obsolete planning PR #15 as superseded after the documentation
   correction is merged.
5. Do not add duplicate guardrails; the existing contracts already state the
   required controls.
6. Do not rewrite Git history or rebuild working features solely to reproduce a
   cleaner implementation path.

The maintenance rule in `CHANGE_CONTROL_CONTRACT.md` supports this decision:
working behavior is not changed merely because a cleaner implementation exists.

## Remaining operational limitation

The workbook inbox is stored in the Drive account used by the workbook export,
while the router reads the inbox in the Drive account selected during its Drive
connection. The intended permanent Drive owner has not been established in the
integration contract. Until that choice is made, account-switching instructions
must not be treated as a correction.

This limitation does not require a runtime change to complete this corrective
record.

## Change classification

Level 1, documentation only.

Files in this correction:

- `docs/2026-08-02_CHANGE_CONTROL_VIOLATION_REPORT.md`
- `docs/GOOGLE_ROAD_OPTIMIZATION_IMPACT_RECORD.md`

Protected behavior:

- saved addresses and pins;
- Home;
- free and Google route optimization;
- Google Maps output;
- Drive backup and inbox processing;
- workbook output and stored data.

Validation required:

- inspect the complete documentation diff;
- confirm no runtime, test, workflow, dependency, or build file changed;
- confirm statements match repository and PR history.

No runtime test, syntax check, or live smoke test is required for this
documentation-only correction under `TESTING_CONTRACT.md`.

No workbook/router integration impact.
