# Build Route laptop layout compaction — 2026-11-08

**Change level:** Level 2, existing Build Route page layout and static instructions only.
**Rollback baseline:** `7f35a6249ba809471a6b2217c74e188d9fdc9a11` (main when branch created).
**Scope:** User-requested iterative laptop-only appearance improvement; no data or route logic changes.

## Operator evidence

Three screenshots showed excessive vertical/horizontal space in the **Workday** date/time section, large **Days** number input in **Multi-Day Plan**, a tall **Drive this route** panel with redundant explanatory text, and a broad map/list area. The operator clarified this is a **laptop view** problem and that the phone experience should be left as-is for this pass. Separately, the operator asked why **Done & Navigate Next** opens Google Maps.

## Implemented appearance change

- In `index.html`, put Multi-Day Plan and Workday in a shared `plannerSettingsGrid` so they display side-by-side on wide desktop screens and stack on narrower ones.
- Replace the two Workday `row2` wrappers with one `workdayFields` group containing all existing date, departure, preferred finish, and Home By controls. On wide desktops sharing the row with Multi-Day Plan, show two columns per Workday card to avoid cramped native date/time inputs; when panels stack on medium screens, allow four across, then two/one as screen space decreases.
- Keep the Days numeric input to a small 94px field; retain current min, step, value, validation and button IDs.
- Simplify the Multi-Day status line and **Drive this route** hint. Preserve all action controls and existing live dynamic status nodes.
- In `styles.css`, constrain laptop planning/action cards to 870px and route map/list card to 920px; constrain the collapsed tools drawer/summary widths, reduce desktop map/list heights to 410px, and tighten inner padding. Changes live under `#routePage` and a desktop-only media query when adjusting overall widths. Other pages remain untouched.
- Bump stylesheet cache pin to 1.2.9. No script order or JavaScript logic changes.

## Navigation inspection — no behavior change

The existing `completeCurrentStopAndNavigate()` in `app.js` selects the first current route stop, chooses the next remaining physical stop or Home, applies completion to the active plan, saves it, rerenders the route and opens Google Maps navigation for that destination in a new tab. The open is intentional; no evidence of opening the wrong stop is supplied. This UI task does not alter completion persistence, route order or whether Google Maps opens. It does not create duplicate completion actions.

## Safety and verification

Read surfaces: static page markup, CSS, and pre-existing `app.js`/routing code for explanation. Write surfaces: `index.html`, `styles.css`, appearance/layout tests, this record. **No workbook/router integration impact.** No changes to Drive, Google Maps URLs, permissions, storage, stop IDs, work IDs, route completion, routing algorithms, or user data.

- Focused test: `node --test tests/compact-workday-and-driving-panel.test.js`.
- Existing CSS cache-pin assertions updated in `tests/route-quick-actions-layout.test.js` and `tests/build-route-button-compact.test.js`.
- Run final complete suite and first-party syntax checks via GitHub CI on the last runtime head. Stop on failure; do not publish after failed checks.
- Live laptop smoke check after Pages success: panel widths and spacing look proportionate; Days isn't oversized; Workday fields stay editable and Home By switch keeps its saved state; Route tools dropdown remains accessible; the map and route list remain usable. Phone UI is unchanged by the new desktop-only width/height limits. No need to complete a live inspection or start a route merely to test layout.
- Rollback: revert this PR to the above baseline; no migration or external data operations needed.
