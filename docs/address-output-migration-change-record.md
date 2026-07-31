# Address output migration change record

- Problem: output-only workbook corrections can otherwise look like new physical addresses to the app and create a duplicate separate from the saved pin.
- Scope: accept optional `originalAddress`, retain every distinct exact original alias for a corrected route entry, migrate only exact normalized saved-address matches, preserve saved stop data, and select one corrected stop.
- Required data: corrected `address`. Optional data: `originalAddress` and governed `source` (`GIS` or `DCFS`). Older address-only inboxes remain valid.
- Schema and permissions: inbox version stays `1`; no stored-stop schema, Drive permission, browser permission, routing algorithm, or deployment configuration changes.
- Owning files: `inbox.js`, `index.html`, and `tests/inbox.test.js`.
- Read surfaces: current saved stops and the current workbook inbox. Write surface: the app's existing saved-stop collection through the normal inbox import path only.
- Protected behavior: old inboxes, manual-pin priority, labels, notes, source, route order, Home, routing, Garmin, Drive permissions, and all other pages.
- Hard limits: the change processes only the already-loaded saved-stop list and current inbox entries; it adds no polling, observer, timer, network request, retry loop, or unbounded background work.
- Stale-output behavior: without `originalAddress`, no migration occurs. An old inbox stays valid. A corrected address is applied only when that new inbox is loaded; it is never inferred from existing saved text alone.
- Primary risk: merging the wrong stop or leaving a stale alias duplicate. Mitigation: every migration requires an exact normalized full original-address match, and all distinct aliases for one corrected address are retained before route de-duplication.
- Realistic fixtures: Granite spacing correction preserves one manual-pinned stop; two ALLEN-A-DALE historical spellings collapse into one corrected stop while keeping the strongest manual pin.
- Final verification: focused inbox suite passed 6/6; complete app suite passed 75/75; all JavaScript syntax checks passed.
- Failure recovery: do not deploy the workbook if the app check fails. Before the live migration smoke check, save an app backup. If a saved stop migrates incorrectly, restore that backup and roll the app back to `34b8b27b013f3c8ae28846899cdec70c9ffa963f`; keep or restore the workbook at `61bfdefbc74db899fd3c2427bb8847734c4d9216` and do not send another corrected inbox until repaired.
- Deployment order: app first, verify publication, then workbook second.
- Approval status: explicitly approved by the operator on 2026-07-31 with `MERGE BOTH`.
- Level: 3 because the handoff can automatically migrate saved address text.
