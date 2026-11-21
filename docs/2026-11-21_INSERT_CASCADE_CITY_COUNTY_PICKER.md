# FMR — County filters City options; City dropdown opens from the full field

**Date:** 2026-11-21  
**Risk level:** 2 — narrow Route Builder control fix  
**Baseline / rollback:** main at `ac0373f335172df6d8e9e613bdc1cf4c1c89dfa2` (PR #156; numeric house-prefix search tested working).

## User issue

In **Route Builder → Route tools & maintenance → Optimize New Stop Only**, choosing County (e.g., Beckham) currently leaves cities from all other counties visible in the City dropdown. The operator also reports that on their desktop the City menu opens only when precisely clicking its arrow, not the broader field.

## Requested behavior and boundaries

- County selection narrows City **options themselves** to only city names present among *eligible saved stops* in that county. With County=All, preserve the existing dynamic saved-city list. County changes reset a previously selected City to All only when no eligible address in the selected county belongs to that City; preserve it otherwise.
- The entire City select field should open its native picker from a desktop mouse click, not only the arrow. Use the native `HTMLSelectElement.showPicker()` within the trusted pointerdown event when supported. If the browser blocks the picker, its native fallback remains. Preserve touch, keyboard, focus, and normal county interaction.
- Retain existing **house number prefix search**, City/County matching, exact selected stop eligibility, current Google route, workbook data, saved stops and work IDs.
- **Read:** eligible saved addresses and their city/county view, selected dropdown/search values.
- **Write:** City select's options and selected value, displayed address options, and button disabled state. No route, storage, Google Drive, workbook or backend writes. No new APIs or permissions.
- Ownership: `app.js`; cache version in `index.html`; focused tests in `tests/google-insert-stop-filters.test.js`; existing cache pin checks updated to match the new app script version.
- Browser reference: https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement/showPicker .

## Test and release

Focused tests verify County=Beckham shows only saved Elk City, County=Comanche only saved Lawton; switching counties resets an incompatible City and removes a stale selected stop; returning to All restores the list. A simulated mouse pointerdown opens the picker and prevents native duplicate handling; touch/disabled/unsupported paths preserve default behavior.

CI on the exact final branch head must pass `npm test` and first-party JavaScript syntax checks before Level-2 merge. **Live smoke:** refresh the Route Builder page, choose Beckham County and confirm the City list only contains recognized saved cities in that county; click anywhere on the City field; switch County and confirm City list updates; search `1` → `12` still narrows house-number prefixes. No paid Optimize run needed.

**No workbook/router integration impact.**
