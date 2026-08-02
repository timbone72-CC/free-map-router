# Current Optimization-Only Scope

## Operator direction

The current implementation project has one purpose: make Free Map Router produce
a correct road-aware stop order for the complete selected batch.

Garmin testing is not part of this project. The operator has explicitly declined
further Garmin testing at this time after repeated wrong-destination behavior.
Garmin, BaseCamp, GPX destination accuracy, phone navigation, car navigation,
cloud address-memory migration, standalone file import, Excel support, Obsidian,
and reporting conveniences must not delay or become acceptance gates for the
optimization work.

This document controls the current implementation scope where older planning
text still mentions Garmin or another later project as a required completion
condition.

## In scope

- Add an explicit Google road-aware optimization action.
- Optimize one complete selected batch for one vehicle.
- Use Home as the route start and finish.
- Use the stops already available in the current app.
- Preserve stable stop identity.
- Require every selected stop to appear exactly once.
- Reject missing, duplicated, skipped, unknown, or extra stops.
- Leave the current route unchanged after timeout, authentication failure, quota
  failure, provider failure, or invalid response.
- Display the complete optimized order clearly inside Free Map Router.
- Show which optimizer produced the current order.
- Preserve manual Up, Down, Remove, Clear Route, and the existing free optimizer.
- Measure road-aware route quality using provider distance/time metrics and
  representative route comparisons.
- Keep credentials out of the public app through a private authenticated
  backend.

## Out of scope for this implementation

- Garmin GPX validation or field testing.
- BaseCamp import or recalculation testing.
- Choosing or testing a turn-by-turn navigation provider.
- Fixing Garmin destination placement.
- Requiring any navigation export before optimization may be considered usable.
- Cloud address-memory migration.
- Standalone CSV, XLSX, or XLS import.
- Obsidian integration.
- Workbook runtime changes.
- Multiple vehicles, appointment windows, multi-day planning, or automatic route
  splitting.

These items may remain future projects, but they are not prerequisites for the
first correct optimization release.

## Optimization acceptance criteria

The first implementation is acceptable only when:

1. The app sends the full selected batch together for one vehicle.
2. Home is the start and finish.
3. Every selected stop returns exactly once.
4. No skipped or partial result is accepted.
5. The app visibly displays the complete returned order.
6. The route survives provider and authentication failures without losing the
   prior order or saved addresses.
7. The existing free optimizer remains available.
8. Representative 15-25, 40-50, and 60-70 stop GIS/DCFS batches complete
   successfully.
9. Road distance, estimated drive time, and obvious backtracking are compared
   against the current straight-line optimizer.
10. The operator confirms the app-generated order is materially more practical.

No Garmin, BaseCamp, GPX, phone, or vehicle-navigation test is required to pass
this optimization milestone.

## Change control

Runtime implementation remains Level 3 because it adds a billed routing API, a
private backend, authentication, and a new route-ordering method. It requires a
separate implementation branch, focused tests, one final complete suite,
rollback instructions, and explicit operator approval before merge.

This document is planning only. It changes no live code, billing, permissions,
routes, workbook data, or saved addresses.
