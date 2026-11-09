# Build Route — compact planning editor and contextual workbook status

Date: 2026-11-08
Change level: **Level 2 — existing UI control/feedback placement**.
Base commit: `ef0a2ec8a9b3a232ef7978857e98b59dce57454d`.
Status: prepared on a branch; CI and laptop operator smoke pending.

## Operator evidence
The operator's laptop screenshot showed a full-width **Plan Work Item** editor occupying most of the **Drive this route** card even when the editor was not needed, and an unrelated message reading **"Tap Check Workbook Route to connect Google Drive and safely load saved address corrections"** appearing below the editor instead of by **Check Workbook Route** in the top **Route tools & maintenance** dropdown.

## Approved narrow change
- `work-item-planning-controls.js` owns the editor. Retain exactly one existing panel, with the same planning form, selection, fields, exact Order ID/Gig ID identities, record revisions and save handler. Render it as an expandable `<details>` with a compact summary containing route work-item count and service total. On desktop >=1101px start collapsed; on phones and smaller screens start open, preserving easy field access. Use the existing panel on every render, retaining its expanded state.
- Use shorter accurate explanatory copy while expanded; keep all service minutes, assigned-day and lock controls available.
- `styles.css`: constrain the panel to a readable 680px max and reduce spacing; preserve focus treatment.
- `index.html`: add one nearby workbook-check status element inside the top dropdown. Retain `routeStatus` alongside **Drive this route** and keep the existing workbook-send status and pending-route notice.
- `app.js`: direct workbook check progress/result/error to the nearby workbook-check element (fallback to the old element only if missing). Redirect **only** the permanent-address-correction connection prompt from `FMRRouteBridge.setRouteStatus` to the workbook-check element. All other navigation, completion, route, and optimization statuses continue to target the original route status. No Google Drive requests or permission changes.
- Version pins for the changed CSS, app.js, route-work-controls loader and dynamically loaded planning-controls module, preventing a stale app/session from mixing new DOM with old code.

## Surfaces / risks
Read: `app.js` workbook-check status source, dynamic planning panel owner and existing cache loader. Write: Build Route DOM, local CSS presentation, these two UI-status routing paths and tests. **No workbook/router integration impact**: Drive inbox/file, workbook code, route-order serialization, routing, stop completion, planning storage, work ID mapping and external network behavior are unchanged.

Risks: moving every route status into hidden dropdown could suppress real navigation feedback; avoid by routing only workbook check and the specific Drive connection prompt. Recreating the planning panel after edits could reset user entry; avoid by returning the original panel if present. Phone should retain default-open editor and all form fields. No observers, timers, polling, or new storage.

## Verification and rollback
- Focused `node --test tests/compact-work-item-planning-status.test.js tests/work-item-planning-controls.test.js` covers unique original fields, desktop/phone default state, workbook check results and errors, prompt routing, and preserved driving statuses.
- Complete `npm test` and first-party JS syntax via GitHub CI on final runtime head; stop on any failure.
- One live laptop check after Pages publication: new compact **Plan Work Item** summary displays work counts/service total; expands to editable fields; Check Workbook Route text and results appear next to the button, not below the planning card; navigation/status text remains in Drive this route. No live stop completion or workbook write is required for the layout smoke.
- Rollback by reverting the PR to the preceding commit `ef0a2ec8` if the UI is defective. No persisted data or external resources need rollback.
