# Google Route Validation Detail — Level 2 Change Record

## Problem and evidence

The traffic-aware Google Optimize release still fails live. The backend reduces
Google's structured validation response to only `status 400`, so the rejected
field and reason are unavailable and further request changes would be guesses.

## Scope

- Preserve the first structured Google field violation in the existing backend
  error returned to the app.
- Fall back to Google's short error message when no field violation exists.
- Normalize whitespace and cap provider detail at 500 characters.
- Keep the existing generic status message when Google returns no readable
  error body.

Owning files:

- `google-route-server.js`: reads and translates the provider response.
- `tests/google-route-server.test.js`: protects the translated validation
  detail and confirms the original address is not added to the message.

No workbook/router integration impact.

## Protected behavior

This change does not alter the provider request, traffic setting, route cost,
Home endpoints, selected stops, response validation, route order, saved data,
authentication, permissions, backups, navigation, workbook handoff, or
deployment configuration. Failed optimization still leaves the route intact.

## Verification and rollback

Focused test:

```bash
node --test tests/google-route-server.test.js
```

Final gate:

```bash
npm test
for file in *.js; do node --check "$file"; done
```

Rollback point: `cc7af6f2`.

Affected live check: run Google Optimize once. If Google still rejects the
request, the app must show the rejected field and reason while preserving Home
and every selected stop.
