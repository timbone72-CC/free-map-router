# Google Route Deadline Fix — Level 2 Change Record

Date: 2026-08-31
Status: MERGED AND DEPLOYED / LIVE ROUTE SMOKE CHECK PENDING
Branch: `fix/google-route-deadline-20260831`
Merged PR: `#69`
Production merge commit: `c872de88e16bc9ba7dca15be259aed2840291fb6`
Baseline and rollback commit: `6c7095b13f9ad221f88044681443b062c584e8d6`

## Problem and evidence

A live Free Map Router Google Optimize attempt on a large route failed with:

`The request could not be processed within the current deadline. Please increase the API call deadline. (3124)`

The route was left `Google Route: Not Optimized`.

Repository evidence showed that every Google Route Optimization request used one fixed solver timeout of `30s`, regardless of route size, while retaining `CONSUME_ALL_AVAILABLE_TIME` and traffic-aware time optimization.

Google's current Route Optimization guidance recommends up to `60s` for 33–100 shipments when routes are very long or complex. The current fixed 30-second value therefore left large routes with less solving time than the recommended upper range.

## Approved scope

This is a Level 2 reliability fix to the existing Google Optimize behavior.

- Keep the existing `30s` solver timeout for routes with 32 or fewer selected stops.
- Use `60s` for routes with 33 or more selected stops.
- Keep `CONSUME_ALL_AVAILABLE_TIME` unchanged.
- Keep traffic-aware driving-time optimization unchanged.
- Keep one vehicle and Home as both start and finish.
- Keep complete-response validation: every selected stop must return exactly once.

The 33-stop boundary follows Google's published Route Optimization timeout table. This change supersedes only the earlier fixed 30-second setting for large routes; it does not supersede the approved time-efficient routing objective.

## Owning files

Runtime:

- `google-route-provider.js`
  - `buildGoogleOptimizeToursRequest()`
  - private stop-count timeout selection

Focused coverage:

- `tests/google-route-deadline.test.js`

Documentation:

- this change record

## Read and write surfaces

Reads:

- the already validated selected-stop count used to build the existing Google request.

Writes:

- only the request body's existing `timeout` field changes for routes with 33 or more selected stops.

No stored app data, route membership, saved address, pin, Home, manual gig, workbook inbox, Drive file, or credential is written by this change.

## Protected behavior

- No selected stop may be added, removed, duplicated, or replaced.
- Google Route remains separate from Basic Route.
- Home remains the unnumbered round-trip start and finish.
- The optimization objective remains estimated traffic-aware driving time.
- Manual pins and ordinary Google geocoding behavior remain unchanged.
- Route status changes only after a complete validated Google result is accepted.
- Existing failure messages remain visible if Google still rejects a request.
- The route's InspectorADE/manual-gig identity and pay data remain unchanged.

## Risks

Primary risk: increasing solve time for every route would make ordinary small routes unnecessarily slower because `CONSUME_ALL_AVAILABLE_TIME` can use the allotted time to search for a better solution.

Mitigation: preserve the established 30-second timeout through 32 stops and increase only the large-route range beginning at 33 stops.

A separate possible future escalation would be a longer REST deadline or non-blocking optimization if real routes still exceed the 60-second large-route budget. That is not part of this fix and must not be added without new evidence and scope review.

## Verification

Focused coverage proves:

1. a 32-stop route still uses `30s`;
2. a 33-stop route uses `60s`;
3. both retain `CONSUME_ALL_AVAILABLE_TIME`;
4. both retain traffic-aware routing; and
5. the large request still carries all 33 shipments.

PR #69 passed the complete repository regression suite and first-party JavaScript syntax checks before merge. The production Cloud Run deployment for merge commit `c872de88e16bc9ba7dca15be259aed2840291fb6` completed successfully.

Affected live smoke check after publication:

1. reopen/update Free Map Router;
2. keep the same large selected route;
3. run Google Optimize;
4. confirm the deadline error no longer appears;
5. confirm the route becomes Google Optimized and retains every selected stop exactly once.

Do not mark this change fully live-verified until that real route check passes.

## Historical audit after operator recurrence concern

The operator correctly remembered changing Google routing time-related behavior before. Repository history shows that the earlier incidents were different failure classes, not a prior 60-second solver setting that later reset.

### Earlier Google routing sequence

1. **PR #39 — time-efficient traffic-aware routing**
   - changed the Google objective back to estimated driving time;
   - enabled road-traffic estimates;
   - intentionally retained the existing `30s` solver timeout.

2. **PR #40 — traffic model time window**
   - fixed a live HTTP 400 after traffic-aware routing was enabled;
   - root cause: Google received no current model time window and defaulted the request timeline to 1970;
   - fix: add a current `globalStartTime` and a `globalEndTime` 24 hours later;
   - this did not increase the solver timeout.

3. **PR #41 — structured Google validation detail**
   - did not change the route request;
   - preserved Google's rejected field and explanation so the next live failure could be diagnosed precisely.

4. **PR #42 — whole-second traffic timestamps**
   - fixed the live error `model.global_end_time: nanos must be unset`;
   - root cause: serialized fractional seconds such as `.000Z` were interpreted as protobuf nanos;
   - fix: truncate the traffic window to whole seconds and omit the fractional component;
   - this also intentionally retained the `30s` solver timeout.

### Audit conclusion

- The prior `nanos must be unset` repair was merged and is still present in current `main`.
- Current `google-route-provider.js` still clears milliseconds and emits whole-second `globalStartTime` / `globalEndTime` values, so that repair did **not** reset.
- Repository history contains no earlier governed change that raised the Google solver budget to `60s` and was later lost.
- The recurring appearance was caused by two different Google time-related failures:
  - earlier: request-validation/timestamp problems;
  - current: solver deadline error `3124` on a large route.
- The new stop-count timeout regression test now protects `30s` for 32 or fewer stops and `60s` beginning at 33 stops.

## Recommendation for future Google Optimize failures

Treat Google time-related failures by exact class instead of calling all of them a timeout problem.

- Preserve the exact Google error code, rejected field, and message in the change record.
- Check whether the failure is request validation, timestamp formatting, authentication/network deadline, or solver deadline before changing runtime behavior.
- Keep both regression protections: whole-second traffic timestamps and stop-count-based solver timeout.
- If error `3124` occurs again on a route already receiving `60s`, do not automatically raise the solver timeout again. First verify whether the limiting deadline is the Google solver budget, the HTTP/Cloud Run request deadline, or another provider boundary.

This audit is documentation-only and changes no runtime behavior.

## Integration boundary

No workbook/router integration impact.

The workbook inbox schema, selectable-sync behavior, Source/Source_ID identity, route-order return, and Drive handoff are unchanged.
