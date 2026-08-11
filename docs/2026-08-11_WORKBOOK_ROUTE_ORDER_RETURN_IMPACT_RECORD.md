# Workbook Route Order Return — Level 3 Impact Record

## Status and approved scope

Implementation was authorized on 2026-08-11. Explicit Level 3 pre-merge
operator approval is not yet recorded.

The approved app change preserves real workbook Order IDs through pending,
Google, and Basic route snapshots and adds **Send Route Order to Workbook**.
The button sends whichever route is currently displayed. It does not receive
or apply workbook route numbers, rebuild Daily Print, or change workbook data.

## Problem and evidence

The app previously received only a de-duplicated physical address and optional
GIS/DCFS source. It could optimize the route, but it could not return a stop
number to the exact workbook job. Address matching is unsafe because multiple
jobs may share one address and corrected app address text may differ from the
raw workbook address.

The companion workbook handoff supplies optional `addresses[].orderIds` from
exact `Job_Log.Source_ID` values. The app must keep those IDs with the route
snapshot that owns them so a newer pending workbook route cannot replace the
IDs belonging to an older displayed Google or Basic route.

## Approved behavior and ownership

- `inbox.js` reads optional `orderIds`, de-duplicates them, and maps them to the
  saved stop created for each physical address.
- `route-history.js` owns snapshot-local `orderIdsByStopId`, migrates route
  history from version 2 to version 3, and preserves the mapping through
  staging, Start New Route, reordering, optimization, reload, and backup.
- `route-order.js` builds the version-1 return from visible stop positions,
  corrected app addresses, the selected route slot, optimization status, the
  source inbox time, and exact workbook Order IDs.
- `app.js` owns the manual button, selected Google/Basic route state, one-send
  lock, status messages, and Google Drive consent request.
- `google-drive.js` creates or replaces exactly one app-owned
  **Free Map Router Route Order.json** in the existing app folder. It refuses
  duplicate exact-name files.
- `index.html` owns the button, status surface, script load, and cache versions.
- Backup and restore preserve snapshot-local Order IDs through the existing
  route-history payload. Order IDs never become permanent address identity.

## Data, schema, permissions, and limits

Required to send a workbook stop are a displayed route position, nonblank app
address, valid source inbox time, and at least one exact workbook Order ID.
Route slot is `google` or `basic`; optimization status is one of the four
existing approved values. App-only stops are optional and are omitted from the
return while their visible positions remain as numbering gaps.

The local route-history payload advances from version 2 to version 3 by adding
optional `orderIdsByStopId` inside pending, Google, and Basic snapshots. Older
valid histories normalize safely with empty mappings. The return uses
`routeOrderVersion: 1`; no address, Home, pin, note, or setting schema changes.

Google permission remains the existing limited `drive.file` scope. No trigger,
background write, automatic write, broader Drive access, paid API, or new
service is introduced. The hard bounds are the displayed route length, its
snapshot-local ID lists, one exact app folder, and one exact return filename.

A route with no workbook IDs is refused. One Order ID attached to more than
one physical stop is refused before Drive access. A duplicate exact return
file is refused instead of choosing one. A valid existing return is replaced
only after the operator taps the button and approves the existing Drive
connection. A failed or cancelled write leaves route state unchanged.

## Fixture and verification

Realistic fixtures cover two workbook jobs at one corrected physical address,
an app-only stop that creates a visible numbering gap, distinct pending,
Google, and Basic ID sets, a newer pending inbox that must not rewrite either
usable route, route reordering, backup and restore, older history migration,
duplicate returned IDs, no-ID routes, duplicate Drive files, and manual-only
Drive writing.

Focused coverage passed 51/51 across handoff, route history, backup/restore,
Drive write, and button behavior. The complete branch suite passed 194/194,
all root JavaScript files passed `node --check`, and `git diff --check` passed
on runtime commit `520f723`. The parent `main` commit `a1daf20` contains 185
tests; the feature adds nine tests for an expected total of 194.

Affected live checks after publication:

1. Load one workbook route containing shared-address jobs and one corrected
   address, then confirm Start New Route creates both route slots.
2. Optimize Google and Basic differently, send each displayed route, and
   confirm the matching selected slot and visible numbers are written.
3. Confirm an app-only stop creates a numbering gap and does not receive an
   invented workbook ID.
4. Confirm ordinary edits, route optimization, reload, and backup do not write
   the return file automatically.

## Protected behavior, compatibility, and recovery

Protected behavior includes address-based physical-stop identity, corrected
address display, saved pins, Home, the Google and Basic route orders and
optimizer labels, pending-route isolation, Start New Route confirmation,
manual Drive backup, read-only backend inbox checks, Google Maps, navigation,
Garmin, the five-page menu, and all existing Drive permissions.

The workbook-first `orderIds` field is optional, so the current app ignores it
safely. The app may then publish before the workbook receiver because creating
the return file alone changes no workbook data. The workbook receiver publishes
last and validates the current source export before clearing route numbers.

Primary risks are leaking IDs between route snapshots, matching by address,
inventing IDs for app-only stops, automatic Drive writes, or overwriting an
ambiguous duplicate return file. The controls are snapshot-local mappings,
exact IDs only, manual invocation, complete return construction before Drive
access, and duplicate-file refusal.

Rollback point is app commit `a1daf20`. Before merge, abandon the feature
branch. After publication, restore `a1daf20`; the optional workbook `orderIds`
remain backward-compatible and any existing return file is inert until the
workbook receiver is explicitly run.
