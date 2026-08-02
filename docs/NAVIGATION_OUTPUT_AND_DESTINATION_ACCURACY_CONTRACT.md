# Navigation Output and Destination Accuracy Contract

## Deferred status

Navigation work is deferred. The operator does not want further Garmin testing
at this point and wants Free Map Router optimization corrected first.

This document does not create a requirement for the current Google optimization
project. Garmin, BaseCamp, GPX destination testing, phone navigation, car
navigation, and navigation-provider selection are outside the current
implementation and acceptance gates.

Read `docs/CURRENT_OPTIMIZATION_ONLY_SCOPE.md` for the controlling active scope.

## Future use only

This document may be revisited after the app can reliably calculate and display a
complete road-aware order for representative 15-25, 40-50, and 60-70 stop
batches.

No navigation system should be treated as required merely because it exists in
the current app. A future navigation project will require separate approval,
its own impact record, focused tests, and real destination-coordinate
validation.

## Current rule

- Do not ask the operator to test Garmin.
- Do not make Garmin success a condition of Google optimization.
- Do not delay optimization work for GPX, BaseCamp, or navigation diagnosis.
- Preserve existing Garmin code unless a separate approved change is needed.
- Report Garmin defects separately from optimization defects.

This is documentation only. It changes no live behavior.
