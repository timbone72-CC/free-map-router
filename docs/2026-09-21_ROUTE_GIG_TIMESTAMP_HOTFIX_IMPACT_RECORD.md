# One-Step Gig Same-Send Timestamp Hotfix Impact Record

**Date:** 2026-09-21  
**Change class:** Level 3 — cross-application synchronization correctness  
**Branch:** `fix/one-step-handoff-millisecond-timestamp-20260921`  
**Rollback base:** `ac4a5693b17ac9e24931bc6629b83f101bfe65cb`  
**Pre-merge approval:** PENDING

## Live failure

During the operator-approved production smoke test, a new unsynced manual gig
was successfully included in the route, but **Send Route Order to Workbook**
stopped before Drive publication with:

> The manual gig handoff and route order could not be prepared from the same send time.

No explicit gig-sync workaround was used.

## Root cause

The one-step sender called `now()` once and passed the same JavaScript `Date`
object to both builders. The route-order builder preserves the Date object's
milliseconds. The gig-handoff builder converts a Date through
`Date.toString()`, which omits milliseconds, before converting it back to ISO.
For real clock times whose milliseconds are non-zero, the two valid artifacts
therefore received different top-level `updatedAt` strings. Existing automated
coverage used an exact `.000Z` fixture, so it could not expose the mismatch.

## Fix

Normalize the single send time to one ISO timestamp string inside
`route-order-ui.js` before either artifact is built, then pass that exact string
to both builders.

This preserves the approved same-send invariant without changing either schema,
Drive file, folder, OAuth permission, Gig_ID identity rule, route identity,
optimizer, workbook ownership rule, or background behavior.

## Publication

Because `route-order-ui.js` is a browser-loaded module, its query-string cache
pin is advanced from `v=1.1.0` to `v=1.2.0` so the fixed runtime is actually
loaded after publication.

## Verification

Focused coverage now uses a realistic non-zero millisecond timestamp
(`.279Z`) and requires the gig handoff and route order to preserve that exact
same timestamp. The complete regression suite and JavaScript syntax gate must
pass before merge.

## Rollback

Restore `main` to `ac4a5693b17ac9e24931bc6629b83f101bfe65cb` if post-publication verification fails.
No migration or data cleanup is required because the live failure occurred
before Drive publication.

## Remaining gate

This hotfix must remain unmerged until CI passes and the operator gives explicit
Level 3 pre-merge approval. After publication, repeat the same live smoke test
without either explicit gig-sync action.
