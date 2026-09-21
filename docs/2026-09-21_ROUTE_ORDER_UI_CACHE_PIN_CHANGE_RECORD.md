# Route-Order UI Cache-Pin Change Record

**Date:** 2026-09-21  
**Change class:** Level 2 — narrow publication/runtime-cache fix  
**Branch:** `fix/route-order-ui-cache-pin-20260921`  
**Rollback base:** `072f0c83135c907a4590623711c43350cdddb0e0`

## Problem and evidence

The approved one-step routed-gig runtime is owned by `route-order-ui.js`, but
`index.html` still referenced that file as `route-order-ui.js?v=1.0.0` after
PR #103 merged. Browsers may therefore reuse the older cached script even though
GitHub Pages has the new main-branch file.

## Approved behavior

Load the already-approved PR #103 runtime through a new deterministic query
version. This changes no route, gig, Drive, workbook, optimizer, storage, schema,
permission, or user data behavior.

## Owning files

- `index.html` — cache-busted script URL only.
- `tests/route-order-ui-cache-pin.test.js` — protects the route-order UI pin and
  the existing app.js route-selection pin.

## Protected behavior

- `app.js?v=3.34.0` remains unchanged.
- no runtime module content changes;
- no route selection or optimization changes;
- no new Drive writes or permissions;
- no storage/data migration.

## Verification

Run the complete regression suite and JavaScript syntax gate in CI. After merge,
verify the published GitHub Pages app before the live one-step gig smoke test.

## Rollback

Restore `index.html` to `072f0c83135c907a4590623711c43350cdddb0e0` if the published loader fails.
