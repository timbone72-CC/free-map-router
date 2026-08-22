# Manual Work Library Roadmap Change Record

**Date:** 2026-08-22  
**Change class:** Level 1 — documentation only  
**Status:** APPROVED PLANNING UPDATE / NO RUNTIME CHANGE

## Approved planning scope

Record a small Phase 1B between the existing manual-gig foundation and Phase 2:

- permanent Google Drive Manual Work Library for reusable manual/HNP properties;
- repeat-job templates tied to permanent properties;
- due dates and simple recurrence;
- automatic in-app Due Soon / Due Today / Overdue status;
- operator-only **Add to Route** action — due work is never auto-added;
- route removal remains separate from gig deletion and property deletion;
- normal property removal should prefer recoverable archive behavior over permanent deletion;
- permanent deletion must use an explicit warning and must not silently destroy the only durable copy;
- no Google Calendar, background push notification service, new Google permissions, workbook changes, or InspectorADE history changes in this phase.

## Protected behavior clarified

Existing InspectorADE/workbook address corrections remain governed by the current permanent address-corrections system. Once a correction is successfully saved to Google Drive, future workbook imports should reuse that correction instead of requiring the operator to correct the same incoming address again.

The new Manual Work Library is for manual/HNP reusable properties and must not replace or duplicate the existing InspectorADE correction store.

## Files expected to change

- `docs/FIELD_WORK_EXPANSION_PLAN.md`
- this change record

## Verification

Documentation diff only. No runtime, storage schema, Drive permission, route, workbook, or deployment behavior is changed by this PR.
