# Phase 2B — Combined Route Expected Pay Impact Record

Date: 2026-08-24
Repository: `timbone72-CC/free-map-router`
Branch: `work/phase-2b-route-pay-20260824`
Change class: Level 3
Rollback commit: `76cecce233fd2d8f74029d2fc992a6c1c9141b15`

## User problem

A selected Google Route or Basic Route can contain InspectorADE work and manual/HNP gigs, but the route builder currently cannot show how much expected pay that selected route represents. The operator needs one route-level money view without mixing InspectorADE identity/history with manual gig identity.

## Approved Phase 2B scope

Implement only the Phase 2B route-pay design in `docs/PHASE_2_CROSS_SYSTEM_IMPLEMENTATION_RECORD_2026-08-23.md`:

- accept optional workbook expected-pay metadata on the existing version-1 Address Inbox;
- preserve that metadata inside the specific pending/Google/Basic route snapshot;
- migrate route-history storage from version 4 to version 5 while keeping older valid histories readable;
- calculate route expected pay from the selected route only;
- show InspectorADE known expected pay, manual-gig known expected pay, total known expected pay, and `Pay incomplete` when any represented work has unknown pay;
- preserve one physical stop even when multiple work items share that stop.

Phase 2C Gig_Log handoff, Phase 2D weekly-pay Dashboard, Phase 2E Google Print changes, Actual Pay, payroll reconciliation, and any new lifecycle/status system are excluded.

## Cross-project compatibility

This changes optional field meaning in the workbook → FMR handoff, so `INTEGRATION_CONTRACT.md` requires both repositories to change together.

The workbook keeps `inboxVersion: 1` and adds optional fields only. Older inboxes without pay metadata remain valid. FMR must remain backward-compatible while the workbook companion change is deployed.

Companion repository: `timbone72-CC/inspectorade-drop-forecast-workbook-audit`
Companion branch: `work/phase-2b-route-pay-20260824`

## Data and schema ownership

### Address Inbox — unchanged version 1

Existing address fields remain unchanged. A de-duplicated workbook address may additionally contain:

- `expectedPay`: nonnegative finite known InspectorADE subtotal for the checked jobs represented by that address;
- `expectedPayComplete`: boolean; true only when every represented checked InspectorADE job has a valid nonnegative `InspectorPay`.

These fields are route-work metadata only. They are never saved-address identity, correction identity, InspectorADE identity, or manual-property identity.

### Route history — version 4 → version 5

The existing local-storage key stays unchanged. Each route snapshot gains workbook pay metadata keyed by physical `stopId`.

Required migration behavior:

- existing valid version-4 route histories remain readable;
- missing pay metadata normalizes to no known InspectorADE pay and no false claim that legacy work is complete;
- existing route IDs, source timestamps, optimization state, Order IDs, Gig IDs, and gig-managed stop state remain intact;
- pending route pay copies into both named routes when Start New Route is used;
- route reordering preserves pay metadata;
- route removal drops pay for work no longer represented by the selected route;
- stop-ID remapping/merging combines represented workbook known subtotals once per old physical stop and marks the merged result incomplete if any merged component was incomplete;
- Clear InspectorADE Jobs clears workbook pay metadata together with workbook Order IDs while leaving manual-gig pay intact.

No new Drive file, permission, background sync, service, or account is added.

## Route-pay calculation

For the currently selected Google or Basic snapshot:

`known total = known InspectorADE subtotal + known expectedPay from each distinct represented Gig_ID`

Rules:

- Home is never counted.
- Each workbook stop subtotal is counted once.
- Each represented Gig_ID is counted once even if malformed duplicate references exist.
- Manual gig `expectedPay: null` means unknown and sets `Pay incomplete`; it is never silently converted to a known zero.
- A real expected pay of `0` remains a known zero.
- Workbook metadata with `expectedPayComplete: false` contributes its known subtotal but sets `Pay incomplete`.
- A referenced missing gig is treated as incomplete rather than inventing pay.
- Route pay is presentation/route planning data only; it never writes InspectorADE prediction/history data or manual gig pay values.

## Owning runtime surfaces

Expected owners:

- `inbox.js` — parse/normalize optional workbook pay metadata and map it to imported stop IDs;
- `route-history.js` — version-5 migration, snapshot preservation/remap, pure selected-route pay summary;
- `route-work-clear.js` — Clear InspectorADE Jobs removes workbook pay metadata;
- `app.js` and existing Build Route DOM — pass imported pay metadata into pending route and render selected-route pay;
- tests focused on inbox, route history, route clear, route-pay rendering/calculation, and handoff compatibility.

No unrelated refactor, page redesign, navigation change, optimizer change, or Google Maps behavior change is authorized.

## Required and optional inputs

- Workbook `expectedPay`: optional for backward compatibility; when present must be a finite nonnegative number.
- Workbook `expectedPayComplete`: optional for backward compatibility; when pay metadata is present it must be boolean.
- Manual gig expected pay remains optional under the existing gig contract.
- Order IDs, source, corrected-address aliases, and Gig_ID remain separate identity/relationship channels and are never inferred from pay.

Malformed optional pay metadata must fail closed for that inbox rather than silently inventing a total.

## Protected behavior

Must remain unchanged:

- five top-level app pages;
- Google Route and Basic Route selection/optimization/navigation;
- pending New Route flow;
- exact workbook Order-ID return behavior;
- address correction and one-physical-stop de-duplication;
- Manual Work Library and repeat schedules;
- Phase 2A due/completed dates and backup compatibility;
- Clear Manual Gig Work semantics;
- InspectorADE/manual-work isolation;
- existing Drive filenames and permissions.

## Realistic fixtures

Focused tests must include:

1. one workbook stop with complete known pay;
2. one workbook stop with known subtotal but incomplete pay;
3. an older inbox with no pay fields;
4. two workbook stops remapped into one physical stop, with known subtotals combined and completeness ANDed;
5. one route containing InspectorADE-only, manual-gig-only, shared, and app-only physical stops;
6. multiple manual gigs on one physical stop, including one blank expected pay;
7. route removal and source-specific clear behavior.

## Failure behavior

- damaged/invalid inbox pay metadata: reject the inbox before route replacement;
- damaged route-history pay metadata: normalize conservatively without inventing known pay;
- missing manual gig referenced by a route snapshot: keep known totals from valid work but mark pay incomplete;
- no known pay at all: display known `$0.00` only when the route has represented work metadata; never present unknown manual pay as known zero without `Pay incomplete`.

## Testing gate

During development, run focused tests for the changed handoff and route-pay behavior. On the final runtime head:

1. focused tests pass;
2. complete repository suite passes once;
3. JavaScript syntax checks pass;
4. final diff contains only Phase 2B changes;
5. exact final head SHA is recorded.

Exact-head CI may satisfy the complete-suite requirement.

## Live smoke plan

After both coordinated runtime changes are approved, merged, and published/deployed in the safe order:

1. send checked workbook jobs containing known and blank `InspectorPay` values;
2. load/start that route in FMR;
3. confirm Google and Basic show the same InspectorADE known subtotal before route edits;
4. add a manual gig with known pay and one with blank pay; verify known manual subtotal plus `Pay incomplete`;
5. remove a stop from only the selected route and verify only that selected route total changes;
6. use Clear InspectorADE Jobs and verify InspectorADE pay disappears while represented manual-gig pay remains;
7. confirm route addresses, Order IDs, corrected aliases, and workbook raw data remain unchanged.

## Merge/deployment gate

This is Level 3. Do not merge or deploy/publish either coordinated runtime PR until final exact-head tests/diff review pass and the operator gives explicit Level 3 pre-merge approval.
