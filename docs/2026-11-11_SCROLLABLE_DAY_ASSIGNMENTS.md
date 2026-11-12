# Scrollable Day assignments — 2026-11-11

**Level 1 — bounded appearance change.** User requested a shorter multi-day
assignment list with its own scrolling window and the ability to collapse it.

## Scope

- `styles.css`: cap only `routePlanAssignmentList` at the smaller of 28rem and
  60% of viewport height, enable vertical scrolling, retain natural height for
  short lists, and show a keyboard focus outline.
- `index.html`: make that scroll region keyboard-focusable and named for
  assistive technology; refresh the stylesheet cache pin to `1.2.13`.
- Keep the existing native `details` / `summary` collapse control and its
  default collapsed state. Plan controls and Workday stay outside the scroll
  region. No modal, extra page, script, or stored expansion state.

- Refresh the existing layout tests' expected stylesheet pin; their behavior
  assertions remain unchanged.

## Protection and validation

No workbook/router integration impact. Assignment selects, lock checkboxes,
plan identity, both optimized routes, dates, stop order, storage, imports,
exports, Google calls, and other pages retain their existing owners and logic.
Only the existing assignment-list display is written; no user data is read or
written by this appearance change.

Affected-surface check plan for a populated browser at desktop and phone widths: the inner
list scrolls, the final address remains reachable, controls work, and the
section opens/collapses without moving or deleting assignments. Confirm page
navigation remains responsive. Run existing focused layout/day-control checks
and use CI's complete suite and JavaScript syntax result once on the final head.

Base / rollback: `4ae49212f81fe4882bf4f710ea5210e34e51a59d`; revert this PR.

Validation update: 17 focused checks passed. Initial CI found seven additional
layout assertions pinned to the previous stylesheet version. Updated only their
expected cache pin and reran those seven focused files. The local visual fixture
could not be loaded in the cloud browser; the local browser could not launch
under environment restrictions. Live collapse/navigation and computed CSS checks
will follow publication; populated-list scrolling remains an operator check.
