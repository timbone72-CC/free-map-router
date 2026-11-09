# Cohesive Build Route laptop layout — 2026-11-09

**Level 2 — route tool grouping and desktop layout**, visual presentation only, with the original controls and event owners unchanged.

**Base / rollback:** `3dd5cd30a6eac11a9c99122fdc0e2479ce03276e` (published main).  
**Branch:** `ui/cohesive-desktop-route-workspace-20261109`.  
**Source evidence:** User laptop screenshot at normal zoom: top tools expand into a long half-width drawer with empty space beside it, planning cards have inconsistent spacing and hierarchy, Drive this route is oddly narrow, and labels/controls still read too small. User requested a more professional layout modeled on existing route-planner patterns.

## Authorized result
- Route tools & maintenance remains a single expandable dropdown near the top, with the same control IDs, labels, disabled states, workbook/optimizer feedback and pending-route action. **Group the original actions in a wider primary route-action area**, and the two work-clear buttons in a narrower secondary **Clear work** area, on desktop only. The original DOM order is retained; the added wrappers have no layout box on phones and the added heading is hidden there.
- On desktop, increase page text to 18px, helper/meta text to 16px, muted stop ID to 14px; buttons and form controls to 18px with a 44px minimum control height; headings to 22px. No essential information gets smaller.
- Use neutral, bounded white cards, consistent padding/radius, more coherent route header, full-width tools, a responsive Multi-Day Plan/Workday two-card row, a full-width driving card, and a full-width map/list workspace. Controls remain inside existing named panels; no unrelated page restyling.
- Workday's four time/date controls use a readable two-column layout within the planning card. Multi-Day Plan stays alongside Workday on desktop; narrow screens stack. The map/list stays the same live renderer.
- Simplify only the static clear-work helper sentence. Leave all dynamic text and data bindings unchanged.
- Refresh `styles.css` pin `1.2.11` to `1.2.12`.

## Ownership, effects and protected behavior
Write surfaces: `index.html` (one existing tool drawer's markup; no new IDs), `styles.css` (scoped `#routePage` desktop styles and mobile wrapper flattening), focused layout test, version-assertion tests and this record.

**No workbook/router integration impact.** No edits to `app.js`, route state, work order IDs, route history, Google Maps links, workbook handoff, Google authentication, saved dates, Home By switch, navigation, stop completion, search, plan persistence, or the Android/phone app. The originally hidden Start New Route button remains pending-only. Other FMR pages retain their current styles.

Potential issue: the new wrapper could interfere with element lookup or alter phone tool order. The focused test asserts unique element IDs, their original DOM order, and CSS `display:contents` flattening at <=760px; existing complete tests verify event/data contracts. Potential issue: larger fonts cause overflow. Buttons wrap, date/time inputs use a two-column grid, and the two planning cards stack on narrower viewports.

## Gates
- Focused: `node --test tests/cohesive-route-workspace.test.js` plus applicable prior layout tests.
- Final: `npm test` and first-party JavaScript syntax on final head by GitHub CI. Stop on failure.
- Affected live operator smoke: at 100% zoom on a laptop, open the top Route tools dropdown; verify buttons are grouped and all present, text and spacing are comfortable, Multi-Day Plan and Workday sit side by side, the route map/list still appears, and route actions respond. A phone appearance check is optional only if the existing layout changes. **No route clearing, stop completion, or workbook write** is needed merely to check the desktop layout.
- Rollback by GitHub PR revert to the base commit. No data migration, storage cleanup or external operation.
