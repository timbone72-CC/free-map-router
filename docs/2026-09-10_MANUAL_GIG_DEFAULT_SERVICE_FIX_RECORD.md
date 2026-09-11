# Manual Gig Default Service Duration Fix Record

**Date:** 2026-09-10  
**Change class:** Level 2 — narrow route-planning behavior fix  
**Repository:** `timbone72-CC/free-map-router`  
**Branch:** `fix/manual-gig-default-service-20260910`  
**Rollback commit:** `f614791acdda8c971b3bb32ec20b8dcfa8e05e20`

## Problem

The Build Route planning editor shows `Use default` when Service Minutes is left blank, but manual gigs were resolved as `unknown` instead of receiving a default. A saved manual-gig planning record could therefore remain blank while Google Optimize stopped before the network request with a missing-service-duration error.

This made the visible `Use default` behavior false for manual work and forced the operator to enter service minutes repeatedly just to use Google Optimize.

## Approved behavior

The operator requested that the default actually work and persist as the fallback behavior.

For both ordinary InspectorADE work and manual gigs:

- blank Service Minutes means use the current five-minute default at resolution time;
- the default is not written into every planning record as a fabricated explicit override;
- an explicit valid Service Minutes override still wins;
- existing saved manual-gig planning records whose `serviceMinutes` is null immediately resolve through the default without migration or bulk rewrite;
- no address, Gig_ID, Order ID, route membership, pay, due date, assigned day, lock state, Drive file, workbook handoff, or Google account behavior changes.

The existing verified-only 20-minute InspectorADE interior rule is unchanged.

## Owning files

Runtime ownership:

- `work-item-planning.js` — exact work-item service-duration resolution.
- `work-item-planning-controls.js` — Build Route planning explanation/status text.

Focused test ownership:

- `tests/work-item-planning.test.js` — manual-gig blank/default resolution, including an already-saved blank planning record.

## Read and write surfaces

Reads:

- exact work-item planning records;
- route snapshot Order IDs and Gig_IDs through the existing projection path.

Writes:

- no new runtime storage writes are introduced by the default;
- no migration or bulk planning rewrite occurs;
- only the existing explicit Save Planning action writes planning data.

## Protected behavior

This fix must preserve:

- exact planning identity by `kind + workItemId`;
- one physical driving stop for same-address work;
- explicit service-minute overrides;
- five-minute ordinary InspectorADE default;
- verified-only 20-minute InspectorADE interior default;
- planning revision/stale-write behavior;
- route order, route membership, optimizer labels, saved addresses, pins, sources, pay, due dates, workbook Order IDs, manual Gig_IDs, and pending workbook state;
- Google timed-route fail-closed behavior for genuinely invalid/incomplete route state unrelated to this now-defined manual default.

## Focused verification

Required focused coverage:

1. ordinary workbook work still resolves to five minutes without storing the default;
2. explicit work-item overrides still win;
3. an existing manual-gig planning record with `serviceMinutes: null` resolves to five minutes;
4. the resulting manual-gig stop/route projection is complete and carries the resolved service duration;
5. no identity, assigned-day, lock-state, or revision behavior changes.

Final gate remains the repository contract requirement: focused tests, one complete suite, root JavaScript syntax checks, diff inspection, and affected Build Route / Google Optimize smoke check.

## Primary risks

- Google timed routing could receive a different service-duration total for manual gigs that previously blocked as unknown.
- A stale contract sentence or regression assertion could continue describing the retired unknown-duration behavior.

Mitigation: keep the change limited to the service-duration resolver and planning copy; update current governing expectations before merge; rely on the existing exact-identity route projection and Google request tests.

## Integration impact

**No workbook/router integration impact.** The Address Inbox schema, route-order return schema, workbook repository, Drive file names, permissions, and producer behavior are unchanged.

## Smoke check after publication

Use a route containing at least one manual gig with blank Service Minutes:

1. open Build Route and confirm the manual gig shows the five-minute default behavior rather than missing duration;
2. run Google Optimize without entering a manual service override;
3. confirm the request is no longer blocked by the manual gig's blank Service Minutes;
4. confirm an explicit manual service override still changes that work item's service time;
5. confirm route membership and exact Gig_ID remain unchanged.

## Rollback

If the published behavior fails the smoke check, restore runtime behavior from `f614791acdda8c971b3bb32ec20b8dcfa8e05e20` before making additional changes to this surface.
