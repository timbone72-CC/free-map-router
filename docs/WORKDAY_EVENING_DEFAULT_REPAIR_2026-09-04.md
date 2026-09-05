# Workday Evening Default Repair — 2026-09-04

Status: IMPLEMENTED — VERIFIED — AWAITING PUBLICATION

## Change level

Level 2 normal fix.

This changes only the unsaved Workday default shown when no valid route timing is stored. It does not change a storage schema, migration, Drive/API permission, workbook handoff, route algorithm, deployment configuration, or automatic write behavior.

## User-facing problem and evidence

After `Start New Route` cleared the prior Workday context, opening Build Route at about 9:22 PM produced an unsaved default with the current local departure time but the fixed 5:00 PM Home By. That combination is invalid because Home By is earlier than Departure. Google Optimize then stopped before calling Google with:

`Home by must be later than Departure on the route date.`

The existing Phase 2H-A test covered a 9:40 AM default only, so the late-day invalid-default case was not protected.

The route-history validator itself correctly accepts an explicit 1:00 PM departure with an 11:30 PM Home By on the same route date. The defect is the late-day default generation, not the validator or Google backend.

## Approved behavior

- Keep the current local route date and current local departure time when no Workday context has been saved.
- Keep the normal 5:00 PM Home By default when it is later than the current departure.
- If the current departure is already at or after 5:00 PM, use 11:59 PM as the same-day unsaved Home By fallback so the generated default remains valid for ordinary evening use.
- Keep Preferred field-work finish at the existing 3:00 PM default; it remains a soft preference and is not part of the hard Home By validation.
- Continue rejecting any saved Workday where Home By is not later than Departure.

This is the narrow operational interpretation of Route rules 34 and 36: the approved 5:00 PM normal default remains unchanged when valid, while the hard validity rule controls when that normal default would already be in the past.

## Owning files

- `workday-context.js` — owns unsaved Workday default generation and control binding.
- `tests/workday-evening-default.test.js` — focused regression coverage for the evening case and the exact 1 PM / 11:30 PM valid pair.

No change is required in `route-history.js`; its validation rule is already correct.

## Read and write surfaces

Reads:
- current local date/time and IANA timezone;
- existing route-history Workday context when present.

Writes:
- none from default generation itself;
- existing `writeDayContext` path only after the operator changes a Workday control and the complete draft validates.

## Protected behavior

- No route order or membership changes.
- No Google or Basic optimizer behavior changes.
- No workbook Order ID / `Source_ID`, `Gig_ID`, source, pay, address, pin, or Home changes.
- No backup schema or route-history schema/version changes.
- No Drive/API permission changes.
- No workbook/router integration impact.
- The fixed 5:00 PM normal Home By default remains for morning/afternoon use.
- Invalid saved timing still fails closed and cannot overwrite the prior valid context.

## Focused tests

1. At 9:22 PM America/Chicago with no saved Workday context, defaults are same-day `21:22` departure and `23:59` Home By and pass `validateDayContext`.
2. Explicit `13:00` Departure plus `23:30` Home By is accepted on the same route date.
3. Bound Workday controls preserve an explicit America/Chicago context and successfully save `13:00` / `23:30` without a route-time conflict.

No billed Google call is required.

## Primary risks

- Accidentally changing daytime defaults.
- Weakening the Home By > Departure validation.
- Persisting an unsaved default automatically.

The focused tests protect these boundaries. Existing repository tests continue to protect route identity, storage, backup, and optimization behavior.

## Rollback

Known-good base before this repair:

`2ee065dcd41169719ffdd3ec47d7107266e57332`

Rollback is to revert the repair PR or restore `workday-context.js` to that commit. No data migration or cleanup is required.

## Affected smoke check after publication

1. On a device after 5:00 PM with a new route and no saved Workday timing, open Build Route.
2. Confirm the Workday area no longer begins with an invalid Home By earlier than Departure.
3. Set Departure to 1:00 PM and Home By to 11:30 PM.
4. Confirm the Workday status reports saved timing without the Home By conflict.
5. Run Google Optimize once and confirm it proceeds past Workday validation.

## Verification status

- Focused regressions: PASS.
- Complete repository suite: PASS — 413/413 tests, 0 failures.
- Root first-party JavaScript syntax checks: PASS.
- Diff inspection: PASS — only this record, the focused regression file, and `workday-context.js` changed from the governed base.
- No billed Google call was used.
- Publication/live smoke check: pending.
