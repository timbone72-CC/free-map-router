# Garmin route selection fix — Level 2 change record

- Problem: Build Route now renders numbered/source-prefixed text, while the Garmin UI adapter still compares that visible text with the older detailed Address-line formatter. Every comparison fails and the exporter incorrectly reports an empty route.
- Evidence: `garmin-export-ui.js` reads `#routeList li span` text and compares it with `formatJobLine(stop)`, while `app.js` renders route lines through `formatRouteStopLine(job, i)`.
- Approved behavior: Garmin export reads selected route stops by the stable saved stop ID attached by the owning Build Route renderer. Visible numbering and source wording no longer affect route detection.
- Level: 2 normal interaction fix. No deletion, migration, schema, permission, routing algorithm, or deployment change.
- Owning files: `app.js` adds a `data-stop-id` marker to each rendered route stop; `garmin-export-ui.js` reads those IDs; `index.html` refreshes both changed scripts; focused tests protect the handoff.
- Read surfaces: rendered Build Route stop IDs and existing saved stops in browser storage.
- Write surfaces: none. GPX download behavior is unchanged after the selected stops are resolved.
- Protected behavior: exact Build Route order, route numbering, GIS/DCFS labels, Garmin names, Home start/finish, saved addresses, pins, optimization, Google Maps, workbook inbox, and all page controls.
- Primary risk: a stale rendered ID. Mitigation: unmatched IDs are ignored, current valid IDs preserve order, and the existing empty-route warning remains when no valid selected stop exists.
- Focused verification: one test proves reverse route order is read by saved ID; one proves visible wording is irrelevant and stale IDs are skipped.
- Baseline/expected suite: current main has 78 tests; expected final result is 80 passing tests plus JavaScript syntax checks.
- Rollback: restore main commit `c89ec443d579dd9b7d7c03bccd2386605f5644fa`.
- Smoke check: with visible jobs in Build Route, download Garmin GPX and confirm no false empty-route alert; confirm GPX order and names match Build Route.
- No workbook/router integration impact.
