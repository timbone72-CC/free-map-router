# Route Backup And Email Impact Record

## Change level

Level 3. The action creates permanent Google Drive documents. It does not change the app's Drive permission and does not request Gmail API access.

## User-facing problem

The optimized Google Maps route has no permanent dated archive and must be recreated if the browser route is later changed or cleared. The operator also wants a copy sent to the company Gmail account and filed separately.

## Approved behavior

- Add one manual **Save Route Backup** button on Build Route.
- Each click creates a new dated Google Doc in **Free Map Router / Route Backups**. Earlier route backups are never replaced or deleted.
- The document contains Home, the numbered current route order, every Google Maps section, stop count, and the matching Garmin GPX filename.
- After the Drive document is created, open a ready-to-review Gmail compose message addressed to `InandOutInspections2026@gmail.com`.
- The email subject starts with `[Free Map Router Backup]` so the company Gmail can use one filter and label for its backup folder.
- The email body contains the Drive document link and every Google Maps section link. Sending remains a manual operator action.
- Saved-backup links shown in the app are cleared when the current route changes, so an earlier backup is not presented as the current route.

## Owning files and functions

- `index.html`: button, result-link container, and first-party script loading.
- `app.js`: reads current Home and route order, coordinates the manual action, and owns the Build Route result links.
- `route-backup.js`: dated names, approved route labels, Google Doc HTML, Gmail body, and Gmail compose URL.
- `google-drive.js`: creates or finds the app-owned `Route Backups` subfolder and creates one Google Doc per action.
- `tests/route-backup.test.js`, `tests/route-backup-ui.test.js`, and `tests/google-drive.test.js`: focused protection.

## Read surfaces

- Current saved Home record.
- Current selected route IDs and their saved stop records.
- Existing Google Maps section builder output.
- Existing Garmin filename rule.
- Existing short-lived Google Drive access token or a user-approved replacement token.

## Write surfaces

- One app-owned Drive subfolder named `Route Backups` under the existing `Free Map Router` folder, created only when missing.
- One new Google Doc per button click.
- Build Route status text and two temporary result links.
- One Gmail compose browser tab. The app does not send, read, label, archive, delete, or otherwise access email.

No localStorage, saved stop, Home, route order, workbook inbox, Geoapify key, Garmin file, or existing Drive backup file is changed by this action.

## Required and optional data

Required:

- saved Home address;
- at least one current route stop;
- valid Google Maps section URLs;
- user approval of the existing `drive.file` connection.

Optional:

- GIS or DCFS source label;
- Garmin filename text;
- an already active Drive token.

## Permission and schema impact

- Google Drive OAuth scope remains exactly `https://www.googleapis.com/auth/drive.file`.
- No Gmail OAuth scope, Gmail API endpoint, mailbox read, automatic send, or automatic label creation is added.
- No local or cloud backup schema changes.
- No workbook-router handoff change. **No workbook/router integration impact.**

## Hard limits and stale output

- The action is manual and creates exactly one document per successful click.
- It refuses a blank route, missing Home, or an invalid Google Maps route.
- It never overwrites or deletes an earlier route backup.
- The email body contains the Drive link and map links; the full numbered list remains in the Google Doc to keep the compose URL bounded.
- Temporary result links disappear whenever the current route is rendered again after a route change.

## Realistic fixture

A round trip from the saved Elk City Home with twelve mixed GIS/DCFS/unlabeled stops, split into two Google Maps sections. Verify the Google Doc preserves all twelve stops once in current order, includes both section links, omits MCS, and produces the matching dated Garmin filename.

## Baseline and expected verification

- Baseline complete suite: 80 tests on `main` commit `ec4e4ddafeeb8bc476de4eecb49cc20bb346631b`.
- Expected focused additions: seven tests.
- Expected final complete suite: 87 tests.
- Final commands: `npm test` and `for file in *.js; do node --check "$file"; done`.

## Primary risks and mitigations

- **Wrong route archived:** read the owning in-memory route order once and build maps, labels, document, and email from that same ordered list.
- **Old backups overwritten:** create a timestamped Google Doc and never search by filename for replacement.
- **Drive permission expansion:** retain the exact existing `drive.file` scope and test that no Gmail scope exists.
- **Popup blocked:** pre-open the compose tab from the operator click and also show explicit Open Gmail Message and Open Saved Backup links after success.
- **Stale backup presented as current:** clear the temporary result links on the next route render.
- **App freeze:** no observer, polling loop, interval, or post-render rewriting.

## Rollback and recovery

Rollback runtime to `main` commit `ec4e4ddafeeb8bc476de4eecb49cc20bb346631b`. Existing route-backup documents remain safe in Drive and require no migration. If a save fails before document creation, the previous app state and all older backups remain unchanged. If the document succeeds but Gmail does not open, the result links allow the operator to open the saved document and compose message manually.

## Required checks

- Focused route-backup, Drive-folder, Google-Doc-upload, and UI ownership tests.
- One complete suite and all root JavaScript syntax checks on the final branch head.
- Diff inspection.
- Explicit operator approval before merge.
- Live check: save one current route, confirm the dated Google Doc is inside `Free Map Router / Route Backups`, confirm all stops and map sections, confirm Gmail opens addressed to the company account, send it, and apply the company Gmail backup label/filter.
