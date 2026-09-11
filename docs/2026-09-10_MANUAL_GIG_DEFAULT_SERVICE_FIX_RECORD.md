# Manual Gig Default Service Duration Fix Record

**Date:** 2026-09-10  
**Change class:** Level 2 — narrow route-planning behavior fix  
**Repository:** `timbone72-CC/free-map-router`  
**Branch:** `fix/manual-gig-default-service-20260910`  
**Rollback commit:** `f614791acdda8c971b3bb32ec20b8dcfa8e05e20`

## Problem

The Build Route planning editor shows `Use default` when Service Minutes is left blank. The operator had selected a manual gig, left that field blank, and saved its planning, but the saved blank value continued to resolve as `unknown`. Google Optimize then stopped before the network request with a missing-service-duration error.

The defect is specifically the meaning of an **already-saved blank manual-gig planning record**. It does not require assigning a default to every manual gig automatically.

## Approved behavior

The operator requested that the visible `Use default` choice actually work after it is saved.

The narrow behavior is:

- an ordinary InspectorADE item keeps its existing five-minute default behavior;
- a manual gig with **no saved planning record** remains unknown, preserving the existing fail-closed baseline;
- when the operator explicitly saves planning for an exact manual `Gig_ID` while Service Minutes is blank, that saved blank choice resolves to the five-minute manual default;
- the planning record itself may continue storing `serviceMinutes: null`; the five-minute value is derived at use time rather than written as a fabricated explicit override;
- an explicit valid Service Minutes override still wins;
- existing saved manual-gig planning records whose `serviceMinutes` is null immediately gain the intended fallback behavior without migration or bulk rewrite;
- no address, Gig_ID, Order ID, route membership, pay, due date, assigned day, lock state, Drive file, workbook handoff, or Google account behavior changes.

The existing verified-only 20-minute InspectorADE interior rule is unchanged.

## Owning files

Runtime ownership:

- `work-item-planning.js` — exact work-item service-duration resolution.
- `work-item-planning-controls.js` — Build Route planning explanation/status text.

Focused test ownership:

- `tests/work-item-planning.test.js` — saved-blank manual-gig default resolution.

## Read and write surfaces

Reads:

- exact work-item planning records;
- route snapshot Order IDs and Gig_IDs through the existing projection path.

Writes:

- no new runtime storage writes are introduced by the default;
- no migration or bulk planning rewrite occurs;
- only the existing explicit **Save Planning** action writes planning data.

## Protected behavior

This fix preserves:

- exact planning identity by `kind + workItemId`;
- a manual gig with no saved planning selection remaining unknown;
- unknown/unplanned manual work still blocking timed Google Optimize rather than being silently treated as zero;
- one physical driving stop for same-address work;
- explicit service-minute overrides;
- five-minute ordinary InspectorADE default;
- verified-only 20-minute InspectorADE interior default;
- planning revision/stale-write behavior;
- route order, route membership, optimizer labels, saved addresses, pins, sources, pay, due dates, workbook Order IDs, manual Gig_IDs, and pending workbook state.

This record clarifies the existing contract distinction: “no exact duration” still means unknown when no planning choice has been saved. A saved planning record with blank Service Minutes is now an explicit operator selection of the manual default, not an unsupplied planning choice.

## Focused verification

Required focused coverage:

1. ordinary workbook work still resolves to five minutes without storing the default;
2. explicit work-item overrides still win;
3. a manual gig with no planning record still remains unknown;
4. an existing manual-gig planning record with `serviceMinutes: null` resolves to five minutes;
5. the resulting saved-blank manual-gig stop/route projection is complete and carries the resolved service duration;
6. no identity, assigned-day, lock-state, or revision behavior changes.

Final gate remains the repository contract requirement: focused tests, one complete suite, root JavaScript syntax checks, diff inspection, and affected Build Route / Google Optimize smoke check.

## Verification status

The first broader implementation made every unplanned manual gig default to five minutes. The repository regression suite correctly rejected that because it weakened the protected “unknown until planned” behavior.

The implementation was narrowed so only an existing saved blank planning choice receives the five-minute fallback. On exact branch head `d317cd9926957eab25a070a6a676810fc0dc0e7a`, GitHub Actions **Verify Contract and App** run 326 completed successfully, including the complete repository regression suite and the workflow's syntax gate.

## Primary risks

- incorrectly treating every manual gig as defaulted would hide genuinely unplanned service time;
- incorrectly leaving a saved blank record unknown would reproduce the operator's current Google Optimize failure.

Mitigation: the resolver distinguishes “no planning record” from “saved planning record with blank service minutes,” and the focused regression covers the saved-blank case while the existing Phase 2H-B regression continues protecting the unplanned-unknown case.

## Integration impact

**No workbook/router integration impact.** The Address Inbox schema, route-order return schema, workbook repository, Drive file names, permissions, and producer behavior are unchanged.

## Smoke check after publication

Use the existing route containing a manual gig whose planning was already saved with Service Minutes blank:

1. open Build Route and confirm that saved gig resolves through the five-minute default instead of showing missing duration;
2. run Google Optimize without entering a new manual service override;
3. confirm the request is no longer blocked by that saved blank Service Minutes choice;
4. confirm an explicit manual service override still changes that exact work item's service time;
5. confirm route membership and exact Gig_ID remain unchanged.

A brand-new manual gig with no planning saved should still report missing duration until the operator saves planning or enters an exact duration.

## Rollback

If the published behavior fails the smoke check, restore runtime behavior from `f614791acdda8c971b3bb32ec20b8dcfa8e05e20` before making additional changes to this surface.
