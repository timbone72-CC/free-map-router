# Phase 3 Field Photo Design Audit

**Date:** 2026-08-27  
**Status:** DESIGN AUDIT — NO RUNTIME CODING AUTHORIZED  
**Change class:** Level 1 documentation-only analysis  
**Production FMR baseline:** `1ddce0581e15d73cb17a0004caf7afbf2e7a3f27`  
**Primary roadmap:** `docs/FIELD_WORK_EXPANSION_PLAN.md`  
**Phase 2 closeout:** `docs/2026-08-27_PHASE_2_PRODUCTION_COMPLETION_RECORD.md`

## Purpose

Determine the smallest safe path from the production-validated Phase 2 gig/route system into an HNP/manual work-order and field-photo workflow without creating a second job database, weakening `Gig_ID` identity, losing original evidence, or tying the design to the current personal Google Drive.

This is an audit/design record only. It changes no runtime code, storage schema, Drive file, permission, workbook data, deployment, or app behavior.

## Sources inspected

### Free Map Router repository

Current production contracts and runtime surfaces were reviewed, including:

- `AGENTS.md`
- `CONTRACT.md`
- `CHANGE_CONTROL_CONTRACT.md`
- `TESTING_CONTRACT.md`
- `INTEGRATION_CONTRACT.md`
- `REGRESSION_CHECKLIST.md`
- `docs/FIELD_WORK_EXPANSION_PLAN.md`
- `docs/PHASE_2_CROSS_SYSTEM_IMPLEMENTATION_RECORD_2026-08-23.md`
- `gig-contract.js`
- `manual-gigs.js`
- `backup.js`
- `google-drive.js`

Current production facts relevant to Phase 3:

- Manual gig schema is version 2 and is stored as small structured browser data keyed by immutable `Gig_ID` and `stopId`.
- Current gig fields cover source, work-order ID text, expected pay, notes, route inclusion, due/completed dates, and timestamps. There is no photo/evidence manifest, visit/capture session, line-item model, media state, or submission state.
- Manual-gig UI is owned by `manual-gigs.js` inside the existing Addresses surface.
- The app contract still protects the five top-level pages. Phase 3 must not casually add a sixth top-level page.
- Whole-app backup is JSON and currently contains Home, stops, gigs, and route history. It is recovery state, not a media archive and must not be expanded to carry full-resolution photo bytes.
- Browser Drive integration uses the limited `drive.file` scope and is intentionally pinned to the exact governed Free Map Router integration folder used for small app-owned JSON resources and workbook handoff.

### Field Photo Prep repository

Repository: `timbone72-CC/field-photo-prep`

- `main` currently contains only the initial README; there is no production Android runtime to depend on.
- The `docs/contract-foundation-20260823` branch contains an approved contract foundation.
- That contract protects originals as read-only source evidence, creates resized copies separately, preserves supported capture-time/GPS metadata when available, avoids loading a full-resolution batch into memory at once, and reports per-photo failures.
- Its initial scope explicitly excludes a job database, vendor-specific workflow, automatic upload, direct Google Drive API integration, and background synchronization.

Therefore Field Photo Prep can inform derivative-image handling, but Phase 3 cannot make Free Map Router depend on a Field Photo Prep runtime that does not yet exist.

### Google Drive operational evidence

The controlled company operations manual **Property Preservation Operations Manual — Volume 8 Photos, Client Submission, Quality Control, and Chargeback Prevention** was reviewed through the connected Google Drive.

The manual establishes several requirements that materially affect the design:

- the active work order and current client instructions control exact photo count, required views, allowed image type/size, date/time or GPS requirements, portal fields, and deadline;
- evidence is part of the work, not an after-the-fact clerical task;
- the field plan should identify required identity/access, exterior/interior, line-item, damage/measurement, notice, and final-secure evidence before travel;
- originals should be preserved because portals may compress, rename, reorder, or omit metadata;
- before/during/after evidence should remain distinguishable, with matching angles where practical;
- photo count alone does not prove coverage;
- photos should be mapped to the correct line item rather than submitted as an undifferentiated pile;
- field QC should occur before leaving when a return trip would be costly or impossible;
- later corrections or return visits must not overwrite the original submitted/evidence package.

The Drive account visible to this audit also contains a `Photos` folder under `04 - Media` owned by the historical personal account. That is useful evidence of current storage history, but it is **not** a suitable Phase 4 target because the roadmap requires new job-media design to avoid hard-wiring the personal account.

## Current architecture boundary

Phase 2 gives Phase 3 a strong identity foundation:

- `Gig_ID` is the manual work-item identity.
- `stopId` is the physical driving-stop attachment.
- work-order ID is metadata, not identity.
- `Gig_Log` is a workbook mirror/ledger and must not become a route-state or photo-byte store.
- Free Map Router owns the relationship between gig and route.
- InspectorADE prediction history remains isolated.

Phase 3 should build on that foundation rather than inventing a new address-based or work-order-text-based job identity.

## Audit finding 1 — Phase 3 cannot safely treat photo bytes like existing gig data

The current durable app data model is intentionally small JSON/browser state. Photo evidence is fundamentally different:

- full-resolution images are large binary objects;
- `localStorage` is not an appropriate durable photo store;
- the existing whole-app JSON backup is not a media archive;
- holding a large photo set only in volatile browser memory violates the roadmap requirement that closing/reopening must not lose accepted evidence;
- storing full photo bytes in the governed Free Map Router integration folder would mix job media with small workbook/app handoff resources and would hard-wire a storage decision before Phase 4 is approved.

**Conclusion:** Phase 3 work-order/evidence planning can proceed independently, but reliable photo acquisition cannot be declared complete until a durable media destination or a separately approved local durable-media strategy exists.

The leanest path is to split Phase 3 rather than invent a temporary photo store that Phase 4 later has to replace.

## Audit finding 2 — broad Inside/Outside buckets are not enough as the authoritative model

Inside/Outside can remain useful display groupings, but the operations manual shows that evidence may need to prove:

- property identity/access;
- individual exterior elevations/areas;
- individual interior rooms/systems;
- a specific work line item;
- before/during/after stages;
- damage plus measurement/context;
- notices, keys/lockbox, utilities, receipts, materials, disposal, or final secure condition.

A generic two-bucket model would make later line-item mapping and QC harder.

**Conclusion:** the underlying evidence requirement should carry a small category/line-item/stage identity even if the first UI groups those requirements into a few simple sections.

## Audit finding 3 — client requirements must be order-specific, not baked into HNP globally

The company manual explicitly makes the active order/current client instruction the higher authority. The repository does not currently contain verified HNP-specific image-size, metadata, or shot-count rules.

**Conclusion:** Phase 3 must not hard-code claims such as:

- HNP always accepts 60% resized photos;
- HNP never needs GPS;
- every HNP job uses the same shot list;
- all HNP work can be represented by only Inside/Outside photos.

Until current HNP requirements are supplied, the design should support an operator-entered or work-type-template evidence plan without pretending the template is the client contract.

## Audit finding 4 — original evidence and prepared copies need different roles

The operations manual says originals should be retained. Field Photo Prep's contract also treats originals as read-only evidence and resized files as separate derivative copies.

**Conclusion:** future media records should distinguish at least:

- original/source evidence;
- prepared/resized derivative;
- submitted/upload copy or package when different.

A derivative must never silently replace the original or erase capture metadata from the only retained evidence.

## Audit finding 5 — the current Free Map Router Drive folder is an integration resource, not automatically the job-media archive

`google-drive.js` currently pins the browser to the governed Free Map Router folder and limited `drive.file` behavior used by app backup, corrections, Manual Work, Address Inbox, Route Order, and Gig Handoff.

That exact-folder stabilization was just production-validated and should not be destabilized merely to begin photos.

**Conclusion:** Phase 3 should not place job photos in that folder by default. Phase 4 must define the business-owned media root, authorization path, privacy, retention, and folder creation rules before automatic media upload is introduced.

## Audit finding 6 — work-order view should fit inside the protected five-page app

The contract protects the five top-level pages:

- Home
- Addresses
- Import Addresses
- Build Route
- Settings

A sixth top-level page would be a separately approved navigation change.

**Design direction:** open a manual gig's work-order/evidence view as a bounded subview, panel, or job detail surface within the existing app navigation. A routed physical stop may contain more than one `Gig_ID`, so the UI must select the exact gig/work item rather than assuming one stop equals one job.

## Recommended Phase 3 ownership model

### Free Map Router owns

- exact `Gig_ID` job identity;
- work-order reference and current instruction snapshot/reference;
- visit/capture-session identity;
- evidence requirements/checklist;
- mapping from evidence requirement to exact gig/work item;
- field notes and exception/unable-to-complete notes that are part of the job workflow;
- collected/pending/verified evidence manifest state;
- job-level field QC state;
- route linkage.

### Google Drive eventually owns

- durable job-media files;
- original/source photos retained under the approved business-media design;
- derivative/prepared copies when retained;
- work-order attachments and final packages when Phase 4 approves them.

### Workbook owns

- existing `Gig_Log` mirror/ledger and workbook-owned `Actual_Pay`;
- no photo bytes;
- no transient route state;
- no requirement to infer photo-to-job identity from address.

### Field Photo Prep may later own

- local derivative preparation of operator-selected source photos under its own contract;
- no `Gig_ID` authority;
- no route/work-order lifecycle authority;
- no automatic Drive filing unless its contract is separately expanded.

## Proposed minimal evidence manifest

This is a **design sketch, not an approved storage schema**. Its purpose is to identify the minimum concepts Phase 3 needs before coding.

A gig-level manifest should be keyed by exact `Gig_ID` and should be able to represent:

- `gigId`
- current `workOrderId` reference
- one or more visit/capture-session IDs with local date/time context
- instruction source/reference or short operator-entered instruction snapshot
- evidence requirements, each with a stable requirement ID
- requirement category or work line item
- optional stage such as `before`, `during`, `after`, or `final`
- required versus optional
- collected asset references/count
- exception/waiver note when required evidence cannot be obtained
- field QC result
- timestamps used for stale-safe updates

Media asset descriptors should reference durable/local media rather than embed full photo bytes in the manifest. Future descriptors may need original/derivative role, capture metadata status, upload status, and Drive file identity after Phase 4.

Do not add fields merely because they might be useful someday. The final schema must be based on the first approved Phase 3 runtime slice.

## Recommended implementation sequence

### Phase 3A — Work-order/evidence plan and field QC shell

Design/implement only after separate runtime approval:

- open exact gig/work-item details from Manual Gigs and/or a routed manual-gig stop;
- show current gig fields and work-order ID;
- allow a small order-specific evidence checklist/plan;
- distinguish categories/line items and before/during/after stage where required;
- record exception/unable-to-complete notes;
- provide field QC that shows missing required evidence requirements;
- do **not** store photo bytes yet;
- do **not** add automatic Drive upload;
- do **not** add a sixth top-level page.

This creates the job/evidence ownership model before introducing binary media.

### Phase 4A prerequisite — Business media destination

Before Phase 3 can claim recoverable photo acquisition, approve:

- exact business Google account/folder ownership;
- media root folder identity;
- authorization method;
- private-by-default sharing/access;
- folder naming and duplicate/retry behavior;
- original versus prepared-copy retention;
- retention/deletion/legal-hold policy;
- upload verification and stale-safe retry rules.

### Phase 3B — Photo acquisition tied to the exact evidence requirement

Only after durable media strategy is approved:

- capture or select a photo for a specific `Gig_ID` + requirement + visit/session;
- preserve source/original evidence;
- record metadata status without inventing missing values;
- write/queue media durably before reporting it safe;
- keep failed/offline upload visible and retryable;
- prevent another property/gig's photo from being silently attached;
- preserve later-visit/correction separation.

### Phase 3C — Evidence-completeness gate

After real capture/upload behavior exists:

- compare required evidence to collected evidence;
- do not mark an evidence package ready when required items are missing unless an explicit truthful exception is recorded;
- verify critical image readability/orientation where technically practical;
- retain enough audit state to distinguish original visit, correction visit, and resubmission package.

## Decisions required before Phase 3 runtime

1. **HNP photo requirements** — provide a current HNP work order/instruction example or confirm the actual image-size, count, metadata, and shot-list rules in use.
2. **Work-order source** — decide whether the first version uses manual entry/paste, attached file, text-message transcription, or another import path.
3. **First evidence templates** — decide whether Phase 3A begins with operator-created per-job requirements only or also includes a few reusable work-type templates such as winterization, grass cut, and secure/lock change.
4. **Capture path** — decide whether the first photo-enabled slice selects existing Android camera photos or launches camera capture from the job view.
5. **Business Drive media root** — choose/approve the exact business-owned destination before automatic media upload.
6. **Original/derivative retention** — decide whether Drive keeps originals + prepared copies, originals + ZIP, or originals + prepared copies + ZIP.
7. **Retention period** — establish the operational retention rule by client/record type and legal/chargeback hold behavior.
8. **Field Photo Prep relationship** — keep it independent/optional unless a later explicit handoff contract is approved.

## What does not need a decision yet

Do not block Phase 3A design on:

- Play Store publication;
- advanced AI photo classification;
- automatic vendor portal submission;
- background push notifications;
- a full paid/unpaid lifecycle redesign;
- DCFS payroll timing;
- migrating every historical photo from the personal Drive.

Those are separate concerns.

## Protected behavior for future Phase 3 work

Any later runtime implementation must preserve:

- immutable `Gig_ID` as gig/work identity;
- one physical driving stop even when several gigs share the address;
- exact workbook Order-ID separation;
- InspectorADE prediction/history isolation;
- workbook ownership of `Actual_Pay`;
- existing Manual Work Library and address-correction ownership boundaries;
- visible manual **Include in Route** state;
- Basic and Google route choices;
- current route-pay semantics;
- mixed Google Print identity behavior;
- governed Free Map Router integration Drive folder and current limited permission unless a later approved media design explicitly changes the permission model;
- existing five-page top-level navigation unless separately approved;
- original photo protection and truthful evidence handling.

## Audit conclusion

Phase 3 is ready for **design planning**, but not yet for photo runtime implementation.

The strongest next move is not to build a camera uploader immediately. It is to define and validate the exact gig-level work-order/evidence manifest and its field QC flow, while collecting one or more real current HNP instruction examples. Photo capture should then be introduced together with an approved durable business-media strategy rather than temporarily storing critical evidence in volatile browser state or the existing Free Map Router integration folder.

No runtime coding is authorized by this audit.