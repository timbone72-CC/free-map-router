# Build Route: readable desktop layout at 100% zoom — 2026-11-08

**Change level:** Level 1, page-scoped appearance and responsive typography.  
**Branch:** `ui/readable-route-layout-at-100pct-20261108`  
**Rollback baseline:** `e0ae62e14f975962f537e1e051499fb67bea66bc` (`main`).

## Operator feedback and grounded problem

On a laptop at 100% Chrome zoom, the route page was narrow and much of its text was too small to read comfortably. The operator explicitly approved trying a wider layout **with readable typography at 100%**, rather than guessing another set of fixed card sizes. The app's CSS restricted the global body to 980px, Route Builder context/action panels to 870px and map/list surface to 920px; `.tiny` was 12px and Route Builder buttons 0.9rem (roughly 14px). The previous screenshot at 100% showed the two planning panels already side by side, but content and controls were quite small. An unpublished intermediate experiment to change just the breakpoint did not address typography; it is superseded by this branch.

## Scope / owning files

- `styles.css`: only the selected `#routePage` gains a measured responsive desktop treatment. The existing 980px body max continues to apply to all other pages. When Build Route is visible on >=1001px screens, expand its body up to `min(1400px, 92vw)` and let the route context and map/list surface use that width. Keep the narrower Drive this route card and other existing bounded controls.
- Keep Multi-Day Plan and Workday in their already-approved side-by-side grid above 1000px, with `align-items:start` so the shorter card doesn't stretch to the taller one. Workday uses auto-fitting 160px-minimum columns when the viewport allows them rather than always two.
- Route page **only** at viewport widths >=761px: base/main text and route buttons/fields 16px; secondary `.tiny`, route facts and helper text 15px; low-priority Stop ID 14px; section headers 20px. Controls retain min hit areas and responsive wrapping.
- Below 1001px, plan cards stack to protect readability; <=760px phone Workday two-column layout and mobile map/list behavior remain unchanged.
- `index.html`: bump only the CSS query version to 1.2.11 so Chrome won't reuse old sizing.
- Route-specific tests: assert page-only body expansion, readable text sizes, side-by-side condition, and narrow/phone layout preservation. Existing CSS query-version assertions updated.

## Boundaries, risks and checks

This is display-only. No route data, saved address, due dates, permissions, Google APIs, workbook handoff, navigation, stop completion, or function handlers change. **No workbook/router integration impact.** The change is intentionally CSS/HTML only.

Primary risk: controls overflow when browser usable width shrinks or when text is enlarged. Mitigation: preserve responsive stacking below 1001px; auto-fit Workday columns and flex-wrap route actions; keep one-column page layout on phones. Risk of stale desktop cache is handled by a version-pinned stylesheet.

Focused: `node --test tests/readable-build-route-desktop.test.js tests/compact-workday-and-driving-panel.test.js`. Full suite and first-party JS syntax through GitHub CI on the final source head before merge.

Post-publication operator check at **100% Chrome zoom** on laptop: verify the page uses the wider center area, the labels/buttons are comfortable to read, Multi-Day/Workday are side by side without unused interior height, Workday controls don't overflow, and the dropdown/Drive/Today's Route still operate. One phone appearance check only if a change is observed; the phone CSS layout is unchanged by this branch.

Rollback: revert this PR to the named baseline. No data migration or external resource rollback.
