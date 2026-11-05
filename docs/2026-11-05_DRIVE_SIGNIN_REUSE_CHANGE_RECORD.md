# Drive Sign-In Reuse on Samsung A16 — Level 2 Change Record
Date: 2026-11-05

## Operator report and evidence

On the Samsung A16, Free Map Router repeatedly shows Google's account
chooser when building a route, checking workbook work, and using manual
Drive backup/restore. The business Google account is selected each time.
The primary Samsung phone behaves better. The live code held the Drive
access token only in memory and requested `select_account` whenever
that memory was empty, including after a browser or PWA reload.

## Approved behavior and narrow scope

Keep Drive tokens in memory only. After an operator connects to Drive
and the app verifies access to its exact governed folder, save only a
non-secret "previously verified" browser-local hint. On later user-triggered
Drive actions after a reload, ask Google Identity Services to reuse its
existing grant without forcing the chooser. If Google rejects renewal,
clear the hint; the next explicit action opens the normal account chooser.
Share one pending token request among overlapping Drive actions.

This is not automatic Drive backup, unattended file access, or a change
to the separate Google Optimize ID-token sign-in.

## Owning files and read/write surfaces

- `google-drive.js`: owns Drive OAuth token caching, account chooser
  options, and the exact-folder check. Reads an optional localStorage
  hint and writes/clears that single non-secret hint after verified
  access, denial, or unauthorized-folder error. All access tokens remain
  memory-only.
- `tests/google-drive.test.js`: verifies first-time chooser, reload
  reuse, folder denial, parallel actions, and silent failure fallback.
- `index.html`: advances the existing Drive script's cache version.

No Drive scope, Google OAuth client, Google backend, workbook inbox,
folder ID, route data, backup contents, stored business schema,
provider quota, or browser app page is changed. No workbook/router
integration impact.

## Protected behavior, risks, and recovery

- Fresh sign-in must still let the operator choose the business account.
- A silently selected wrong account cannot bypass the existing exact
  Drive folder gate; failure clears the reuse hint and existing token.
- Google can decline silent grant reuse; the account picker remains
  available on a later user action.
- Browsers that block localStorage fall back to the existing chooser.
- No tokens or passwords are written to app/browser storage or backups.
- Google Route and Basic Route, saved addresses, routes, workbook handoff,
  manual gigs, and Drive files are untouched.
- Main branch baseline: `e1c9504260592e7da520e1cb2bf890a2a98e8ffa`.
  Rollback by reverting the PR or restoring this commit if affected
  Drive sign-in behavior regresses.

## Verification and affected smoke checks

Focused coverage: `node --test tests/google-drive.test.js`,
including three new browser-isolated authorization cases.
Final gate: one green `npm test` and root JavaScript syntax checks
on the exact final runtime head (GitHub CI is acceptable).

After publication, check on the Samsung A16:
1. Sign in with the business Google account and successfully check the
   governed Drive folder.
2. Without leaving the app, check workbook work, build/use a route,
   and run a manual Drive action without repeat account selection.
3. Reload, then use a Drive action again. The prior Google grant may
   be reused if Google permits it.
4. Verify a denied/expired sign-in still offers an account picker and
   existing addresses and both route slots remain intact.

No live deployment until review and required automated checks pass.
The physical-device behavior is unverified until the operator tests
the affected flow.
