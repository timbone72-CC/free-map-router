# Route Numbering Change Record

## Classification

Level 2 — normal feature.

Implementation authorization was confirmed in the current conversation. The
approved scope may proceed without another approval unless it changes.

## Exact user-facing problem

The workbook Daily Print contains the full job notes and remains separate from
Free Map Router. After the app optimizes the pasted addresses, the operator
needs a stable numbered stop list so the same numbers can be written beside the
matching jobs on the printed workbook list.

## Reproducible evidence

The current Build Route page shows selected jobs in route order but does not
place a stop number before each job. The Garmin GPX already numbers stops, but
the visible Build Route list and Garmin naming must be governed and tested as
one approved behavior.

## Approved behavior

- Build Route displays every selected stop as `01`, `02`, `03`, and so on in
  the current route order.
- Home remains unnumbered at Start and Finish.
- The stop source is displayed only when saved label or notes contain `DCFS` or
  `GIS`.
- `MCS` is never inserted into the Build Route label or Garmin point name.
- When neither DCFS nor GIS is present, show only the number and address.
- Up, Down, Remove, and Optimize rerender the list once and automatically show
  the new correct numbering.
- The Address page keeps its existing full saved label, address, and notes.
- Saved stop data is not rewritten to create the display.

## Owning files and functions

- `app.js`
  - route-source display helper
  - route-stop display helper
  - `renderRouteList()`
- `garmin-gpx.js`
  - `routeSource()`
  - `routePointName()`
- `CONTRACT.md`
  - approved route-display behavior
- `tests/route-numbering.test.js`
  - focused formatting and GPX coverage

No post-app route decorator, MutationObserver, timer, polling loop, or repeated
event registration is authorized.

## Read and write surfaces

Read:

- current `routeIds` order;
- each selected stop's `address`, optional `label`, and optional `notes`;
- Home address for the existing Start and Finish rows.

Write:

- Build Route list DOM during the existing owned render;
- downloaded GPX text during the existing Garmin export.

Not written:

- browser stop storage;
- Home storage;
- Address page rows;
- workbook data;
- Google Drive files;
- route selection or optimized order beyond existing controls.

## Protected behavior

- Address checkboxes, Select All, Clear, Delete, and Edit remain responsive.
- Selected addresses appear exactly once.
- Up, Down, Remove, and Optimize preserve the existing route behavior.
- Home stays separate and unnumbered.
- Google Maps exports preserve the route order.
- Garmin export still blocks unresolved coordinates and includes every stop
  once in route order.
- No saved labels, notes, pins, or addresses are changed.

## Focused tests

- Two-digit numbering follows the supplied route index.
- DCFS is detected from label or notes.
- GIS is detected from label or notes.
- MCS alone produces no source label.
- A source-free stop renders as number plus address.
- Garmin point names match the same numbering and source rules.
- Home remains Start and Finish without a number.
- Production code contains no route-list MutationObserver or post-render rewrite.

## Primary risks

- A render loop or frozen Address page.
- Numbering that fails to update after Up, Down, Remove, or Optimize.
- MCS leaking into route or Garmin point names.
- Build Route and Garmin displaying different stop numbers.
- Accidentally changing saved data or Address-page details.

## Rollback

Known-good rollback commit: `f1561fbdaf0ebd14f7aba7dd5ec7831a9a79cce3`.

## Required checks

Automated:

- focused route-numbering tests;
- complete `npm test` suite;
- root JavaScript syntax checks;
- contract-gate checks;
- complete diff inspection.

Published-app smoke checks:

- core page smoke check;
- extended responsiveness check;
- Build Route checks;
- Garmin export checks.
