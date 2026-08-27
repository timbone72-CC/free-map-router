# Phase 2 Production Completion Record

**Date:** 2026-08-27  
**Status:** COMPLETE — PRODUCTION VALIDATED / REAL-WORK SOAK ACTIVE  
**Change class:** Level 1 documentation-only closeout  
**Primary roadmap:** `docs/FIELD_WORK_EXPANSION_PLAN.md`

## Purpose

Record the actual completed Phase 2 state after production rollout so the older design record does not remain the only durable description of the work.

`docs/PHASE_2_CROSS_SYSTEM_IMPLEMENTATION_RECORD_2026-08-23.md` remains preserved as historical design evidence. Its original status and its statement that Phase 2E was deferred describe the state on 2026-08-23, not the current production state. This completion record is the current Phase 2 status reference.

No runtime, workbook data, Drive data, permissions, schemas, or deployment configuration are changed by this document.

## Final production baselines

### InspectorADE workbook

Repository: `timbone72-CC/inspectorade-drop-forecast-workbook-audit`  
Governed branch: `audit/fix-codex-findings`  
Phase 2 production merge: `f3016071e2602357c443524b4290c9569bee184d`  
Production Apps Script ID: `1juRMJPgSGC1A8ciPtdfHfkmapWoSZJYX_NWoPuvT-aktScZbg-ivVuoF`

The production Apps Script was pushed from the exact governed merge worktree. The push reported 41 tracked Apps Script/HTML files and completed successfully.

### Free Map Router

Repository: `timbone72-CC/free-map-router`  
Production branch: `main`  
Phase 2 production merge: `1ddce0581e15d73cb17a0004caf7afbf2e7a3f27`  
Approved PR head before merge: `6fdae59b99bd7a9c7130c514973898e1a251f7a4`  
PR: #67

GitHub verification on the approved head passed. The `main` push verification and GitHub Pages build/deployment for the merge commit also completed successfully.

## Governed Drive handoff

The rollout retained the existing limited `drive.file` scope and the existing governed Free Map Router integration resources.

Governed folder ID:

`1DEqVNh2-Z8RkzMftxd4vOxsahRwD3mvf`

Key governed handoff files remained the same exact resources, including:

- Address Inbox: `127uw7iFcuznTEbehSm82Y3t01a4jHtPB`
- Route Order: `1o8JsSBnGC3BcR3JsL4589eb06fNVQBe6`
- Gig Handoff: `1qCyFFQmrxBN_SM-g3ZNS6172oPU201PZ`
- Manual Work: `1rP8MuuNECdpmJcjlY-f2l9_ZUNWPeyTO`

No ownership transfer was part of Phase 2. The approved company account and runtime service account retained writer access to the governed integration resources.

## Phase 2A — Gig due/completed dates

Completed behavior:

- manual gig schema supports optional due and completed local calendar dates;
- valid older gigs migrate without changing immutable `Gig_ID` identity or existing gig fields;
- invalid dates fail closed under the gig validation model;
- **Complete Today** uses the local calendar date;
- editing gig details preserves identity and route-selection state.

## Phase 2B — Combined expected route pay

Completed behavior:

- workbook Address Inbox can carry optional InspectorADE expected-pay metadata while keeping `inboxVersion: 1`;
- route history preserves workbook pay metadata with the exact route snapshot/stop;
- Build Route shows InspectorADE known pay, manual-gig known pay, total known pay, and **Pay incomplete** when any represented pay is unknown;
- blank manual expected pay remains unknown and is not silently converted to `$0`;
- exact job and gig identities remain separate from pay metadata.

## Phase 2C — Gig handoff and workbook `Gig_Log`

Completed behavior:

- FMR exposes explicit **Sync Gigs to Workbook**; there is no automatic gig handoff write;
- Gig Handoff uses one governed Drive file and exact `Gig_ID` values;
- workbook `Gig_Log` mirrors FMR-owned gig fields and preserves workbook-owned `Actual_Pay`;
- newer FMR rows update by exact `Gig_ID`; older handoff rows are skipped; ambiguous same-timestamp differences fail closed;
- gig sync does not write InspectorADE prediction history or reinterpret addresses/work-order text as gig identity.

Sandbox reality-gate evidence imported five governed gig records into `Gig_Log` with exact identities while `Actual_Pay` remained blank/preserved and no transient route state was added to the ledger.

## Phase 2D — Weekly expected pay

The Phase 2 workbook design established separate expected-pay scheduling rules while preserving existing Dashboard meanings. HNP and GIS use derived weekly work periods/paydays rather than stored payroll-period fields. DCFS remains unconfigured until evidence establishes its rule.

This reporting surface is not used as identity and does not change `Gig_ID`, InspectorADE `Source_ID`, route membership, or prediction history.

## Phase 2E — Mixed route return and Google Print gig details

Phase 2E is complete and production-deployed.

Implemented route return contract:

- route-order version remains `1`;
- a physical stop may return exact workbook `orderIds`, exact manual `gigIds`, or both;
- FMR never invents workbook IDs from address text;
- workbook exact-validates routed gig IDs against healthy `Gig_Log` before rendering;
- routed gig context is transient and is not persisted into `Gig_Log`;
- existing InspectorADE card rendering is preserved;
- manual gig cards show source, corrected route address, work-order ID, expected pay, due/completed dates, notes, exact Gig ID, and written-notes space;
- blank expected pay renders visibly as unknown rather than `$0`;
- shared physical stops share the visible stop number.

### Cross-system mixed reality gate

The safe mixed test used:

- InspectorADE Order ID `112008694` at `927 SW 35TH ST, Lawton, OK 73505`;
- manual Gig ID `gig_9fba1239-a9cb-42c9-8db1-612580226b7c` at `123 Anywhere DR, Elk City, OK 73644`.

The governed Route Order contained the workbook Order ID only on the InspectorADE stop and the exact Gig ID only on the manual stop. The InspectorADE Live Sandbox receiver reported **1 workbook job and 1 manual gig** and rebuilt the mixed Google Doc.

The resulting manual card showed **Pay unknown**, source **OTHER**, the exact Gig ID, completed date `2026-08-24`, and notes `Mow grass`. `Gig_Log` remained a ledger and did not gain route/stop columns or transient route state.

## Manual-gig route-selection UX

During the Phase 2E reality gate, the operator identified that route inclusion was too hidden when it could only be changed through Edit.

The approved Level 2 correction added a visible **Include in Route** checkbox beside every saved manual gig:

- checked means that gig contributes its physical stop to both saved route versions;
- unchecked means that gig does not contribute route membership;
- ordinary new gigs start unchecked;
- normal gig edits preserve the current route choice;
- shared physical-stop protection remains intact.

The checkbox behavior passed focused tests, the full FMR suite, browser-local smoke testing, and final live production verification.

## Drive identity stabilization

Phase 2 production also removed the old browser Drive dependency on name-based `Free Map Router` folder lookup for the governed integration paths.

Current behavior:

- browser Drive paths use the exact governed folder ID;
- normal operation does not auto-create a replacement integration folder;
- duplicate-name ambiguity no longer determines the governed folder;
- the existing `drive.file` scope is unchanged;
- temporary 429/5xx folder-verification failures preserve a valid cached Drive session and ask the operator to retry the current Drive action rather than forcing irrelevant route-order recovery;
- browser cache keys were bumped so the corrected Drive runtime and checkbox UI publish cleanly.

## Production verification

The ordered rollout followed the companion-first requirement.

1. Workbook PR #21 merged into the governed workbook branch.
2. The exact workbook merge was pushed to the production Apps Script project.
3. LIVE workbook **Send Checked Jobs to Free Map Router** reported 13 checked addresses sent.
4. The same governed Address Inbox file ID was updated in place from source `InspectorADE Repeat Job Predictor - LIVE`.
5. FMR PR #67 merged only after the workbook production side passed.
6. GitHub Pages published the FMR merge successfully.
7. With browser Local Overrides closed, the live app displayed **Include in Route** beside every manual gig.
8. Live **Check Workbook Route** displayed **New Route Available — 13 jobs**, matching the governed LIVE Address Inbox.

## Protected boundaries preserved

Phase 2 completion did not:

- merge manual gigs into InspectorADE prediction history;
- use address or work-order text as gig identity;
- make `Actual_Pay` FMR-owned;
- add route/stop fields to `Gig_Log`;
- broaden Google Drive permission scope;
- transfer governed Drive ownership;
- add automatic gig sync;
- change the five-page FMR navigation;
- modify R6 conflict reconciliation.

## Soak status

Phase 2 is complete but remains under controlled real-work observation while Phase 3 is designed.

Watch for:

- stale or conflicting gig handoffs;
- route-membership surprises;
- route-pay mismatches;
- wrong Order-ID/Gig-ID associations;
- mixed-print omissions;
- transient Drive failures;
- cross-device overwrites.

A soak finding is not automatic authorization to change runtime behavior. Any fix uses the governing change-control process.

## Next phase

Phase 3 design audit has started. No Phase 3 runtime coding is authorized by this closeout.

Primary audit record:

`docs/2026-08-27_PHASE_3_FIELD_PHOTO_DESIGN_AUDIT.md`
