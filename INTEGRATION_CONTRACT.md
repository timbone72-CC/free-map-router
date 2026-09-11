# Workbook ↔ Free Map Router Integration Contract

## Connected projects

- Upstream workbook: `timbone72-CC/inspectorade-drop-forecast-workbook-audit`
- Downstream app: `timbone72-CC/free-map-router`
- Forward handoff: workbook → `Free Map Router Address Inbox.json` → app
- Route-order return: app → `Free Map Router Route Order.json` → workbook
- Manual-gig handoff: app → `Free Map Router Gig Handoff.json` → workbook `Gig_Log`

## When the other project must be checked

Inspect both repositories before changing either side only when the proposed change can affect:

- exported address text;
- the optional `GIS` / `DCFS` source;
- selected-job order;
- duplicate-address handling;
- the inbox filename, Drive folder, JSON version, JSON structure, field names, or field meaning; or
- how the app imports, merges, replaces, or preserves workbook-sent stops; or
- workbook Order IDs, displayed stop numbers, the route-order return filename,
  or how the workbook clears and applies returned Route Number values; or
- routed manual Gig IDs carried by the route-order return; or
- the manual-gig handoff filename/version/fields, immutable `Gig_ID`, or workbook `Gig_Log` ownership/stale-write rules.

When triggered, the change record must say whether the other project remains compatible or needs a companion change. Do not merge or deploy an incompatible one-sided change. Keep one side backward-compatible during ordered deployment whenever practical.

## Risk-matched integration testing

During development, run only focused handoff tests in each repository whose runtime changes. Before merge, run one complete suite on the final runtime head of each runtime-changed repository. Do not rerun unrelated suites after every small correction, and do not run runtime tests in a repository receiving documentation only. `TESTING_CONTRACT.md` controls failure-stop behavior and reuse of a valid final result.

## Cross-System Reality Gate

For any runtime change that alters or depends on data crossing between the workbook and Free Map Router, complete this gate before calling the change ready, mergeable, publishable, or deployable:

1. Write the actual operator sequence from the initiating user action to the final visible result. Do not substitute a helper-call sequence for the real workflow.
2. Map every changed boundary as `producer → actual state/file → consumer`. Identify the real Drive file, stored route snapshot, sheet, account, or other state that carries the data.
3. Verify the target environment prerequisites before the smoke check. Required sheets, files, identities, permissions, and route state must actually exist. A workbook named Sandbox is not assumed to be a fully isolated integration sandbox.
4. Focused coverage must exercise the real state-building path through the changed boundary. A test that injects the expected internal state directly into the last serializer, writer, parser, or consumer is not sufficient as the only workflow proof.
5. Before merge/publication/deployment, inspect the handoff artifact produced by that realistic path and confirm the new or changed field/data is actually present and accepted by the receiving side. This may be automated when the test genuinely produces and consumes that artifact.
6. An ordered rollout instruction is a hard gate. If the plan says A must succeed before B, do not perform B until the required evidence for A exists.
7. If a sandbox workbook uses the same Free Map Router Drive folder, filenames, integration identity, or other live handoff resource, label the test environment as **workbook sandbox / shared FMR handoff** and treat those writes as touching the shared integration resource.

This gate applies only to affected cross-system behavior. It does not add repeated full-suite runs, unrelated smoke checks, or extra approval loops to workbook-only or app-only work.

## Corrected output addresses

The workbook may send optional `originalAddress` values beside a corrected `address` when output-only formatting changes visible address text. The app retains every distinct exact original alias for the corrected route entry, migrates only saved stops whose normalized full address exactly matches one of those aliases, and then de-duplicates them into one corrected stop while preserving the strongest pin and other saved data. The field is optional, is not stored as a second stop, and older address-only inboxes remain valid.

When the operator corrects an address inside Free Map Router, the app retains
the prior exact normalized full address as a hidden alias on that same saved
stop. A later raw workbook address that exactly matches that alias resolves to
the corrected stop, preserves its dedicated GIS/DCFS source and pin, and
attaches the inbox's exact Order IDs to that stop's pending route entry. The
raw address is not recreated as a second stop. Fuzzy, partial, coordinate,
label, client, and inferred alias matching are prohibited.

## Route-order return

The workbook may send optional `orderIds` beside one de-duplicated physical
address. The app preserves them inside the specific pending and Route Plan Day
Google/Basic snapshots instead of treating them as permanent address identity.
Manual gigs likewise retain immutable `Gig_ID` values in the selected Day route
snapshot's `gigIdsByStopId`; those IDs are route/work-item identity, not
physical-stop identity.

The manual return file remains named **Free Map Router Route Order.json**. Each
returned physical stop contains its visible stop number and address plus optional
exact `orderIds` and optional exact `gigIds`. At least one of those identifier
arrays must contain work for the returned stop. Address text is audit/print
context only; the workbook matches InspectorADE jobs by exact Order ID and
manual gigs by exact `Gig_Log.Gig_ID`. A shared physical stop may contain both
types of work without merging their identities.

### Legacy route-order version 1

`routeOrderVersion: 1` remains the backward-compatible one-day contract. When
any InspectorADE Order ID is returned, `sourceUpdatedAt` is required, must match
the exact current workbook Address Inbox export time, and the returned
InspectorADE Order-ID set must exactly equal the current inbox Order-ID set. A
partial version-1 return remains invalid and must fail before workbook route
writes.

A manual-gig-only version-1 return has no workbook source snapshot to verify and
may omit `sourceUpdatedAt`; it is validated against the current healthy
`Gig_Log` by exact Gig ID, with the same-send missing-gig bootstrap exception
described below.

### Phase 2J route-order version 2 — active Day

**New invariant — approved design decision 2026-09-08:** Phase 2J adds
`routeOrderVersion: 2` to represent the one active Route Plan Day while FMR
retains ownership of the complete multi-day Route Plan.

A version-2 file keeps the existing app/target, route timestamp, route slot,
optimization status, source timestamp, and stop structure and additionally
requires:

- `routeScope: "active_day"`; and
- a `routePlan` object containing:
  - nonblank stable `planId`;
  - positive whole-number `planRevision`;
  - nonblank stable `dayId`;
  - positive whole-number `dayRevision`;
  - positive whole-number `dayNumber`;
  - positive whole-number `dayCount`, with `dayNumber <= dayCount`; and
  - `routeDate` as a valid local `YYYY-MM-DD` calendar date or `null`.

The version-2 file carries only the displayed route for the active Day. It does
not carry other Days' stop lists, route orders, assignments, completion state,
or work-item collections. The workbook does not become the durable database for
the full Route Plan.

When a version-2 return contains InspectorADE Order IDs:

- `sourceUpdatedAt` remains required and must exactly equal the current workbook
  Address Inbox `updatedAt`;
- every returned InspectorADE Order ID must exist in that current inbox;
- any returned InspectorADE Order ID not present in the current inbox is a hard
  refusal before workbook route writes; and
- current-inbox InspectorADE IDs omitted from the returned active Day are allowed
  because they may belong to another FMR Day. Their omission is not deletion,
  cancellation, completion, or route damage.

A version-2 manual-gig-only return may omit `sourceUpdatedAt` and is validated
by exact immutable `Gig_ID`, including the same-send missing-gig bootstrap
exception described below.

For both versions, a missing, duplicated, or ambiguous routed Order ID or Gig ID,
a duplicate stop number, malformed Day metadata, stale source time, damaged
file, wrong target, or unsupported version stops before the workbook clears or
changes existing route numbers. Address text is never an identity substitute.

Phase 2E/2J uses the existing route-order file as transient route context only.
The route order itself does not become durable Gig_Log state and never alters
`Actual_Pay`. When every routed Gig_ID already exists in healthy `Gig_Log`, the
receiver remains read-only with respect to Gig_Log. When a routed exact Gig_ID
is missing, the workbook companion may append only that missing routed gig from
a valid **Free Map Router Gig Handoff.json** whose normalized top-level
`updatedAt` exactly equals the route order's `updatedAt`. Existing Gig_Log rows
are never auto-updated, cleared, or deleted by route receive. The workbook's
Google Print packet may use the returned stop number/address together with the
matched or just-bootstrapped `Job_Log`/`Gig_Log` row to render the returned Day.

For a validated version-2 active-Day return, the workbook may rebuild the route
packet from the exact returned Source_ID/Gig_ID identities rather than unrelated
Print checkbox selections. It must not change or clear Print checkboxes during
receive. The packet must identify `Day N of M` on every page and include the
local route date when `routeDate` is present. Receiving a later Day replaces the
workbook's current Stop/Print Order view and current route packet for that Day
only; the earlier/later Days remain stored in FMR.

Success surfaces for the day-aware return must distinguish InspectorADE job
count, manual-gig count, and total returned work-item count. Physical stop count
is a separate measure and must not be mislabeled as work items.

The app-side file write and workbook-side clear/write/rebuild must remain
backward-compatible during ordered deployment. The workbook companion is
deployed first and must accept both legacy version 1 and day-aware version 2.
Only after workbook validation succeeds may FMR publish the companion handoff-
first route send. The workbook must ignore a missing route-order file and reject
damaged, duplicate, stale, mismatched-handoff, or structurally invalid return
data without clearing Route Number values.

## Manual-gig handoff

Phase 2C uses **Free Map Router Gig Handoff.json** in the existing governed Free
Map Router folder with the existing limited `drive.file` permission. The
explicit **Sync Gigs to Workbook** action remains the full-ledger refresh path.
Saving/editing/completing a gig, starting a route, syncing the Manual Work
Library, opening the app, and Dashboard activity do not write this file merely
because those actions occurred.

A narrow route-send exception is approved for routed manual work: when the
operator explicitly presses **Send Route Order to Workbook** and the displayed
route contains one or more manual Gig IDs, FMR builds the current gig handoff
and route-order artifact from one operation timestamp, verifies that every
routed Gig_ID exists in the handoff, writes the handoff first, and writes the
route order only after the handoff succeeds. A route with no manual gigs keeps
the existing route-order-only write path. This is not a background sync.

`gigHandoffVersion: 1` carries a snapshot of current manual gig occurrences. Each row is identified only by immutable `gigId` and may mirror source (`HNP` or `OTHER`), attached address, work-order/job ID, expected pay, due date, completed date, notes, and the gig's `updatedAt`. It never carries InspectorADE Order IDs, GIS/DCFS source, route membership, repeat-template identity, Home, prediction fields, or workbook-owned Actual Pay.

The workbook's explicit manual sync validates the full payload before planned
writes and upserts `Gig_Log` by exact `Gig_ID` only. Address and work-order text
are never identity substitutes. A newer FMR timestamp may update only FMR-owned
mirror fields; an older incoming row is skipped; same timestamp with different
FMR-owned content is ambiguous and must stop rather than guess. A later handoff
that omits a previously mirrored Gig_ID is not a deletion instruction. Existing
`Gig_Log.Actual_Pay` is workbook-owned and may never be overwritten or cleared
by this handoff.

During route receive, the same file has a much narrower role: it is read only
when one or more exact routed Gig_ID values are absent from healthy Gig_Log. The
workbook requires exact top-level `updatedAt` equality with the route order and
may append only the missing routed rows. It may not use route receive to update
existing Gig_Log rows or import unrelated non-routed gigs.

A duplicate exact Drive handoff file, duplicate incoming Gig_ID, duplicate existing `Gig_Log.Gig_ID`, malformed required field, damaged timestamp/date/pay, same-send timestamp mismatch, or missing routed exact Gig_ID must fail closed before Job_Log route-number writes. This companion path does not write InspectorADE history, archive, prediction state, or unrelated workbook data.

## When extra work is not required

A change that clearly cannot affect the handoff needs only one sentence in its change record: `No workbook/router integration impact.` It does not require opening the other repository, a companion pull request, cross-project tests, or extra approval.

Use only the tests and smoke checks that cover the changed handoff behavior. This contract must not turn unrelated workbook-only or app-only work into a larger process.