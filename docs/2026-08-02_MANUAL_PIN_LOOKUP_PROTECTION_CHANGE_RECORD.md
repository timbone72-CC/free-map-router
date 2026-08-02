# Manual Pin Lookup Protection Change Record

## Level

Level 2 — normal Address-page interaction fix.

## Problem and evidence

While editing a saved address with a manually corrected pin, **Find Location
(Free)** always replaced the form coordinates with the automatic lookup result.
The saved record remained unchanged only until **Save Address** was pressed, so
one accidental save could weaken a verified property pin.

## Approved behavior

- A complete, geographically valid manual pin in the current Address form
  cannot be replaced by **Find Location (Free)**.
- The app explains that the pin can be changed by moving it on the map.
- Changing the address resets the form to unverified and permits a new lookup.

## Scope and ownership

- `app.js` owns the Address form state and lookup interaction.
- `tests/manual-pin-ui.test.js` protects the lookup guard.
- `index.html` advances only the `app.js` cache version.
- This record documents the change.

Read surface: current Address form text, coordinates, and pin status.

Write surface: Address-page status text and map preview only when lookup is
blocked. No saved data is written by the guard.

## Protected behavior

- Existing saved addresses, coordinates, labels, notes, and route selection
  remain unchanged.
- Manual pins remain editable by clicking or dragging the map pin and saving.
- A changed address can still receive a new free lookup.
- No route, optimization, Google Maps, Garmin, Drive, import, or permission
  behavior changes.
- No workbook/router integration impact.

## Risk and checks

Primary risk: blocking a legitimate lookup after the address text changes. The
existing address-input handler resets the pin status to `unverified`, so a new
address remains eligible for lookup.

Out-of-range numeric coordinates remain eligible for lookup and are never
treated as a protected manual pin.

Focused test: `node --test tests/manual-pin-ui.test.js`.

Final gate: complete `npm test` suite and root JavaScript syntax checks on the
final runtime head.

Affected smoke check:

1. Edit a saved address with a manual pin.
2. Press **Find Location (Free)** and confirm its coordinates do not change.
3. Move the map pin and save; confirm the corrected coordinates persist.
4. Change the address text and confirm a fresh lookup is allowed.

## Rollback

Known working pre-change commit: `fbdd6c57f371dba363ffbb4eb3c089250f9039fc`.
Revert this pull request to restore the prior lookup behavior.
