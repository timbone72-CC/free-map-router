# Compact Build Route buttons — 2026-11-07

**Change class:** Level 1 — page-specific appearance-only styling.  
**Rollback baseline:** `c796a502acf0c4dae9eb27884bdd29135b2d0fc5` (`main`, after PR #123).

## Operator request
The operator confirmed the full Route tools & maintenance dropdown now works at the top and asked to **compact the buttons, starting with the Build Route page**.

## Change
Only buttons inside `#routePage` get smaller padding and gaps and a compact font size. Navigation buttons no longer expand into unnecessarily wide columns; they remain readable and can wrap to a new line on smaller screens. The minimum button height is 36px, and all controls retain their text labels, normal event handlers, disabled states, and existing positions. Buttons on Home, Addresses, Import, and Settings remain unchanged.

- `styles.css`: add three `#routePage`-scoped selectors for button dimensions, button row gaps and execution-button width; no JavaScript or data changes.
- `index.html`: bump stylesheet cache pin `1.2.4` → `1.2.5` to make the new appearance visible on refresh.
- `tests/build-route-button-compact.test.js`: focused check for page scope, minimum height, cache pin, and existing buttons.

**No workbook/router integration impact.** No changes to route order, workbook files, Google APIs, authentication, storage, work or address identities, saved route plans, or button logic.

## Checks and rollout
Focused check: `node --test tests/build-route-button-compact.test.js`. Final complete CI and first-party JavaScript syntax check on the final runtime head, per `TESTING_CONTRACT.md`. Quick live operator check: Build Route buttons are compact and not stretched, all remain legible and clickable on the current device; the top dropdown still expands, and moving between pages remains responsive. If readability suffers, revert the change or increase page-scoped spacing without touching any app behavior.
