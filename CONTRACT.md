# Free Map Router Contract

These rules are required behavior. A change is incomplete when it violates a
rule or removes its regression test.

## Address identity

1. Address is the only required stop field.
2. A stop may be added without a company, client, job number, or label.
3. Company or client information must never affect address identity, duplicate
   detection, route order, saved-pin lookup, or optimization.
4. Optional labels and notes are display information only.

## Location memory

1. One physical address owns one remembered location record.
2. A location may store latitude, longitude, Google Place ID, and pin status.
3. A manually verified pin overrides an automatic geocode.
4. A later import must not replace a manual pin with a lower-confidence pin.

## Saved-data safety

1. Existing `fmr_v1_jobs` browser data must remain untouched as a recovery copy.
2. Version 1 records migrate into the version 2 address-first schema.
3. Migration de-duplicates by normalized physical address, never by company.
4. Invalid or partial coordinate pairs are not treated as verified locations.

## Route boundaries

1. The app plans for one driver and one vehicle.
2. The route begins and ends at the saved Elk City home location.
3. Stops have no appointment windows unless this contract is deliberately
   revised.
4. Optimization must eventually use road travel time, not straight-line
   distance.

## Cost boundary

1. Paid mapping calls must be server-side and protected from public access.
2. Google Cloud quotas and budget alerts must cap expected mapping expense at
   no more than $20 per month.
