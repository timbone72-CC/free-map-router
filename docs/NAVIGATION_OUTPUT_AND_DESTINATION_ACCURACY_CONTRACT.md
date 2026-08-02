# Navigation Output and Destination Accuracy Contract

## Purpose

This contract separates route optimization from turn-by-turn navigation and
protects the operator from being sent to the wrong physical property.

It supplements the Google optimization roadmap and contracts. When an older
planning statement makes Garmin mandatory, this contract controls: Garmin is an
optional export, not a release requirement or the authoritative destination
system.

## Core separation

Free Map Router has two different responsibilities:

1. optimize the complete selected batch into one ordered route; and
2. hand each ordered destination to a navigation system accurately.

A navigation failure does not invalidate the need for full-batch optimization,
and full-batch optimization must not depend on Garmin.

## Authoritative destination

The authoritative destination for a stop is the app's approved saved pin:

- stable stop ID;
- corrected display address;
- latitude and longitude;
- pin status and provenance;
- original address aliases where retained.

Address text alone is not proof that the physical destination is correct.

The app must show enough information for the operator to verify that the pin and
property agree before field reliance.

## Full-batch optimization rule

Google must continue to optimize the entire selected batch together for one
vehicle. The app retains the complete ordered list.

Navigation may then operate in either of these modes without changing that
optimized order:

- complete-route export to a navigation system that safely supports it; or
- exact next-stop navigation, where the app opens one approved pin at a time in
  the stored optimized sequence.

Exact next-stop navigation is not one-job-at-a-time optimization. The complete
route has already been optimized; only the turn-by-turn handoff is performed one
destination at a time.

## Supported navigation outputs

The operating plan may support:

- Google Maps or compatible phone navigation;
- Android Auto or another car display using the phone's navigation;
- a car's built-in navigation when an exact pin can be transferred and verified;
- Garmin GPX as an optional tested export;
- printable ordered route and coordinates as a recovery reference.

No single navigation product is mandatory unless it passes real property tests.

## Garmin status

Garmin is currently untrusted for destination accuracy after three field events
where the displayed address was correct but navigation attempted to reach the
wrong place.

Until the cause is identified and corrected:

- Garmin must not be a completion requirement for Google optimization;
- Garmin export may remain available but must be labeled optional or unverified;
- Google optimization release criteria must use at least one navigation method
  that reaches approved pins accurately;
- no roadmap may claim success merely because GPX order matches the app;
- the app must preserve an alternative navigation path.

## Destination validation

For every representative test stop, compare:

1. saved app address;
2. saved app latitude and longitude;
3. visible app map pin;
4. exported navigation coordinates;
5. destination shown by the chosen navigation system;
6. actual physical property entrance or approved arrival point.

A matching address label with a mismatched point is a failure.

## Wrong-destination incident review

For each reported wrong destination, record when available:

- stop ID and source;
- original and corrected address;
- saved app coordinates and pin status;
- GPX coordinates;
- BaseCamp point before and after recalculation;
- Garmin destination coordinates or map position;
- where the property actually is;
- which layer first diverged.

Do not change geocoding, GPX generation, BaseCamp handling, or Garmin settings
until evidence identifies the failing layer.

## Navigation release requirement

The first Google optimization release is complete when:

- the entire selected batch is optimized together;
- every job appears exactly once;
- Home is preserved;
- the visible ordered route is retained;
- at least one supported navigation method opens the exact approved destination
  pin reliably;
- the operator can move to the next stop without losing the optimized sequence;
- Garmin is not required.

## Failure behavior

When a destination pin is missing, uncertain, or conflicts with the displayed
address:

- the app must warn the operator before navigation;
- it must not silently substitute a provider-selected address point;
- the current route order remains intact;
- manual pin review remains available;
- no navigation export may weaken a manual pin.

## Protected data

Navigation output may read the current stop order, address text, and approved
coordinates. It may not rewrite:

- saved addresses or aliases;
- manual pins;
- notes or source labels;
- workbook data;
- cloud address memory;
- route order without an explicit operator action.

## Testing requirement

Use real representative locations, including known rural, interpolated,
new-development, ambiguous, and manually pinned addresses. A navigation method
must be judged by physical arrival accuracy, not merely file acceptance or
matching labels.

## Change classification

This planning document is Level 1. Runtime changes to navigation handoff,
coordinate selection, GPX generation, or provider integration are Level 2 or
Level 3 under the normal change-control contract, with Level 3 used for
migrations, automatic writes, permissions, or broad destination changes.
