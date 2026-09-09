# Phase 2I-D — Active-Plan Completion / Replacement Closure Change Record

Date: 2026-09-08  
Repository: `timbone72-CC/free-map-router`  
Branch: `feat/phase-2i-d-active-plan-completion`  
Governed base: `c68ef1ce826f964ded421b1f30d3abc214bd2897`  
Change class: **Level 3**

## Purpose

Close the final Phase 2I slice by making `Done & Navigate Next` record lightweight exact completion identity inside the active Route Plan, filter completed work from remaining-work planning, prevent completion resurrection while the active plan exists, and make active-plan replacement explicitly discard only temporary plan progress.

## User-facing problem

Before 2I-D, `Done & Navigate Next` removes the first physical stop only from the currently selected Google or Basic route. The alternate slot and multi-day assignment layer have no durable knowledge that the exact Order IDs / `Gig_ID`s at that property were completed, so later slot switching or plan reassignment can reintroduce work that was already finished.

## Approved behavior

- Completing the first active-Day stop records every exact workbook/manual identity represented at that physical stop.
- A route-only stop records only `stopId` and completion timestamp; no fake exact work identity is created.
- The completed physical stop is removed from both Google and Basic candidates for that Day and any Google schedule confidence is cleared.
- Exact completion identity remains only while the active Route Plan needs it and is not copied into a permanent detailed route-history archive.
- Completed work is excluded from local day assignment, Day-count suggestions, manual assignment controls, and ordinary candidate regeneration.
- Plan replacement remains explicit. Cancel changes nothing. Replace discards temporary completion progress and carries forward only work that was still remaining, so completed jobs do not silently resurrect.
- Starting a newer pending workbook route explicitly replaces the old active plan/completion progress after confirmation.

## Storage / schema impact

Route-history remains **version 7** and whole-app backup remains **version 5**.

Route Plan schema version 1 receives only backward-compatible optional Day fields:

- `completedWorkItems[]` with `{kind, workItemId, stopId, completedAt}`;
- `completedStandaloneStops[]` with `{stopId, completedAt}`.

The fields are omitted when empty. Older valid v1 Route Plans and backup v5 files therefore normalize without invented completion state. An older 2I-C runtime can still read the rest of the Route Plan; if it writes the plan after rollback it may discard this temporary completion progress, which is acceptable only as part of an intentional rollback.

No address, coordinates, pay, notes, work-order text, route geometry, permanent gig completion history, Drive file, or workbook history is duplicated into completion state.

## Owning files

Runtime:

- `route-plan.js` — completion normalization/integrity, exact completion action, remaining-work helpers;
- `route-history.js` — canonical completion persistence, valid-ID sanitation, stop-ID remap, exact-work removal compatibility;
- `route-plan-days.js` — filters completed work from local assignment and preserves completion on ordinary reassignment;
- `route-plan-controls.js` — explicit replacement warning;
- `app.js` — routes `Done & Navigate Next` through the active-plan completion owner and clarifies pending-route replacement.

Tests/governance:

- `tests/phase-2i-d-active-plan-completion.test.js`;
- this record;
- narrow protection additions to `CONTRACT.md` and `REGRESSION_CHECKLIST.md`.

No `backup.js`, Google optimizer/backend, Drive owner, OAuth scope, workbook handoff owner, CSS, or top-level page ownership change is required.

## Required and optional data

Required for exact-work completion:

- active Route Plan and active Day;
- current physical `stopId` in at least one active-Day route snapshot;
- exact work identity already represented by that Day route snapshot when work-backed;
- valid completion timestamp.

Optional:

- zero or more workbook Order IDs;
- zero or more manual `Gig_ID`s;
- standalone route-only stop identity when no exact work exists.

Missing pay, notes, due date, service time, coordinates, or workbook metadata never block the lightweight completion record because those facts are not completion-owned data.

## Integrity / hard limits

- one exact `kind + workItemId` completion at most once in the active plan;
- one standalone stop completion at most once in the active plan;
- a completed identity must belong to the Route Plan pool;
- a completed physical stop cannot simultaneously remain on a Day route;
- completion increments active Day and plan revisions;
- stale canonical writes fail closed through the existing route-history v7 revision gate;
- completion never changes pending workbook route state.

## Realistic validation fixtures

Focused coverage uses:

1. one physical stop containing two workbook Order IDs plus one manual `Gig_ID`;
2. different Google and Basic route orders;
3. a valid Google schedule that must become stale on completion;
4. a standalone route-only stop;
5. exact planning assignments used by local reassignment;
6. deliberate active-plan replacement;
7. route-history read/write plus backup v5 round trip;
8. stale revision rejection;
9. stop-ID remap;
10. removal of a completed manual gig;
11. static app/replacement wiring checks.

## Failure recovery / rollback

Pre-merge rollback: abandon the feature branch/PR. `main` remains at `c68ef1ce826f964ded421b1f30d3abc214bd2897`.

Post-merge rollback: restore that known-good 2I-C commit through the governed emergency rollback path. A rollback to 2I-C may discard temporary active-plan completion progress on the next route-history write; saved addresses, pins, gigs, planning records, pending workbook state, and backup v5 data remain governed by their existing owners.

## Verification gates

During development:

- `node --test tests/phase-2i-d-active-plan-completion.test.js`;
- syntax checks for changed first-party JavaScript.

Final exact PR head:

- complete `npm test` suite;
- all first-party root JavaScript syntax checks;
- diff inspection confirming only governed owners changed.

Post-publication:

- GitHub Pages must publish the exact merged commit;
- deployed-artifact smoke must prove exact completion identity, both-slot removal, no reassignment resurrection, replacement/cancel semantics, and backup preservation.

## Integration impact

**No workbook/router integration impact.** Phase 2J still owns later day-aware workbook return/print behavior.

## Approval status

Implementation is authorized by the operator's request to proceed with Phase 2I-D. Because this is Level 3, explicit operator approval of the exact green PR head is still required immediately before merge.
