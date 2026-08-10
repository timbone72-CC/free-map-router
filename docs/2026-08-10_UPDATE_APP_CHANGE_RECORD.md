# Update App Change Record

## Classification

Level 2 — a normal Settings control and page interaction. It refreshes app
files but does not change route data, storage schemas, Drive permissions,
workbook files, deployment configuration, or publishing behavior.

## Problem and evidence

The phone can keep an older Free Map Router page or script after a new release,
leaving newly published behavior invisible. The user previously validated an
**Update App** recovery control in FieldLedger and requested the same narrow
control here.

## Approved behavior and scope

- Add **Update App** to Settings.
- Refuse the action while offline.
- Unregister only a service worker scoped to Free Map Router.
- Delete only Cache Storage entries named for Free Map Router.
- reload with a unique query value so the browser requests the newest page.
- Preserve localStorage, IndexedDB, cookies, downloaded backups, route data,
  addresses, Home, pins, and settings.

Owning files are `settings.js` for the update operation, `app.js` for the click
handler, and `index.html` for the Settings control.

Read surfaces are online state, same-origin service-worker registrations,
Cache Storage names, and the current URL. Write surfaces are only the matching
app cache/registration and the navigation URL.

## Protected behavior

All saved data, route selection, Current/Previous history, workbook inbox
handling, Drive permissions, Google optimization, Garmin export, and existing
Settings controls remain unchanged. No workbook/router integration impact.

## Tests, risks, and smoke check

Focused tests prove that only Free Map Router cache/registration entries are
removed, unrelated app caches are preserved, the reload URL is cache-busted,
and offline use is blocked. The final gate is the complete suite plus JavaScript
syntax checks.

Primary risks are deleting another app's cache or leaving the user without an
offline app shell. Prefix/scope filtering and the online guard prevent those
failures. After publication, open Settings, tap **Update App** while online,
confirm the page reloads, and confirm saved addresses and Current Route remain.

Rollback point: `771866d` (Merge PR #31: Refresh newer workbook route on
return).
