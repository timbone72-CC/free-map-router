# Balanced Guardrail Upgrade Change Record

## Change level

Level 2 — normal repository process upgrade. This changes development controls
and CI, but it does not change the published app's runtime code, stored data, or
user workflow.

## Exact problem and evidence

A route-label change was written directly to the live branch without first
following the app contract or running a browser regression check. A recursive
DOM observer then made the Address page unresponsive.

The repository already had a product contract and automated tests, but it did
not clearly require contract-first work, proportional risk classification,
module ownership, or an app-wide responsiveness check.

## Approved result

Adopt an app-wide, balanced change-control system:

- every runtime change starts by reading the relevant contracts;
- experimental behavior never goes directly to `main`;
- Level 1, Level 2, and Level 3 controls scale with actual risk;
- low-risk work remains quick;
- normal features receive focused tests and affected workflow checks;
- high-risk data, permissions, routing, and deployment changes receive stronger
  impact and rollback controls;
- the user's approval counts once unless scope changes;
- CI automatically carries the full test and syntax burden;
- runtime exceptions are explicit rather than hidden post-load patches.

## Expected changed files

- `AGENTS.md`
- `CHANGE_CONTROL_CONTRACT.md`
- `CONTRACT.md`
- `REGRESSION_CHECKLIST.md`
- `RUNTIME_EXCEPTIONS.json`
- `.github/pull_request_template.md`
- `.github/workflows/verify.yml`
- `tests/change-control-contract.test.js`
- this change record

## Read and write surfaces

Read: repository contracts, pull-request metadata, local source files during CI.

Write: documentation and CI verification results only.

No app runtime, browser storage, Google Drive data, route state, address state,
or export contents are written.

## Protected behavior

All five pages, saved addresses, manual pins, Home, address selection, route
ordering, optimization, Google Maps export, Garmin export, backup, restore, and
workbook inbox behavior remain unchanged.

## Risks and controls

Risk: excessive process could slow useful development.

Control: three explicit levels, short Level 1 records, no duplicate approval for
unchanged Level 1 or Level 2 scope, and automated CI instead of repeated manual
work.

Risk: weak classification could allow a dangerous change through a light path.

Control: uncertain changes use the higher level, and storage, permissions,
automatic writes, routing-algorithm replacement, and deployment changes are
explicitly Level 3.

## Verification

- Focused contract-gate tests validate the three levels and runtime exception
  declarations.
- The full `npm test` suite must pass in GitHub Actions.
- All first-party root JavaScript files must pass `node --check`.
- No live app smoke test is required because this change does not alter runtime
  files.

## Rollback

Rollback point: `71c7afcfcf82a54dcd5080e04ec0652b534a9b4f`.

The pull request can be reverted without affecting saved app data or requiring a
browser migration.
