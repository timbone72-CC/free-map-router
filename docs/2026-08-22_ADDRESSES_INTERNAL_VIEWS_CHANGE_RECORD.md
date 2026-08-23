# Addresses Internal Views — Level 2 Change Record

**Date:** 2026-08-22  
**Repository:** `timbone72-CC/free-map-router`  
**Branch:** `work/addresses-internal-views-20260822`  
**Rollback commit:** `dec3e020925bfa5bef1eaba24c6e8d23dee17e74`  
**Change level:** Level 2 — normal page interaction and list presentation

## Problem

The Addresses page now stacks address entry, manual gig entry/list, Manual Work Library, archived properties, and the full saved-address list into one long scrolling surface. As ADE jobs and manual work accumulate, routine use becomes unnecessarily long and difficult to navigate.

## Approved behavior

Keep the existing five top-level pages unchanged. Inside **Addresses**, expose four internal views:

- **Add / Edit** — physical address form only;
- **Manual Gigs** — manual-gig form and gig occurrences;
- **Work Library** — permanent reusable manual properties and Sync Library;
- **Saved Addresses** — the existing saved-address list and controls.

Only one large internal Addresses view is visible at a time. Archived Manual Work Library properties are hidden by default and can be revealed with an explicit **Show Archived** control. No property, gig, route, address, Drive record, or workbook data changes merely because an internal view or Show Archived control is used.

## Owning files

- `index.html` — Addresses internal-view structure and controls.
- `styles.css` — internal-view presentation only.
- `manual-gigs.js` — marks rendered Manual Work Library rows as active or archived so presentation can hide archived rows without changing library data.
- focused tests — protect the internal-view structure, archived-default behavior, and existing five-page contract.

## Read/write surfaces

Reads existing DOM state and the already-rendered property `archived` flag. The cleanup adds no stored state, no localStorage key, no Drive read/write, no route write, no workbook write, and no schema change.

## Protected behavior

- exactly five top-level pages and current page order;
- all existing address, gig, library, route-selection, archive/restore, and Drive-sync actions;
- Manual Work Library archive state remains durable and unchanged;
- archived properties remain recoverable with Restore when Show Archived is enabled;
- ADE address corrections and workbook handoff remain unchanged;
- no sixth page, timer, polling loop, observer, new permission, or automatic route addition.

## Focused verification

- Addresses contains exactly four internal choices and defaults to Saved Addresses.
- Selecting an internal choice reveals only its corresponding large pane by native HTML/CSS state.
- Manual Gig Edit remains in the same Manual Gigs view as the gig form.
- archived library rows are tagged for presentation, hidden while Show Archived is off, and visible when it is on.
- top-level page menu remains unchanged.

## Risks

Primary risk is accidentally hiding or relocating a protected control. No data-layer or Drive-layer risk is introduced.

## Smoke check after publication

1. Open Addresses and confirm Saved Addresses is shown without the other long lists.
2. Switch through Add / Edit, Manual Gigs, Work Library, and Saved Addresses.
3. Confirm existing saved addresses and manual gigs are unchanged.
4. In Work Library, confirm active properties are visible and archived properties are hidden until Show Archived is enabled.
5. Show Archived, restore one disposable archived property, then confirm it returns to the active list.
6. Navigate to Build Route and back; confirm the app remains responsive.

**No workbook/router integration impact.**