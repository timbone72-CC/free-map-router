# Optional Home By Repair — 2026-09-05

Status: VERIFIED — AWAITING PUBLICATION / LIVE SMOKE

## Change level

Level 2 normal feature/fix.

This adds an operator-controlled way to run Google Optimize without the hard Home By deadline. It does not change route-history schema, backup schema, workbook handoff, Google Drive permissions, backend request schema, route membership, work identity, or the Google optimization algorithm.

## User-facing problem and evidence

The current one-day Workday controls require a valid Home By time. On a legitimate two-day field trip, the selected route can be geographically valid while being impossible to finish before a same-day Home By deadline. Google then correctly returns a Home By conflict and leaves the route unchanged.

The operator explicitly requested the ability to remove that restriction instead of falsifying a late Home By time.

## Approved behavior

- Keep the existing saved Home By time and its strict stored-day-context validation unchanged.
- The operator may clear the visible **Home by** field before Google Optimize.
- A blank visible Home By is a temporary request-level opt-out; it is not written into route-history and does not change the stored Workday schema.
- With Home By blank, Google Optimize sends the selected stops through the existing untimed backend request path, so no hard Home By deadline is applied.
- Exact selected stops, workbook Order IDs, manual Gig IDs, source metadata, and service-duration planning remain unchanged.
- The no-limit request does not save or display a Home-By-safe Google schedule because no Home By guarantee was requested.
- Entering a valid Home By time turns the hard deadline back on and resumes the existing timed schedule behavior.
- If the Home By mode changes while Google is calculating, stale-context protection stops the result instead of applying a route calculated under the wrong mode.

## Owning files

- `workday-context.js` — owns interpretation of the visible Home By control and keeps blank Home By as a transient no-limit choice without overwriting saved timing.
- `google-route-browser.js` — owns browser-side Google Optimize request preparation, stale-context comparison, schedule persistence, and result messaging.
- `tests/home-by-optional.test.js` — focused regression coverage.

No workbook/router integration impact.

## Read and write surfaces

Reads:
- existing route-history Workday context;
- the visible `routeHomeByTime` control at Google Optimize time;
- exact selected route work and existing service-duration planning.

Writes:
- existing route order only after Google returns a valid complete result;
- existing timed Google schedule only when Home By is enabled;
- no new storage key, schema field, Drive file, permission, or workbook field.

## Protected behavior

- Home remains the round-trip start and finish.
- Google Optimize preserves every selected physical stop exactly once.
- Multiple work items at one physical stop remain distinct work identities but one driving stop.
- Saved valid Home By context remains unchanged when the visible field is cleared.
- Existing timed Home By validation and Home By conflict handling remain unchanged when the field contains a time.
- Basic Route behavior is unchanged.
- Workbook inbox and route-order handoff are unchanged.
- No manual gig, address, pin, pay, source, Order ID, Gig ID, or prediction data is changed by toggling the deadline.

## Focused tests

1. Clearing Home By marks the Google deadline off while leaving the last valid saved Home By untouched.
2. Re-entering a valid Home By resumes normal saved timing.
3. No-limit Google preparation omits the hard timing object while preserving the exact route stop and service duration.
4. The backend request produced by no-limit preparation uses the existing untimed request contract.
5. Timed and no-limit preparations have different stale-check bases so changing the mode during calculation cannot silently apply the wrong result.

No billed Google call is required for focused automated coverage.

## Primary risks

- Accidentally weakening stored Workday validation.
- Applying an untimed result after the operator turned Home By back on during calculation.
- Attempting to persist a timed schedule when the no-limit response correctly has no schedule.
- Dropping service-duration data when the timing deadline is omitted.

The focused tests are designed around those boundaries.

## Rollback

Known-good base before this change:

`ef492eec30a3b2f97beef4084839019708220afb`

Rollback is to revert this repair PR or restore `workday-context.js` and `google-route-browser.js` to that commit. No data migration or cleanup is required.

## Affected smoke check after publication

1. Open Build Route with the current route intact.
2. Confirm the saved Home By time still appears normally.
3. Clear the **Home by** field.
4. Confirm the Workday status says the Home By limit is off for Google Optimize.
5. Run Google Optimize and confirm it proceeds without a Home By conflict.
6. Confirm all selected stops remain present and the route is marked Google Optimized.
7. Confirm the result message explicitly says `Home By limit off.`
8. Re-enter a valid Home By time and confirm the normal timed behavior is restored.

## Verification status

Verified on PR #85 at head `95be8da3d3f4dbe0c48ac20fe607c7f7e6ee0fd2` before this record-only update:

- Focused optional-Home-By regression: passed.
- Complete repository suite: **416 passed, 0 failed**.
- Root JavaScript syntax checks: passed.
- Diff inspection: passed; exactly the two runtime owners, focused test, and this record are changed.
- CI workflow `Verify Contract and App` run 33974538600: passed.
- Publication/live smoke check: pending.

This record-only verification update requires the normal exact-final-head CI check before merge.
