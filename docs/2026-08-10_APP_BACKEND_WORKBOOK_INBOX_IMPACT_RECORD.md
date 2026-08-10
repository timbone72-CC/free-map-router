# App-to-Backend Workbook Inbox — Level 3 Impact Record

## Problem and evidence

The workbook inbox is owned by `timbone72@gmail.com`, while Google Optimize
uses the approved business Google identity. The private backend can now read the
exact shared inbox through its service account, but the browser app does not
call that reader. As a result, the business sign-in cannot yet receive workbook
routes.

## Approved behavior and scope

After the existing business Google sign-in succeeds, the browser requests
`GET /workbook-inbox` with the same memory-only identity token. The backend
returns the exact validated inbox, and `app.js` applies it through the existing
stale, same, older, Current Route, Previous Route, saved-address, and manual-pin
protections.

While that business sign-in remains active, returning to the visible app checks
the backend inbox again. The existing personal-account **Connect & Auto-Save**
flow remains available and unchanged as a fallback. This piece does not combine
or remove the two visible sign-ins and does not add lasting authentication.

Owning files:

- `google-route-browser.js`: authenticated backend inbox request and bounded
  return-to-app refresh;
- `app.js`: narrow bridge into the existing inbox application path;
- `index.html`: cache-version updates for changed runtime files; and
- focused browser/handoff tests.

The workbook runtime and inbox JSON contract remain unchanged, so no workbook
code change is required.

## Read and write surfaces

Reads:

- the existing memory-only business Google identity token;
- `GET /workbook-inbox` on the existing private backend; and
- the unchanged workbook inbox JSON fields.

Writes:

- existing browser saved-address storage and route-history storage only after
  the existing inbox validation and freshness rules accept the response.

The change does not write Google Drive, the workbook, Home, settings, pins,
backups, or backend data.

## Data, permissions, limits, and stale output

Required and optional inbox fields remain governed by `inbox.js`. No schema,
folder, filename, API permission, OAuth scope, or backend response change is
introduced. The token remains memory-only and is sent only in the Authorization
header to the existing backend.

The backend's existing 256 KiB response limit and exact-folder/file checks
remain authoritative. Empty, damaged, missing, duplicate, unauthorized, or
unavailable responses fail closed. Same and older exports preserve Current
Route. A stale export still requires the existing explicit confirmation during
sign-in and is not silently imported during a return-to-app refresh.

## Protected behavior and risks

- A newer accepted inbox moves the former Current Route to Previous Route.
- A same export preserves the optimized Current Route order.
- An older or rejected stale export preserves Current Route.
- Saved addresses and manual pins remain protected.
- The Drive connection, auto-save, backup, Google Optimize, Home, addresses,
  Garmin, Google Maps, and five-page UI remain unchanged.
- No timer, polling loop, observer, or repeated DOM rewrite is added.

Primary risks are bypassing the proven inbox rules, applying an unauthorized
response, registering duplicate return listeners, or clearing the business
token after a transient network failure. The narrow app-owned bridge, backend
status validation, one-time UI initialization, and focused fixtures address
those risks.

## Tests, safe validation, and rollback

Focused tests use fake fetch responses and an in-memory browser bridge. They do
not contact the live backend, Drive, or workbook:

```bash
node --test tests/google-route-browser.test.js tests/drive-autosave.test.js
```

The final gate is one complete `npm test` run plus root JavaScript syntax checks
on the final runtime head.

Safe live smoke check after explicit merge approval: sign in with
`InandOutInspections2026@gmail.com`, send a new route from the workbook, return
to the app, and confirm the new route becomes Current while the former Current
is available as Previous.

Rollback point: live `main` before this change, including PR #33. Before merge,
abandon the branch. After publication, revert this pull request. No migration or
stored-data recovery is required because the existing storage schema is
unchanged.

## Approval status

Implementation is authorized by the operator's **Next** instruction for the
previously defined app-to-backend reader integration. Explicit Level 3 approval
is still required after final diff and tests and before merge.
