# Address Correction Identity — Level 3 Impact Record

## Status and approved scope

Implementation was authorized on 2026-08-11. Explicit pre-merge operator
approval is not yet recorded.

The approved fix keeps a workbook stop's identity and hidden metadata when its
visible address is corrected in Free Map Router. It also remembers the prior
full address so a later workbook export cannot recreate the old address as a
second stop. No workbook field, Google Drive permission, route algorithm,
page, control, or automatic write is added.

## Exact problem and evidence

The operator changed `RR1 BOX 3240, Elk City, OK 73644` to
`11202 N 2020 RD, Elk City, OK 73644`. The edit rebuilt the saved stop from
visible form fields and dropped its dedicated `DCFS` source. The prior address
was not retained as an alias. When the workbook later exported the unchanged
raw RR address, the app created and selected a second stop with the workbook
Order ID while leaving the corrected stop unchecked. The return therefore sent
the old address context, the Google Doc printed the RR address, and the
workbook applied that stop's number instead of the corrected stop's identity.

## Approved behavior

- Editing a saved address retains its stop ID, `GIS`/`DCFS` source, label,
  notes, strongest saved pin, place ID, selection, and route-slot membership.
- When the written address changes, the prior normalized full address is saved
  as a hidden alias of the same stop.
- A later workbook inbox address that exactly matches a saved alias resolves to
  the corrected stop and carries its exact Order IDs into the pending route.
- The original address is not recreated as a second saved stop.
- If an old duplicate already exists, editing the workbook-linked stop to the
  corrected address merges the duplicate into that same workbook-linked stop,
  preserves the strongest pin and source, and remaps every route snapshot and
  Order-ID mapping to the retained ID.
- The displayed and returned address is corrected. The workbook continues to
  match only exact `Source_ID`, writes only `Stop` and `Print Order`, and uses
  the corrected address only for the rebuilt Google Doc. Raw `Job_Log` address
  fields remain unchanged.

## Ownership, reads, and writes

| Surface | Access | Behavior |
| --- | --- | --- |
| `contract.js` saved stops | Read and replace app-owned browser storage | Normalize hidden address aliases and apply metadata-preserving edits. |
| `inbox.js` workbook import | Read inbox; replace app-owned saved stops | Resolve exact incoming addresses through saved aliases. |
| `route-history.js` route snapshots | Replace app-owned browser storage | Remap a merged duplicate ID without losing route order, status, source time, or Order IDs. |
| `app.js` Address edit | Read form and saved stop; invoke owning helpers | Preserve hidden metadata and route identity instead of rebuilding a visible-fields-only stop. |
| Workbook `Job_Log` | No new access | Existing receiver remains exact-`Source_ID` only. |

The stop storage schema adds one optional `addressAliases` array containing
normalized full-address strings. Existing version-2 stops and backups remain
valid and normalize with an empty array. The Geoapify key, Google identity,
workbook Order IDs, and Drive tokens are never stored in this field.

## Limits, compatibility, and stale behavior

Alias matching is exact after the app's existing whitespace/comma
normalization. It does not use fuzzy matching, partial addresses, city-only
matching, coordinates, labels, notes, clients, or inferred values. The current
address is excluded from its own alias list. Duplicate aliases are retained
once.

The inbox remains version 1 and the route-order return remains version 1. The
workbook requires no runtime change because it already matches returned jobs
only by exact `Source_ID`. Existing backups remain readable; new backups carry
the optional stop field because they already preserve normalized stop objects.

## Fixtures and verification

Focused fixtures cover:

- editing the RR stop to `11202 N 2020 RD` while retaining `DCFS`, the same ID,
  and the strongest manual pin;
- merging an already-created corrected duplicate and remapping route snapshots
  plus Order IDs to the retained workbook stop;
- importing a later raw RR workbook address through the saved alias without
  recreating it, while attaching the workbook Order ID to the corrected stop;
- storage and backup normalization of the optional alias list; and
- the unchanged exact-`Source_ID` workbook receiver contract.

Focused development tests are the affected address-contract, inbox,
route-history, source-handoff, route-order, and backup tests. The final gate is
one complete `npm test` run and root JavaScript syntax check on the exact final
runtime head.

The live smoke check edits the workbook-linked RR entry to the corrected
address once, resends the same workbook jobs, starts the pending route,
optimizes one route, returns it, and confirms one corrected app stop, preserved
DCFS/GIS source, correct workbook numbers, corrected Google Doc text, and
unchanged raw `Job_Log` address.

## Verification result

Focused address, inbox, route-history, backup, source-handoff, and route-order
coverage passed 53/53 on the final runtime tree. The complete repository suite
then passed 201/201, and every first-party root JavaScript file passed
`node --check`. No workbook runtime file changed; its already-deployed receiver
continues to match and number only by exact `Source_ID`.

## Risks and recovery

Primary risks are merging unrelated addresses, dropping a route snapshot's
Order IDs, weakening a manual pin, or changing raw workbook data. Exact alias
matching, retained stop IDs, explicit route-ID remapping, focused fixtures, and
the unchanged workbook receiver boundary control those risks.

Rollback point is app commit `71312bb` (`main` before this fix). Before merge,
abandon the branch. After publication, restore that commit through the normal
rollback path. The optional alias field is harmless to the older reader, and no
workbook cleanup or data migration is required.
