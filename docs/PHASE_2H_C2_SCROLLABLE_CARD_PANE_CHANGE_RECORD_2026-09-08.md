# Phase 2H-C2 Scrollable Card Pane Change Record — 2026-09-08

## Classification

Level 2 presentation-only follow-up to Phase 2H-C2.

## Governed base

- Repository: `timbone72-CC/free-map-router`
- Base commit: `d3e90e46a7fbd20a0d6284793fc1850705b02f73`
- Parent phase: Phase 2H-C2 — Planner Map/List and Responsive Presentation

## Operator observation

During the first live C2 smoke, only route stops 1 and 14 had saved display coordinates and therefore map markers. Selecting those route cards correctly focused the matching map marker. The operator requested that the route cards scroll inside their own bounded window so the map can remain visible while moving through a longer route.

## Scope

This follow-up changes presentation only:

- desktop/tablet `.plannerListPane` uses the same 460px working height as the planner map;
- the route-card pane scrolls vertically inside that bounded height;
- overscroll is contained to the card pane and scrollbar space is kept stable;
- the card pane receives a subtle border/background so it reads as a window inside the planner page;
- at the existing `max-width: 760px` phone breakpoint, the pane returns to normal document flow and the existing List/Map toggle remains the mobile presentation model.

## Explicit non-scope

No change to:

- `app.js` or planner model logic;
- physical-stop identity or work-item attachment;
- route order or membership;
- Google or Basic optimization;
- marker creation or saved-coordinate eligibility;
- card-to-marker focus behavior;
- Workday, schedule, pay, or service calculations;
- localStorage, route-history schema, backup schema, Drive, workbook handoff, permissions, or deployment configuration.

Stops without saved display coordinates remain in the route-card list and remain unplottable on the internal map exactly as Phase 2H-C2 requires.

## Files

- `styles.css`
- `tests/phase-2h-c-planner-presentation.test.js`
- this change record

## Regression protection

The existing Phase 2H-C planner presentation test now also requires:

1. desktop/tablet `.plannerListPane` height of 460px;
2. `overflow-y: auto` for independent vertical card scrolling;
3. contained overscroll and stable scrollbar gutter;
4. phone breakpoint reset to automatic height and visible overflow;
5. phone List/Map one-view-at-a-time rules remain present.

All existing C1/C2 identity, timing-confidence, protected-control, and no-second-route-state tests remain applicable.

## Acceptance smoke

After publication on a desktop or laptop:

1. Update App and open Build Route.
2. Confirm the map stays visible while the card pane scrolls independently.
3. Scroll from the first route card toward later stops without moving the whole page merely to advance through cards.
4. Select a mapped card such as stop 1 or 14 and confirm the map still focuses the selected marker.
5. Confirm unplottable cards remain visible in the scrolling list.

On phone:

6. Confirm List/Map toggle behavior is unchanged and the list is not trapped inside a 460px inner scroll window.

## Rollback

Revert this follow-up to Phase 2H-C2 merge commit:

`d3e90e46a7fbd20a0d6284793fc1850705b02f73`

No data migration or cleanup is required.
