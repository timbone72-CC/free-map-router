# Google Missing-Coordinate Preparation Impact Record

Date: 2026-08-02

## Problem and evidence

Five workbook-imported jobs with blank latitude and longitude were stopped before
Google optimization. The browser duplicate-coordinate guard converted each
`null` value to zero, falsely reporting that all five jobs shared one saved pin.
The Address edit form showed blank latitude and longitude for an affected job.

## Approved behavior and scope

- Google Optimize prepares every selected job that is missing coordinates by
  using the app's existing Geoapify batch lookup.
- Blank coordinates are treated as missing, never as a saved `0,0` pin.
- The Google request starts only after every selected job has a valid coordinate
  pair.
- A lookup failure stops the Google request and identifies the failed address.
- Existing valid coordinates and manually corrected pins remain unchanged.

## Owning files and functions

- `app.js`: shared missing-coordinate preparation and the route bridge.
- `google-route-browser.js`: duplicate-coordinate validation and Google-button
  preparation sequence.
- `index.html`: cache versions for the two changed runtime files.
- `tests/google-route-browser.test.js`, `tests/google-route-ui.test.js`, and
  `tests/route-preparation.test.js`: focused regression coverage.

## Read and write surfaces

Reads the current selected route, saved Home coordinates, the browser-only
Geoapify key, and existing saved coordinates. Writes only successful geocoded
coordinate pairs with `pinStatus: "geocoded"` to already saved stops through the
existing storage writer. It does not change address text, labels, notes, source,
stop identity, or workbook data.

## Required and optional data

- Required: verified Home coordinates, at least one selected stop, and a valid
  coordinate pair for every stop before the Google request.
- Required only when a stop is missing coordinates: the existing Geoapify key.
- Optional and preserved: labels, notes, source, original-address aliases, and
  manual pins.

## Schema, permission, integration, and limits

No schema, API permission, Drive permission, inbox filename, JSON field, or
workbook change. No workbook/router integration impact. The existing Google
limit of 100 selected stops and existing sequential Geoapify lookup behavior are
unchanged.

## Protected behavior

- Address remains the only required stop field when saving or importing.
- Address text remains the visible route destination.
- Manual pins win over automatic lookup and are never re-geocoded.
- Every selected stop remains present exactly once.
- Home remains the unnumbered start and finish.
- Free Optimize Route continues using the same lookup and ordering behavior.
- Google receives only opaque stop IDs and coordinates.

## Risks and stale-output behavior

Primary risk: a free geocoder may return an imprecise location. The result is
stored only as `geocoded`, not `manual`, and remains eligible for manual
correction. Partial successful lookups remain recoverable if a later address
fails. No stale external result can replace the route because Google is not
called until preparation completes, and the existing validated-response gate
still controls route replacement.

## Focused tests and safe fixture

- Two blank-coordinate stops do not form a duplicate-coordinate group.
- The Google preparation step is awaited before the request snapshot is used.
- Both optimization controls use the shared missing-coordinate preparation.
- Existing duplicate real-coordinate rejection remains protected.

The realistic fixture is the reported five-stop route containing blank
coordinates. Tests use representative blank stops without calling paid Google
or external geocoding services.

## Baseline, final gate, and smoke check

Baseline: live `main` commit `4197179`; blank coordinates are misclassified as
duplicate `0,0` coordinates. Final local gate: 13 focused tests passed, the
complete suite passed 126/126, and every root JavaScript syntax check passed on
the final runtime content.

Post-publication smoke check:

1. Refresh the live app with the five imported jobs still selected.
2. Click Google Optimize once.
3. Confirm progress shows each missing address being located.
4. Confirm Google applies a five-job route or identifies only a genuinely
   unlocatable address.
5. Confirm no selected job disappears and existing manual pins remain intact.

## Recovery and rollback

If preparation or live verification fails, restore the prior working commit
`4197179`. Saved coordinates written before a later lookup failure remain valid
recoverable data; the previous route order remains unchanged until a complete
Google result passes validation.

## Approval status

Implementation requested in the user's address-repair workflow. Explicit Level
3 pre-merge publication approval: pending.
