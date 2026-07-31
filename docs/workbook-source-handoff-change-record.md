# Workbook Source Handoff Change Record

## Classification

Level 3 — coordinated cross-application synchronization and stored-stop schema extension.

## Exact problem and evidence

The workbook owns an authoritative `Job_Log.Source` value of `GIS` or `DCFS`, but the current `Free Map Router Address Inbox.json` exports only an address. The app therefore receives no source and retains unrelated client labels such as `MCS`. The verified example `420 NWGRANITE AVE, Cache` is `GIS` in the workbook while the app backup stores `label: MCS` and no route source.

## Approved result

- The workbook sends an optional dedicated `source` field with each address.
- Valid route sources are only `GIS` and `DCFS`.
- Client/label and notes remain separate and are not overwritten.
- Free Map Router stores the route source separately on the stop record.
- An incoming workbook source updates the matching address's route source while preserving its ID, address, client label, notes, coordinates, and manual pin.
- Build Route and Garmin use the dedicated source first, with the existing label/notes lookup retained only as a legacy fallback.
- Existing version-1 inbox files without `source` remain valid.
- The inbox version and Drive file names do not change.

## App ownership and files

- `contract.js`: normalize and preserve the optional dedicated source.
- `inbox.js`: continues parsing version-1 inboxes through the storage contract.
- `app.js`: Build Route reads the dedicated source first.
- `garmin-gpx.js`: Garmin point names read the dedicated source first.
- `tests/address-contract.test.js`: source normalization and merge preservation.
- `tests/inbox.test.js`: workbook source updates a matching address without replacing client label or manual pin.
- `tests/route-numbering.test.js`: route and Garmin names use the dedicated source.
- `CONTRACT.md`: approved cross-application field authority.

## Data matrix

| Field | Authority | Required | Behavior when absent |
| --- | --- | --- | --- |
| address | Workbook handoff / existing stop | yes | row is rejected |
| source | `Job_Log.Source` | no | existing source remains; legacy fallback may be used |
| label | Existing app stop/client | no | remains unchanged |
| notes | Existing app stop | no | remains unchanged |
| coordinates/pin | Existing app stop | no | existing manual or geocoded values remain protected |

## Read and write surfaces

Reads the version-1 app inbox and existing browser stops. Writes only the optional stop `source` field and the existing route selection during normal inbox application. It does not write workbook sheets, Google Maps order, Home, client labels, notes, coordinates, or API credentials.

## Risks and controls

- Risk: client labels are overwritten. Control: source is a separate field and tests assert `MCS` remains.
- Risk: manual pins are weakened. Control: existing pin priority remains and tests assert preservation.
- Risk: unknown text is displayed as source. Control: strict `GIS`/`DCFS` allowlist.
- Risk: old inboxes stop working. Control: source remains optional and inbox version stays 1.
- Risk: route or Garmin disagrees. Control: both read the same dedicated field first and focused tests cover both.

## Baseline and rollback

- App baseline: 67 passing tests.
- Rollback point: the current `main` commit before this branch.

## Required verification

- Focused source normalization, inbox merge, route display, and Garmin tests.
- Complete `npm test` suite and JavaScript syntax checks.
- Diff inspection limited to the named files.
- After coordinated release: reconnect Drive, resend checked workbook jobs, verify `420 NWGRANITE AVE` displays `GIS`, verify Address controls remain responsive, and verify Garmin names match Build Route.

## Approval boundary

Implementation may be prepared and tested on branches. Because this is Level 3 cross-application synchronization, explicit operator approval is required before either coordinated pull request is merged or the workbook is deployed.
