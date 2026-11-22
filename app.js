// Free Map Router — V2 (Vanilla)
// Address-first localStorage + stop CRUD + route selection rendering
// Optimize Route: nearest-neighbor from verified Home IF all points have coords
// Export: Google Maps Directions URL in the current route order
// CSV Import: file picker + pasted CSV text, de-dupe by physical address, coords optional
// Drag/drop: global drop handler for CSV files (Windows File Explorer works best)
// Address suggestions: offline-only datalist from saved stops

// ============================================================================
// SECTION 1 — Storage Contract
// ============================================================================
if (!globalThis.FMRContract) {
    throw new Error("Free Map Router contract failed to load.");
}

if (!globalThis.FMRGigContract) {
    throw new Error("Free Map Router gig contract failed to load.");
}

if (!globalThis.FMRGeocoder) {
    throw new Error("Free Map Router geocoder failed to load.");
}

if (!globalThis.FMRRouting) {
    throw new Error("Free Map Router routing failed to load.");
}

if (!globalThis.FMRSettings) {
    throw new Error("Free Map Router settings failed to load.");
}

if (!globalThis.FMRInbox) {
    throw new Error("Free Map Router workbook inbox failed to load.");
}

if (!globalThis.FMRAddressCorrections) {
    throw new Error("Free Map Router address corrections failed to load.");
}

if (!globalThis.FMRAddressFilters) {
    throw new Error("Free Map Router address filters failed to load.");
}

if (!globalThis.FMRRouteHistory) {
    throw new Error("Free Map Router route history failed to load.");
}
if (!globalThis.FMRAssumedRouteLocation) {
    throw new Error("Free Map Router assumed location failed to load.");
}

if (!globalThis.FMRRouteOrder) {
    throw new Error("Free Map Router route order failed to load.");
}

const {
    applyStopEdit,
    normalizeAddress,
    addressKey,
    normalizeStop,
    readStops,
    writeStops,
    readHome,
    writeHome,
} = globalThis.FMRContract;
const { readGigs } = globalThis.FMRGigContract;

const {
    findAddress,
    findAddressWithGeoapify,
    mapUrl,
} = globalThis.FMRGeocoder;
const {
    buildGoogleMapsDirectionsUrl,
    buildGoogleMapsNavigationUrl,
    buildGoogleMapsRouteSections,
    optimizeRoundTripOrder,
} = globalThis.FMRRouting;
const {
    maskedKey,
    readGeoapifyKey,
    updateApp,
    writeGeoapifyKey,
} = globalThis.FMRSettings;
const {
    backupFilename,
    createBackup,
    parseBackup,
} = globalThis.FMRBackup;
const {
    applyAddressInbox,
    formatInboxImportStatus,
    isAddressInboxExportedToday,
    parseAddressInbox,
} = globalThis.FMRInbox;
const {
    addStreetCorrectionRule,
    applyCorrectionsToInbox,
    createCorrectionRecord,
    effectiveStreetRules,
    mergeCorrectionRecords,
    proposeStreetCorrection,
    removeStreetCorrectionRules,
    streetDecisionForAddress,
    parseCorrectionRecord,
    savedAddressSuggestions,
} = globalThis.FMRAddressCorrections;
const {
    completeActivePlanStop,
    readRouteHistory,
    remapRouteStopIds,
    replaceRoute,
    setRouteOptimizationStatus,
    stageWorkbookRoute,
    startPendingRoute,
    summarizeRouteExpectedPay,
    workbookRouteRelation,
    writeRouteHistory,
} = globalThis.FMRRouteHistory;
const {
    buildWorkbookRouteOrder,
    workbookOrderIdCount,
} = globalThis.FMRRouteOrder;
const {
    createLatestDriveSaveQueue,
    currentDriveToken,
    loadAddressCorrectionsFromDrive,
    loadAddressInboxFromDrive,
    loadBackupFromDrive,
    requestDriveToken,
    saveAddressCorrectionsToDrive,
    saveBackupToDrive,
    saveRouteOrderToDrive,
} = globalThis.FMRGoogleDrive;

// ============================================================================
// SECTION 2 — Utilities
// ============================================================================
function uid() {
    return (
        "job_" +
        Math.random().toString(16).slice(2) +
        "_" +
        Date.now().toString(16)
    );
}

function writeJobs(nextJobs) {
    jobs = writeStops(localStorage, nextJobs);
    return jobs;
}

function toNumberOrNull(v) {
    const s = (v ?? "").toString().trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

function isValidCoordinatePair(latitude, longitude) {
    return (
        latitude !== null &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude !== null &&
        longitude >= -180 &&
        longitude <= 180
    );
}

// ============================================================================
// SECTION 4 — CSV Parsing + Import
// ============================================================================
function parseCsvLine(line) {
    // Handles commas inside quotes
    const out = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];

        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                // escaped quote
                cur += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (ch === "," && !inQuotes) {
            out.push(cur);
            cur = "";
            continue;
        }

        cur += ch;
    }

    out.push(cur);
    return out.map((s) => s.trim());
}

function parseCsvText(csvText) {
    const lines = (csvText || "").split(/\r?\n/).map((l) => l.trimEnd());
    const nonEmpty = lines.filter((l) => l.trim().length > 0);
    if (nonEmpty.length === 0) return { headers: [], rows: [] };

    const headers = parseCsvLine(nonEmpty[0]).map((h) => h.trim());
    const rows = [];

    for (let i = 1; i < nonEmpty.length; i++) {
        const cols = parseCsvLine(nonEmpty[i]);
        const row = {};
        for (let c = 0; c < headers.length; c++) {
            row[headers[c]] = cols[c] ?? "";
        }
        rows.push(row);
    }

    return { headers, rows };
}

function pickFirst(row, keys) {
    for (const k of keys) {
        if (row[k] != null && String(row[k]).trim() !== "")
            return String(row[k]).trim();
    }
    return "";
}

function buildAddressFromRow(row) {
    const a1 = pickFirst(row, ["MappingAddress1", "Address1", "Address"]);
    const a2 = pickFirst(row, ["MappingAddress2", "Address2"]);
    const city = pickFirst(row, ["MappingCity", "City"]);
    const state = pickFirst(row, ["MappingState", "State"]);
    const zip = pickFirst(row, ["MappingZip", "Zip"]);

    const parts = [];
    if (a1) parts.push(a1);
    if (a2) parts.push(a2);

    const cityStateZip = [city, state, zip].filter(Boolean).join(" ");
    if (cityStateZip) parts.push(cityStateZip);

    return parts.join(", ").trim();
}

function importJobsFromRows(rows) {
    // De-dupe by normalized physical address only.
    const existing = jobs.slice();
    const seen = new Set(existing.map((j) => addressKey(j.address)));

    let added = 0;

    for (const row of rows) {
        const label = pickFirst(row, [
            "Label",
            "label",
            "Client",
            "Company",
            "company",
            "client",
        ]);

        const address = normalizeAddress(buildAddressFromRow(row));
        if (!address) continue;

        const latRaw = pickFirst(row, ["Latitude", "Lat", "latitude"]);
        const lonRaw = pickFirst(row, ["Longitude", "Lon", "Lng", "longitude"]);

        const latitude = toNumberOrNull(latRaw);
        const longitude = toNumberOrNull(lonRaw);

        // keep only if BOTH exist
        const latOk = latitude != null;
        const lonOk = longitude != null;

        const coordLat = latOk && lonOk ? latitude : null;
        const coordLon = latOk && lonOk ? longitude : null;

        // Notes: keep existing Notes field or build from common columns
        const notesDirect = pickFirst(row, ["Notes", "notes", "Note", "note"]);
        const srcID = pickFirst(row, ["ID", "Id", "JobId", "jobId", "srcID"]);
        const order = pickFirst(row, ["Order", "order"]);
        const work = pickFirst(row, ["Work", "work", "Type", "type"]);

        let notes = notesDirect;
        if (!notes) {
            const parts = [];
            if (srcID) parts.push(`ID:${srcID}`);
            if (order) parts.push(`Order:${order}`);
            if (work) parts.push(`Work:${work}`);
            notes = parts.join(" | ");
        }

        const key = addressKey(address);
        if (seen.has(key)) continue;

        seen.add(key);

        const stop = normalizeStop({
            id: uid(),
            label,
            address,
            latitude: coordLat,
            longitude: coordLon,
            notes: notes || "",
        });
        if (stop) existing.push(stop);

        added++;
    }

    jobs = existing;
    writeJobs(jobs);
    renderAll();

    return added;
}

function importJobsFromCsvText(csvText) {
    const parsed = parseCsvText(csvText);
    if (!parsed.rows.length) {
        alert("No rows found in CSV.");
        return;
    }
    const added = importJobsFromRows(parsed.rows);
    alert(`Imported ${added} new addresses (de-duplicated by address).`);
}

// ============================================================================
// SECTION 5 — State
// ============================================================================
const initialRead = readStops(localStorage);
let jobs = initialRead.stops;
let home = readHome(localStorage);
let routeHistory = readRouteHistory(
    localStorage,
    new Set(jobs.map((job) => job.id)),
);
let activeRouteSlot = "google";
const optimizerFeedbackByRoute = { google: "", basic: "" };
let routeIds = routeHistory.google?.routeIds.slice() || [];
let editingJobId = null;
let routeEditReturnStopId = null;
let streetCorrectionRecord = createCorrectionRecord([], new Date(0));
let correctionWriteQueue = Promise.resolve();
let formPinStatus = "unverified";
let locationMap = null;
let locationMarker = null;
let homeLocationMap = null;
let homeLocationMarker = null;
let homeDraftLatitude = null;
let homeDraftLongitude = null;
let homeDraftPinStatus = "unverified";
let driveSaveRevision = 0;
let driveInboxSyncPromise = null;
let routeOrderSendPromise = null;
let googleInsertionBusy = false;
let pendingAssumedRouteLocation = null;
const driveSaveQueue = createLatestDriveSaveQueue(saveBackupToDrive);

function savedJobIds() {
    return new Set(jobs.map((job) => job.id));
}

function persistRouteSlot(slot, nextRouteIds, optimizationStatus = null) {
    routeHistory = replaceRoute(
        routeHistory,
        slot,
        nextRouteIds,
        savedJobIds(),
    );
    if (optimizationStatus) {
        routeHistory = setRouteOptimizationStatus(
            routeHistory,
            slot,
            optimizationStatus,
            savedJobIds(),
        );
    }
    routeHistory = writeRouteHistory(
        localStorage,
        routeHistory,
        savedJobIds(),
    );
    if (activeRouteSlot === slot) {
        routeIds = routeHistory[slot]?.routeIds.slice() || [];
        if (els?.workbookRouteOrderStatus) {
            els.workbookRouteOrderStatus.textContent = "";
        }
    }
}

function persistActiveRoute(optimizationStatus = null) {
    persistRouteSlot(activeRouteSlot, routeIds, optimizationStatus);
}

function markRouteManuallyChanged() {
    if (routeIds.length === 0) return "not_optimized";
    const status = routeHistory[activeRouteSlot]?.optimizationStatus;
    if (
        status === "basic_optimized" ||
        status === "google_optimized" ||
        status === "manually_changed"
    ) {
        return "manually_changed";
    }
    return null;
}

function reverseSelectedRoute() {
    if (routeIds.length < 2 || routeOrderSendPromise) return false;
    const previousRouteIds = routeIds.slice();
    routeIds = routeIds.slice().reverse();
    try {
        persistActiveRoute("manually_changed");
    } catch (error) {
        routeIds = previousRouteIds;
        renderRouteList();
        if (els.routeStatus) {
            els.routeStatus.textContent =
                error?.message || "Could not reverse the selected route.";
        }
        return false;
    }
    renderRouteList();
    if (els.routeStatus) {
        els.routeStatus.textContent =
            `${activeRouteSlot === "basic" ? "Basic Route" : "Google Route"} reversed — ${routeIds.length} stops.`;
    }
    return true;
}

function filterRoutesForSavedJobs() {
    routeHistory = writeRouteHistory(
        localStorage,
        routeHistory,
        savedJobIds(),
    );
    routeIds = routeHistory[activeRouteSlot]?.routeIds.slice() || [];
}

function restoreRoutes(routes) {
    routeHistory = writeRouteHistory(localStorage, routes, savedJobIds());
    activeRouteSlot = "google";
    routeIds = routeHistory.google?.routeIds.slice() || [];
}

function activateRouteSlot(slot) {
    activeRouteSlot = slot === "basic" ? "basic" : "google";
    routeIds = routeHistory[activeRouteSlot]?.routeIds.slice() || [];
    renderJobsList();
    renderRouteList();
    renderRouteChoice();
}

// ============================================================================
// SECTION 6 — DOM
// ============================================================================
const els = {
    // page navigation
    pageMenu: document.getElementById("pageMenu"),
    appPages: document.querySelectorAll(".appPage"),

    // home
    homeForm: document.getElementById("homeForm"),
    homeAddress: document.getElementById("homeAddress"),
    homeStatus: document.getElementById("homeStatus"),
    findHomeLocation: document.getElementById("findHomeLocation"),
    homeLocationStatus: document.getElementById("homeLocationStatus"),
    homeLocationMap: document.getElementById("homeLocationMap"),

    // settings
    settingsForm: document.getElementById("settingsForm"),
    geoapifyKey: document.getElementById("geoapifyKey"),
    geoapifyKeyStatus: document.getElementById("geoapifyKeyStatus"),
    clearGeoapifyKey: document.getElementById("clearGeoapifyKey"),
    updateApp: document.getElementById("updateApp"),
    updateAppStatus: document.getElementById("updateAppStatus"),
    downloadBackup: document.getElementById("downloadBackup"),
    restoreBackup: document.getElementById("restoreBackup"),
    backupFile: document.getElementById("backupFile"),
    backupStatus: document.getElementById("backupStatus"),
    backupGoogleDrive: document.getElementById("backupGoogleDrive"),
    restoreGoogleDrive: document.getElementById("restoreGoogleDrive"),
    googleDriveStatus: document.getElementById("googleDriveStatus"),
    addressCorrectionStatus: document.getElementById("addressCorrectionStatus"),
    manageStreetCorrections: document.getElementById("manageStreetCorrections"),
    streetCorrectionManageStatus: document.getElementById("streetCorrectionManageStatus"),
    streetCorrectionManagePanel: document.getElementById("streetCorrectionManagePanel"),
    streetCorrectionRuleChoice: document.getElementById("streetCorrectionRuleChoice"),
    removeSelectedStreetCorrection: document.getElementById("removeSelectedStreetCorrection"),
    closeStreetCorrectionManage: document.getElementById("closeStreetCorrectionManage"),
    googleDriveInboxStatus: document.getElementById("googleDriveInboxStatus"),

    // import
    csvFile: document.getElementById("csvFile"),
    importCsvBtn: document.getElementById("importCsvBtn"),
    csvText: document.getElementById("csvText"),
    importCsvTextBtn: document.getElementById("importCsvTextBtn"),
    dropHint: document.getElementById("dropHint"),

    // address suggestions
    addressSuggestions: document.getElementById("addressSuggestions"),

    // job form
    jobForm: document.getElementById("jobForm"),
    address: document.getElementById("address"),
    label: document.getElementById("label"),
    latitude: document.getElementById("latitude"),
    longitude: document.getElementById("longitude"),
    notes: document.getElementById("notes"),
    findLocation: document.getElementById("findLocation"),
    locationPreview: document.getElementById("locationPreview"),
    locationStatus: document.getElementById("locationStatus"),
    locationMap: document.getElementById("locationMap"),

    // lists
    jobList: document.getElementById("jobList"),
    addressSearch: document.getElementById("addressSearch"),
    addressSourceFilter: document.getElementById("addressSourceFilter"),
    addressTownFilter: document.getElementById("addressTownFilter"),
    addressCountyFilter: document.getElementById("addressCountyFilter"),
    addressFilterCount: document.getElementById("addressFilterCount"),
    routeList: document.getElementById("routeList"),
    reverseRoute: document.getElementById("reverseRoute"),
    routeChoice: document.getElementById("routeChoice"),
    googleInsertStopSearch: document.getElementById("googleInsertStopSearch"),
    googleInsertStopCity: document.getElementById("googleInsertStopCity"),
    googleInsertStopCounty: document.getElementById("googleInsertStopCounty"),
    googleInsertStopChoice: document.getElementById("googleInsertStopChoice"),
    googleInsertStop: document.getElementById("googleInsertStop"),
    routePage: document.getElementById("routePage"),
    checkWorkbookRoute: document.getElementById("checkWorkbookRoute"),
    workbookRouteCheckStatus: document.getElementById("workbookRouteCheckStatus"),
    routeOptimizationStatus: document.getElementById(
        "routeOptimizationStatus",
    ),
    routePaySummary: document.getElementById("routePaySummary"),
    sendRouteOrder: document.getElementById("sendRouteOrder"),
    workbookRouteOrderStatus: document.getElementById(
        "workbookRouteOrderStatus",
    ),
    newRouteAvailable: document.getElementById("newRouteAvailable"),
    newRouteAvailableStatus: document.getElementById(
        "newRouteAvailableStatus",
    ),
    startNewRoute: document.getElementById("startNewRoute"),
    routeStatus: document.getElementById("routeStatus"),
    routeOptimizeFeedback: document.getElementById("routeOptimizeFeedback"),
    routeMapLinks: document.getElementById("routeMapLinks"),
    clearRoute: document.getElementById("clearRoute"),
    startRouteNavigation: document.getElementById("startRouteNavigation"),
    completeAndNavigateNext: document.getElementById(
        "completeAndNavigateNext",
    ),
    assumedRouteLocationStatus: document.getElementById("assumedRouteLocationStatus"),
    assumedRouteLocationDialog: document.getElementById("assumedRouteLocationDialog"),
    assumedRouteLocationAddress: document.getElementById("assumedRouteLocationAddress"),
    assumedRouteLocationDescription: document.getElementById("assumedRouteLocationDescription"),
    assumedRouteLocationContinue: document.getElementById("assumedRouteLocationContinue"),
    assumedRouteLocationCancel: document.getElementById("assumedRouteLocationCancel"),

    // actions
    optimizeRoute: document.getElementById("optimizeRoute"),
    exportRoute: document.getElementById("exportRoute"),
};

function showPage(pageName) {
    const validPages = new Set([
        "home",
        "addresses",
        "import",
        "route",
        "settings",
    ]);
    const nextPage = validPages.has(pageName) ? pageName : "home";

    els.appPages.forEach((page) => {
        page.hidden = page.dataset.page !== nextPage;
    });

    if (els.pageMenu) {
        els.pageMenu.value = nextPage;
    }

    window.scrollTo({ top: 0, behavior: "instant" });
}

// ============================================================================
// SECTION 7 — Selection Controls (Select All / Clear / Delete Selected)
//  - Select All: adds filtered jobs to the routeIds selection
//  - Clear: clears routeIds only (does not delete jobs)
//  - Delete Selected: deletes jobs currently selected (checked) with confirmation,
//    then clears routeIds
// ============================================================================
function clearRouteSelection() {
    routeIds = [];
    persistActiveRoute("not_optimized");
    renderJobsList();
    renderRouteList();
    if (els.routeStatus) {
        els.routeStatus.textContent =
            "Route cleared. Saved addresses were kept.";
    }
}

function deleteAllAddresses() {
    if (jobs.length === 0) {
        alert("No saved addresses to delete.");
        return;
    }

    const ok = confirm(
        `Delete all ${jobs.length} saved address(es) from this app? ` +
            "This clears Build Route but does not delete workbook or Google Doc history. " +
            "Restore a backup or import the jobs again to bring them back.",
    );
    if (!ok) return;

    jobs = [];
    routeIds = [];
    routeHistory = { google: null, basic: null, pending: null };
    routeHistory = writeRouteHistory(
        localStorage,
        routeHistory,
        savedJobIds(),
    );
    activeRouteSlot = "google";
    editingJobId = null;
    writeJobs(jobs);
    resetForm();
    renderAll();
    if (els.routeStatus) {
        els.routeStatus.textContent =
            "All saved addresses were deleted from this app.";
    }
}

function deleteSelectedJobs() {
    if (routeIds.length === 0) {
        alert("No addresses selected to delete.");
        return;
    }

    const ok = confirm(
        `Delete ${routeIds.length} selected address(es)? This cannot be undone.`,
    );
    if (!ok) return;

    const selectedSet = new Set(routeIds);

    // If editing one of the selected, exit edit mode first
    if (editingJobId && selectedSet.has(editingJobId)) {
        editingJobId = null;
        if (els.jobForm) els.jobForm.reset();
    }

    // Delete from jobs
    jobs = jobs.filter((j) => !selectedSet.has(j.id));

    // Clear route selection
    routeIds = [];

    writeJobs(jobs);
    persistActiveRoute("not_optimized");
    filterRoutesForSavedJobs();
    renderAll();
}

function ensureSelectionControls() {
    if (!els.jobList) return;

    // Single-instance guard
    if (document.getElementById("fmrSelectionControls")) return;

    const wrap = document.createElement("div");
    wrap.id = "fmrSelectionControls";
    wrap.style.display = "flex";
    wrap.style.gap = "10px";
    wrap.style.alignItems = "center";
    wrap.style.margin = "10px 0";

    const btnSelectAll = document.createElement("button");
    btnSelectAll.type = "button";
    btnSelectAll.textContent = "Select All";

    const btnClear = document.createElement("button");
    btnClear.type = "button";
    btnClear.textContent = "Clear Route";

    // NEW: Delete button beside Clear
    const btnDeleteSelected = document.createElement("button");
    btnDeleteSelected.type = "button";
    btnDeleteSelected.textContent = "Delete";

    const btnDeleteAll = document.createElement("button");
    btnDeleteAll.type = "button";
    btnDeleteAll.textContent = "Delete All Addresses";

    wrap.appendChild(btnSelectAll);
    wrap.appendChild(btnClear);
    wrap.appendChild(btnDeleteSelected);
    wrap.appendChild(btnDeleteAll);

    // Insert controls right above the job list
    const parent = els.jobList.parentNode;
    if (parent) parent.insertBefore(wrap, els.jobList);

    // Select All = only filtered jobs
    btnSelectAll.addEventListener("click", () => {
        const filtered = getFilteredJobs();
        const set = new Set(routeIds);
        for (const j of filtered) set.add(j.id);
        const selectionChanged = set.size !== routeIds.length;
        routeIds = Array.from(set);
        persistActiveRoute(
            selectionChanged ? markRouteManuallyChanged() : null,
        );
        renderJobsList();
        renderRouteList();
    });

    // Clear Route = clear route selection only
    btnClear.addEventListener("click", clearRouteSelection);

    // Delete Selected = delete checked jobs + clear route (confirmed)
    btnDeleteSelected.addEventListener("click", () => {
        deleteSelectedJobs();
    });

    btnDeleteAll.addEventListener("click", deleteAllAddresses);
}

// ============================================================================
// SECTION 8 — Rendering
// ============================================================================
function updateAddressFilterOptions(select, options, allLabel) {
    if (!select) return;
    const previous = select.value || "All";
    const choices = options.map((value) => ({
        value,
        label: value === "All" ? allLabel : value,
    }));
    const current = Array.from(select.options).map((option) => option.value);
    if (
        choices.length !== current.length ||
        choices.some((choice, index) => choice.value !== current[index])
    ) {
        select.replaceChildren();
        for (const choice of choices) {
            const option = document.createElement("option");
            option.value = choice.value;
            option.textContent = choice.label;
            select.appendChild(option);
        }
    }
    select.value = choices.some((choice) => choice.value === previous)
        ? previous
        : "All";
}

function getFilteredAddressRows() {
    const filters = globalThis.FMRAddressFilters;
    const rows = filters.describeStops(jobs, readGigs(localStorage, savedJobIds()));
    const options = filters.availableFilters(rows);
    updateAddressFilterOptions(
        els.addressSourceFilter,
        options.sources,
        "All companies / sources",
    );
    updateAddressFilterOptions(
        els.addressTownFilter,
        ["All", ...options.towns],
        "All towns",
    );
    updateAddressFilterOptions(
        els.addressCountyFilter,
        ["All", ...options.counties],
        "All counties",
    );
    return filters.filterRows(rows, {
        query: els.addressSearch?.value || "",
        source: els.addressSourceFilter?.value || "All",
        town: els.addressTownFilter?.value || "All",
        county: els.addressCountyFilter?.value || "All",
    });
}

function getFilteredJobs() {
    return getFilteredAddressRows().map((row) => row.stop);
}

function formatJobLine(job) {
    const label = job.label ? `${job.label} — ` : "";
    const addr = job.address || "";
    const notesRaw = String(job.notes || "").trim();
    const notes = notesRaw ? ` | Notes: ${notesRaw}` : "";
    return `${label}${addr}${notes}`;
}

function routeDisplaySource(job) {
    const source = String(job?.source || "").trim().toUpperCase();
    if (source === "DCFS" || source === "GIS") return source;

    const searchable = [job?.label, job?.notes]
        .filter(Boolean)
        .join(" ")
        .toUpperCase();

    if (/\bDCFS\b/.test(searchable)) return "DCFS";
    if (/\bGIS\b/.test(searchable)) return "GIS";
    return "";
}

function formatRouteStopLine(job, index) {
    const stopNumber = String(index + 1).padStart(2, "0");
    const source = routeDisplaySource(job);
    const address = String(job?.address || "").trim();
    return [stopNumber, source, address].filter(Boolean).join(" — ");
}

function selectedRouteJobs() {
    return routeIds
        .map((id) => jobs.find((job) => job.id === id))
        .filter(Boolean);
}

function moneyText(value) {
    return `$${Number(value || 0).toFixed(2)}`;
}

function renderRoutePaySummary() {
    if (!els.routePaySummary) return;
    const routeName =
        activeRouteSlot === "basic" ? "Basic Route" : "Google Route";
    const manualGigs = readGigs(localStorage, savedJobIds());
    const summary = summarizeRouteExpectedPay(
        routeHistory[activeRouteSlot],
        manualGigs,
    );

    if (!summary.hasRepresentedWork) {
        els.routePaySummary.textContent =
            `${routeName} expected pay: no InspectorADE or manual gig pay attached.`;
        return;
    }

    const parts = [
        `InspectorADE ${moneyText(summary.inspectorAdeExpectedPay)}`,
        `Manual gigs ${moneyText(summary.manualGigExpectedPay)}`,
        `Total known ${moneyText(summary.totalKnownExpectedPay)}`,
    ];
    if (summary.payIncomplete) parts.push("Pay incomplete");
    els.routePaySummary.textContent = parts.join(" • ");
}

function mapSectionStopIds(section, currentHome, currentRouteIds) {
    const activeIds = new Set(currentRouteIds);
    const sectionIds = [];
    // Each map's origin is either Home or the previous map's final stop.
    // Only its waypoints and destination belong to this map's completion.
    for (const stop of [...section.waypoints, section.destination]) {
        if (stop === currentHome || !stop?.id || !activeIds.has(stop.id)) continue;
        if (!sectionIds.includes(stop.id)) sectionIds.push(stop.id);
    }
    return sectionIds;
}

function markGoogleMapSectionComplete(sectionNumber, sectionStopIds, expected) {
    if (!sectionStopIds.length) return;
    if (routeOrderSendPromise) {
        alert("A workbook route send is in progress. No map was completed.");
        return;
    }

    const validIds = savedJobIds();
    const latest = readRouteHistory(localStorage, validIds);
    const plan = latest.activePlan;
    const currentIds = latest[expected.slot]?.routeIds || [];
    if (
        !plan ||
        plan.planId !== expected.planId ||
        plan.revision !== expected.planRevision ||
        plan.activeDayId !== expected.dayId ||
        activeRouteSlot !== expected.slot ||
        JSON.stringify(currentIds) !== JSON.stringify(expected.routeIds) ||
        sectionStopIds.some((id) => !currentIds.includes(id))
    ) {
        alert("The route changed. Review the refreshed maps before marking one complete.");
        renderRouteList();
        return;
    }

    const stopCount = sectionStopIds.length;
    const accepted = confirm(
        "Mark Map " + sectionNumber + " complete?\n\n" +
        "This marks all " + stopCount + " remaining stop" +
        (stopCount === 1 ? "" : "s") +
        " on this map complete and removes them from BOTH Google and Basic remaining routes.\n\n" +
        "Saved addresses, job records, and workbook turn-in statuses are not changed. " +
        "The remaining Google Maps sections will be renumbered."
    );
    if (!accepted) return;

    try {
        const completedAt = new Date().toISOString();
        let next = latest;
        for (const stopId of sectionStopIds) {
            next = completeActivePlanStop(next, stopId, validIds, completedAt);
        }
        // One write for the entire map. Failed validation cannot partially complete it.
        routeHistory = writeRouteHistory(localStorage, next, validIds);
        routeIds = routeHistory[activeRouteSlot]?.routeIds.slice() || [];
        renderAll();
        if (els.routeStatus) {
            els.routeStatus.textContent =
                "Map " + sectionNumber + " completed (" + stopCount +
                " stops). Remaining map sections were rebuilt from unfinished work.";
        }
    } catch (error) {
        alert(error?.message || "The map could not be completed. No changes were saved.");
        renderRouteList();
    }
}

function renderGoogleMapsActions() {
    if (!els.exportRoute || !els.routeMapLinks) return;

    els.routeMapLinks.innerHTML = "";
    els.routeMapLinks.hidden = true;
    els.exportRoute.hidden = false;

    if (!home || routeIds.length === 0) return;

    const sections = buildGoogleMapsRouteSections(home, selectedRouteJobs());
    if (!sections.length) return;
    const multipleMaps = sections.length > 1;
    els.exportRoute.hidden = multipleMaps;
    els.routeMapLinks.hidden = false;

    if (multipleMaps) {
        const message = document.createElement("span");
        message.className = "tiny muted";
        message.textContent = "Open these " + sections.length + " map sections in order:";
        els.routeMapLinks.appendChild(message);
    }

    const plan = routeHistory.activePlan;
    const expected = {
        planId: plan?.planId,
        planRevision: plan?.revision,
        dayId: plan?.activeDayId,
        slot: activeRouteSlot,
        routeIds: routeIds.slice(),
    };
    for (const section of sections) {
        const controls = document.createElement("div");
        controls.className = "btnRow";
        if (multipleMaps) {
            const link = document.createElement("a");
            link.className = "btn btnSmall";
            link.href = section.url;
            link.target = "_blank";
            link.rel = "noopener";
            link.textContent = "Map " + section.number + " of " + section.total;
            controls.appendChild(link);
        }

        const stopIds = mapSectionStopIds(section, home, routeIds);
        const completeButton = document.createElement("button");
        completeButton.type = "button";
        completeButton.className = "btn btnSmall";
        completeButton.textContent = "Mark Map " + section.number + " Complete";
        completeButton.disabled = !expected.planId || stopIds.length === 0;
        completeButton.addEventListener("click", () =>
            markGoogleMapSectionComplete(section.number, stopIds, expected),
        );
        controls.appendChild(completeButton);
        els.routeMapLinks.appendChild(controls);
    }
}


function appendStreetConflictWarning(parent, address, aliases = []) {
    const rawConflictAddress = [address, ...aliases].find((candidate) =>
        streetDecisionForAddress(candidate, streetCorrectionRecord)?.status === "conflict"
    );
    if (!rawConflictAddress) return;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "!";
    button.className = "btn btnSmall";
    button.style.width = "auto";
    button.style.padding = "0.1em 0.5em";
    button.title = "Conflicting street-name corrections — choose one";
    button.setAttribute("aria-label", "Resolve street-name correction conflict for " + rawConflictAddress);
    button.addEventListener("click", (event) => {
        event.stopPropagation();
        void resolveStreetConflict(rawConflictAddress);
    });
    parent.appendChild(button);
}

async function resolveStreetConflict(address) {
    const decision = streetDecisionForAddress(address, streetCorrectionRecord);
    if (decision?.status !== "conflict") return;
    const options = decision.choices.map((entry, index) =>
        (index + 1) + ". " + entry.street
    ).join("\n");
    const selected = prompt(
        "Conflicting corrections for " + decision.originalStreet + " in " +
        decision.town + ", " + decision.state + ":\n" +
        options + "\nEnter the number of the correct street name:",
    );
    if (selected === null) return;
    const choiceIndex = Number(selected) - 1;
    if (!Number.isInteger(choiceIndex) || !decision.choices[choiceIndex]) {
        alert("No correction changed. Select a listed number.");
        return;
    }
    const rejectedIds = decision.choices.flatMap((choice, index) =>
        index === choiceIndex ? [] : choice.ruleIds
    );
    const amended = removeStreetCorrectionRules(streetCorrectionRecord, rejectedIds);
    await commitCorrectionDelta(amended);
}


function renderStreetCorrectionChoices() {
    const choice = els.streetCorrectionRuleChoice;
    const panel = els.streetCorrectionManagePanel;
    if (!choice || !panel) return;
    const selectedId = choice.value;
    const rules = effectiveStreetRules(streetCorrectionRecord);
    choice.replaceChildren();
    for (const rule of rules) {
        const option = document.createElement("option");
        option.value = rule.id;
        option.textContent =
            rule.town + ", " + rule.state + ": " +
            rule.originalStreet + " → " + rule.correctedStreet;
        choice.appendChild(option);
    }
    choice.value = rules.some((rule) => rule.id === selectedId) ? selectedId : "";
    panel.hidden = false;
    if (els.removeSelectedStreetCorrection) {
        els.removeSelectedStreetCorrection.disabled = !choice.value;
    }
}

async function removeSelectedStreetCorrection() {
    const choice = els.streetCorrectionRuleChoice;
    const button = els.removeSelectedStreetCorrection;
    if (!choice || !button || button.disabled) return;
    const rule = effectiveStreetRules(streetCorrectionRecord).find(
        (entry) => entry.id === choice.value,
    );
    if (!rule) return;
    if (!confirm(
        "Stop automatically correcting " + rule.originalStreet + " to " +
        rule.correctedStreet + " in " + rule.town + ", " +
        rule.state + "? Existing jobs will not be changed.",
    )) return;
    button.disabled = true;
    if (els.streetCorrectionManageStatus) {
        els.streetCorrectionManageStatus.textContent = "Saving correction removal…";
    }
    const saved = await commitCorrectionDelta(
        removeStreetCorrectionRules(streetCorrectionRecord, [rule.id]),
    );
    if (saved) renderStreetCorrectionChoices();
    if (els.streetCorrectionManageStatus) {
        els.streetCorrectionManageStatus.textContent = saved
            ? "Street correction removed and synced. " +
                effectiveStreetRules(streetCorrectionRecord).length + " remaining."
            : "Could not sync the removal. The shared rule was not changed.";
    }
    if (!saved) button.disabled = false;
}

async function manageStreetCorrections() {
    const button = els.manageStreetCorrections;
    if (!button || button.disabled) return;
    button.disabled = true;
    if (els.streetCorrectionManageStatus) {
        els.streetCorrectionManageStatus.textContent = "Connecting to Google Drive…";
    }
    try {
        // Only the user-clicked manager may request interactive Drive consent.
        // Automatic workbook import still requires an existing token.
        await requestDriveToken();
        streetCorrectionRecord = await loadPermanentAddressCorrections();
        renderJobsList();
        renderRouteList();
    } catch (error) {
        if (els.streetCorrectionManageStatus) {
            els.streetCorrectionManageStatus.textContent =
                error?.message || "Could not load street corrections from Google Drive.";
        }
        return;
    } finally {
        button.disabled = false;
    }
    renderStreetCorrectionChoices();
    if (els.streetCorrectionManageStatus) {
        els.streetCorrectionManageStatus.textContent =
            "Loaded " + effectiveStreetRules(streetCorrectionRecord).length +
            " street corrections from Google Drive.";
    }
}

function renderJobsList() {
    const list = els.jobList;
    if (!list) return;
    list.innerHTML = "";

    const filtered = getFilteredAddressRows();
    if (els.addressFilterCount) {
        els.addressFilterCount.textContent =
            `Showing ${filtered.length} of ${jobs.length} saved addresses.`;
    }

    if (filtered.length === 0) {
        const li = document.createElement("li");
        li.textContent = jobs.length
            ? "No matching addresses. Change the search or filters."
            : "No addresses yet.";
        list.appendChild(li);
        return;
    }

    for (const row of filtered) {
        const job = row.stop;
        const li = document.createElement("li");

        const checked = routeIds.includes(job.id);

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = checked;
        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                if (!routeIds.includes(job.id)) routeIds.push(job.id);
            } else {
                routeIds = routeIds.filter((id) => id !== job.id);
            }
            persistActiveRoute(markRouteManuallyChanged());
            renderRouteList();
        });

        const label = document.createElement("span");
        label.textContent = formatJobLine(job);

        const sourceLabel = document.createElement("span");
        sourceLabel.className = "addressSourceLabel";
        sourceLabel.textContent = `${row.sources.join(" · ")} — `;

        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.style.width = "auto";
        editBtn.addEventListener("click", () => startEditJob(job.id));

        const delBtn = document.createElement("button");
        delBtn.textContent = "Delete";
        delBtn.style.width = "auto";
        delBtn.addEventListener("click", () => {
            const removedFromRoute = routeIds.includes(job.id);
            jobs = jobs.filter((j) => j.id !== job.id);
            routeIds = routeIds.filter((id) => id !== job.id);

            if (editingJobId === job.id) {
                editingJobId = null;
                if (els.jobForm) els.jobForm.reset();
            }

            writeJobs(jobs);
            persistActiveRoute(
                removedFromRoute ? markRouteManuallyChanged() : null,
            );
            filterRoutesForSavedJobs();
            renderAll();
        });

        li.appendChild(checkbox);
        li.appendChild(document.createTextNode(" "));
        li.appendChild(sourceLabel);
        li.appendChild(label);
        appendStreetConflictWarning(li, job.address, job.addressAliases || []);
        li.appendChild(document.createTextNode(" "));
        li.appendChild(editBtn);
        li.appendChild(document.createTextNode(" "));
        li.appendChild(delBtn);

        list.appendChild(li);
    }
}

function renderRouteList() {
    const list = els.routeList;
    if (!list) return;
    renderRouteChoice();
    renderGoogleInsertionChoices();
    renderRouteOptimizationStatus();
    renderRoutePaySummary();
    list.innerHTML = "";
    renderGoogleMapsActions();

    if (els.completeAndNavigateNext) {
        els.completeAndNavigateNext.disabled = !home || routeIds.length === 0;
    }
    if (els.startRouteNavigation) {
        els.startRouteNavigation.disabled = !home || routeIds.length === 0;
    }
    if (els.sendRouteOrder) {
        els.sendRouteOrder.disabled =
            routeIds.length === 0 || Boolean(routeOrderSendPromise);
    }
    if (els.reverseRoute) {
        els.reverseRoute.disabled =
            routeIds.length < 2 || Boolean(routeOrderSendPromise);
    }

    if (!home) {
        const li = document.createElement("li");
        li.textContent = "Save your Home / Route Base first.";
        list.appendChild(li);
        return;
    }

    const start = document.createElement("li");
    start.textContent = `Start — ${home.address}`;
    list.appendChild(start);

    if (routeIds.length === 0) {
        const li = document.createElement("li");
        li.textContent = "No addresses selected for route.";
        list.appendChild(li);
    } else {
        for (let i = 0; i < routeIds.length; i++) {
            const jobId = routeIds[i];
            const job = jobs.find((j) => j.id === jobId);
            if (!job) continue;

            const li = document.createElement("li");
            li.dataset.stopId = job.id;

            const label = document.createElement("span");
            label.textContent = formatRouteStopLine(job, i);

            const upBtn = document.createElement("button");
            upBtn.textContent = "Up";
            upBtn.style.width = "auto";
            upBtn.disabled = i === 0;
            upBtn.addEventListener("click", () => {
                if (i === 0) return;
                const tmp = routeIds[i - 1];
                routeIds[i - 1] = routeIds[i];
                routeIds[i] = tmp;
                persistActiveRoute("manually_changed");
                renderRouteList();
            });

            const downBtn = document.createElement("button");
            downBtn.textContent = "Down";
            downBtn.style.width = "auto";
            downBtn.disabled = i === routeIds.length - 1;
            downBtn.addEventListener("click", () => {
                if (i === routeIds.length - 1) return;
                const tmp = routeIds[i + 1];
                routeIds[i + 1] = routeIds[i];
                routeIds[i] = tmp;
                persistActiveRoute("manually_changed");
                renderRouteList();
            });

            const removeBtn = document.createElement("button");
            removeBtn.textContent = "Remove";
            removeBtn.style.width = "auto";
            removeBtn.addEventListener("click", () => {
                routeIds = routeIds.filter((id) => id !== jobId);
                persistActiveRoute(markRouteManuallyChanged());
                renderRouteList();
                renderJobsList();
            });

            li.appendChild(label);
            li.appendChild(document.createTextNode(" "));
            li.appendChild(upBtn);
            li.appendChild(document.createTextNode(" "));
            li.appendChild(downBtn);
            li.appendChild(document.createTextNode(" "));
            li.appendChild(removeBtn);

            list.appendChild(li);
        }
    }

    const finish = document.createElement("li");
    finish.textContent = `Finish — ${home.address}`;
    list.appendChild(finish);
}

function renderRouteOptimizationStatus() {
    if (!els.routeOptimizationStatus) return;
    const status = routeHistory[activeRouteSlot]?.optimizationStatus;
    const labels = {
        basic_optimized: "Basic Optimized",
        google_optimized: "Google Optimized",
        manually_changed: "Manually Changed",
        not_optimized: "Not Optimized",
    };
    const routeName =
        activeRouteSlot === "basic" ? "Basic Route" : "Google Route";
    els.routeOptimizationStatus.textContent = `${routeName}: ${
        labels[status] || labels.not_optimized
    }`;
}

function routeChoiceStatusLabel(slot) {
    const status = routeHistory[slot]?.optimizationStatus;
    return (
        {
            basic_optimized: "Optimized",
            google_optimized: "Optimized",
            manually_changed: "Manually Changed",
            not_optimized: "Not Optimized",
        }[status] || "Not Optimized"
    );
}

function routeChoiceName(slot) {
    return slot === "basic" ? "Basic Route" : "Google Route";
}

function routeSwitchNeedsConfirmation(requested) {
    if (requested === activeRouteSlot) return false;
    const currentStatus = routeHistory[activeRouteSlot]?.optimizationStatus;
    const requestedStatus = routeHistory[requested]?.optimizationStatus;
    const currentIsPrepared =
        currentStatus === "basic_optimized" ||
        currentStatus === "google_optimized" ||
        currentStatus === "manually_changed";
    return currentIsPrepared && requestedStatus === "not_optimized";
}

function confirmRouteSwitchIfNeeded(requested) {
    if (!routeSwitchNeedsConfirmation(requested)) return true;
    return confirm(
        `${routeChoiceName(requested)} is Not Optimized. ` +
            `${routeChoiceName(activeRouteSlot)} is ${routeChoiceStatusLabel(activeRouteSlot)} and will stay saved.\n\n` +
            `Switch to ${routeChoiceName(requested)} anyway?`,
    );
}

function googleInsertionCandidates() {
    const current = readRouteHistory(localStorage, savedJobIds());
    if (!current.google?.routeIds?.length) return [];
    const routeApi = globalThis.FMRRouteHistory;
    return jobs
        .filter((job) => routeApi.canInsertSavedStop(current, job.id))
        .map((job) => ({
            id: job.id,
            address: job.address,
            label: job.label,
            notes: job.notes,
            county: job.county,
        }));
}

function renderGoogleInsertionChoices() {
    if (!els.googleInsertStopChoice || !els.googleInsertStop) return;
    const select = els.googleInsertStopChoice;
    const selected = select.value;
    const query = String(els.googleInsertStopSearch?.value || "").trim();
    // A leading house number must match the start of the saved street address,
    // never a digit in its street, town, ZIP code, label, or notes.
    const houseNumberPrefix = /^\d+(?=\s|$)/.exec(query)?.[0] || "";
    const textQuery = houseNumberPrefix
        ? query.slice(houseNumberPrefix.length).trim()
        : query;
    const words = textQuery.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const filters = globalThis.FMRAddressFilters;
    const eligible = googleInsertionCandidates();
    // Use the same conservative city/county extraction as Saved Addresses.
    const rows = filters.describeStops(eligible);
    const options = filters.availableFilters(rows);
    updateAddressFilterOptions(
        els.googleInsertStopCounty,
        ["All", ...options.counties],
        "All counties",
    );
    const county = els.googleInsertStopCounty?.value || "All";
    // A county narrows the City dropdown to towns present in eligible
    // saved stops in that county; never list unrelated towns.
    const countyRows = county === "All"
        ? rows
        : rows.filter((row) => row.county === county);
    updateAddressFilterOptions(
        els.googleInsertStopCity,
        ["All", ...filters.availableFilters(countyRows).towns],
        "All cities",
    );
    const city = els.googleInsertStopCity?.value || "All";
    const candidates = eligible.filter((candidate) => {
        if (city !== "All" && filters.townForStop(candidate) !== city) return false;
        if (county !== "All" && filters.countyForStop(candidate) !== county) return false;
        if (houseNumberPrefix &&
            !String(candidate.address || "").trimStart().startsWith(houseNumberPrefix)) {
            return false;
        }
        const searchable = [
            candidate.address, candidate.label, candidate.notes,
            filters.townForStop(candidate), filters.countyForStop(candidate),
        ].map((value) => String(value || "")).join(" ").toLocaleLowerCase();
        return words.every((word) => searchable.includes(word));
    });
    select.textContent = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = candidates.length
        ? (query
            ? `${candidates.length} matching address${candidates.length === 1 ? "" : "es"} — choose one`
            : "Choose a saved address")
        : (query ? "No matching saved addresses" : "No available saved addresses");
    select.appendChild(placeholder);
    for (const candidate of candidates) {
        const option = document.createElement("option");
        option.value = candidate.id;
        option.textContent = candidate.address;
        select.appendChild(option);
    }
    select.value = candidates.some((entry) => entry.id === selected)
        ? selected
        : "";
    select.disabled =
        googleInsertionBusy ||
        !candidates.length ||
        activeRouteSlot !== "google";
    els.googleInsertStop.disabled =
        googleInsertionBusy ||
        Boolean(routeOrderSendPromise) ||
        activeRouteSlot !== "google" ||
        !select.value ||
        !home;
}

function googleInsertionContext(newStopId) {
    const history = readRouteHistory(localStorage, savedJobIds());
    const routeApi = globalThis.FMRRouteHistory;
    if (!routeApi.canInsertSavedStop(history, newStopId)) {
        throw new Error("That address is already routed, assigned to another day, or contains work needing assignment.");
    }
    const currentHome = readHome(localStorage);
    const saved = readStops(localStorage).stops;
    const originalIds = history.google.routeIds.slice();
    const ids = [...originalIds, newStopId];
    const savedStops = ids.map((id) => saved.find((item) => item.id === id));
    const displayedStops = ids.map((id) => jobs.find((item) => item.id === id));
    if (!currentHome || !savedStops.every(Boolean) ||
        JSON.stringify(currentHome) !== JSON.stringify(home) ||
        JSON.stringify(savedStops) !== JSON.stringify(displayedStops)) {
        throw new Error("Saved addresses or Home changed. Refresh FMR and try again.");
    }
    return {
        planId: history.activePlan.planId,
        planRevision: history.activePlan.revision,
        dayId: history.activePlan.activeDayId,
        originalIds,
        newStopId,
        guard: JSON.stringify({
            activePlan: history.activePlan,
            pending: history.pending,
            home: currentHome,
            stops: savedStops,
            activeRouteSlot,
        }),
    };
}

function prepareGoogleInsertionSnapshot(newStopId) {
    const context = googleInsertionContext(newStopId);
    if (home?.latitude == null || home?.longitude == null) {
        throw new Error("Verify the Home location before inserting a stop.");
    }
    const ids = [...context.originalIds, newStopId];
    return {
        home: { ...home },
        stops: ids.map((id) => ({ ...jobs.find((job) => job.id === id) })),
        insertion: { newStopId },
    };
}

function renderRouteChoice() {
    if (!els.routeChoice) return;
    els.routeChoice.value = activeRouteSlot;
    if (els.routePage) {
        els.routePage.dataset.activeRoute = activeRouteSlot;
    }
    if (els.routeOptimizeFeedback) {
        els.routeOptimizeFeedback.textContent =
            optimizerFeedbackByRoute[activeRouteSlot] ||
            "Optimization progress and results appear here.";
    }
    const googleOption = els.routeChoice.querySelector(
        'option[value="google"]',
    );
    const basicOption = els.routeChoice.querySelector(
        'option[value="basic"]',
    );
    if (googleOption) {
        googleOption.textContent =
            `Google Route — ${routeChoiceStatusLabel("google")}`;
        googleOption.disabled =
            !routeHistory.google || routeHistory.google.routeIds.length === 0;
    }
    if (basicOption) {
        basicOption.textContent =
            `Basic Route — ${routeChoiceStatusLabel("basic")}`;
        basicOption.disabled =
            !routeHistory.basic || routeHistory.basic.routeIds.length === 0;
    }
}

function renderNewRouteAvailable() {
    if (!els.newRouteAvailable) return;
    const pending = routeHistory.pending;
    const hasPending = Boolean(pending?.routeIds.length);
    els.newRouteAvailable.hidden = !hasPending;
    if (els.startNewRoute) els.startNewRoute.disabled = !hasPending;
    if (els.newRouteAvailableStatus) {
        els.newRouteAvailableStatus.textContent = hasPending
            ? `New Route Available — ${pending.routeIds.length} job${pending.routeIds.length === 1 ? "" : "s"}.`
            : "";
    }
}

function renderHome() {
    if (els.homeAddress) {
        els.homeAddress.value = home?.address || "";
    }

    if (els.homeStatus) {
        els.homeStatus.textContent = home
            ? `Saved privately in this browser: ${home.address}`
            : "Required before building a round trip.";
    }

    homeDraftLatitude = home?.latitude ?? null;
    homeDraftLongitude = home?.longitude ?? null;
    homeDraftPinStatus = home?.pinStatus || "unverified";

    if (homeDraftLatitude != null && homeDraftLongitude != null) {
        showHomeLocationMap(homeDraftLatitude, homeDraftLongitude);
    }
}

function renderAll() {
    ensureSelectionControls();
    renderHome();
    renderJobsList();
    renderRouteChoice();
    renderNewRouteAvailable();
    renderRouteList();
    renderSettings();
}

function renderSettings() {
    const savedKey = readGeoapifyKey(localStorage);
    if (els.geoapifyKey) els.geoapifyKey.value = savedKey;
    if (els.geoapifyKeyStatus) {
        els.geoapifyKeyStatus.textContent = maskedKey(savedKey);
    }
}

if (els.routeChoice) {
    els.routeChoice.addEventListener("change", () => {
        const requested =
            els.routeChoice.value === "basic" ? "basic" : "google";
        if (
            !routeHistory[requested] ||
            routeHistory[requested].routeIds.length === 0
        ) {
            els.routeChoice.value = activeRouteSlot;
            return;
        }

        if (!confirmRouteSwitchIfNeeded(requested)) {
            els.routeChoice.value = activeRouteSlot;
            return;
        }

        activateRouteSlot(requested);
        if (els.workbookRouteOrderStatus) {
            els.workbookRouteOrderStatus.textContent = "";
        }
        if (els.routeStatus) {
            els.routeStatus.textContent =
                activeRouteSlot === "basic"
                    ? "Basic Route selected."
                    : "Google Route selected.";
        }
    });
}

els.reverseRoute?.addEventListener("click", reverseSelectedRoute);

if (els.startNewRoute) {
    els.startNewRoute.addEventListener("click", () => {
        const pendingCount = routeHistory.pending?.routeIds.length || 0;
        if (pendingCount === 0) return;
        if (
            !confirm(
                `Start the new ${pendingCount}-job route? This replaces the active Route Plan, both saved route versions, and any temporary completion progress for that plan. Saved addresses, pins, manual gigs, and the pending route jobs being started will be kept.`,
            )
        ) {
            return;
        }

        const started = startPendingRoute(
            routeHistory,
            savedJobIds(),
            globalThis.FMRWorkdayContext.defaultDayContext(),
        );
        routeHistory = writeRouteHistory(
            localStorage,
            started.history,
            savedJobIds(),
        );
        activeRouteSlot = "google";
        routeIds = routeHistory.google?.routeIds.slice() || [];
        renderAll();
        if (els.workbookRouteOrderStatus) {
            els.workbookRouteOrderStatus.textContent = "";
        }
        if (els.routeStatus) {
            els.routeStatus.textContent =
                `New route started with ${routeIds.length} job${routeIds.length === 1 ? "" : "s"}. Google Route selected; both versions are Not Optimized.`;
        }
    });
}

function openGoogleInsertionCityPicker(event) {
    const citySelect = els.googleInsertStopCity;
    // On desktop, open the native dropdown from anywhere on its field,
    // not only from the small arrow. Leave touch and keyboard native.
    if (event.pointerType !== "mouse" ||
        citySelect?.disabled ||
        typeof citySelect?.showPicker !== "function") return;
    try {
        citySelect.showPicker();
        event.preventDefault();
    } catch {
        // Browsers that disallow showPicker retain their native interaction.
    }
}

els.googleInsertStopCity?.addEventListener(
    "pointerdown",
    openGoogleInsertionCityPicker,
);

for (const filter of [
    els.googleInsertStopSearch,
    els.googleInsertStopCity,
    els.googleInsertStopCounty,
]) {
    filter?.addEventListener(
        filter === els.googleInsertStopSearch ? "input" : "change",
        () => {
            renderGoogleInsertionChoices();
            // Refresh the signed-in button if filtering removes the selected stop.
            if (typeof Event === "function") {
                els.googleInsertStopChoice?.dispatchEvent?.(new Event("change"));
            }
        },
    );
}

for (const filter of [
    els.addressSearch,
    els.addressSourceFilter,
    els.addressTownFilter,
    els.addressCountyFilter,
]) {
    filter?.addEventListener(
        filter === els.addressSearch ? "input" : "change",
        renderJobsList,
    );
}

// ============================================================================
// SECTION 9 — Address Suggestions (Saved-only, Offline)
// ============================================================================
function refreshAddressSuggestions() {
    const dl = els.addressSuggestions;
    if (!dl) return;

    const suggestions = savedAddressSuggestions(
        jobs,
        els.address?.value || "",
    );
    dl.replaceChildren();
    for (const address of suggestions) {
        const opt = document.createElement("option");
        opt.value = address;
        dl.appendChild(opt);
    }
}

// ============================================================================
// SECTION 11 — Job CRUD (Add/Edit)
// ============================================================================
function resetForm() {
    editingJobId = null;
    routeEditReturnStopId = null;
    formPinStatus = "unverified";
    if (els.jobForm) els.jobForm.reset();
    if (els.locationPreview) {
        els.locationPreview.hidden = true;
        els.locationPreview.removeAttribute("href");
    }
    if (els.locationStatus) {
        els.locationStatus.textContent =
            "Find the location, then click the exact property on the map.";
    }
    if (els.locationMap) els.locationMap.hidden = true;
    if (els.address) els.address.focus();
    refreshAddressSuggestions();
}

function startEditJob(jobId, returnToRoute = false) {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;

    editingJobId = jobId;
    routeEditReturnStopId = returnToRoute ? jobId : null;

    if (els.address) els.address.value = job.address || "";
    if (els.label) els.label.value = job.label || "";
    if (els.latitude)
        els.latitude.value = job.latitude != null ? String(job.latitude) : "";
    if (els.longitude)
        els.longitude.value =
            job.longitude != null ? String(job.longitude) : "";
    if (els.notes) els.notes.value = job.notes || "";
    formPinStatus = job.pinStatus || "unverified";

    if (job.latitude != null && job.longitude != null) {
        showLocationMap(job.latitude, job.longitude);
    } else if (els.locationMap) {
        els.locationMap.hidden = true;
    }

    if (els.address) els.address.focus();
    refreshAddressSuggestions();
}

function updateLocationPreview(latitude, longitude) {
    if (!els.locationPreview) return;
    els.locationPreview.href = mapUrl(latitude, longitude);
    els.locationPreview.hidden = false;
}

function setHomeManualPin(latitude, longitude) {
    homeLocationMarker.setLatLng([latitude, longitude]);
    homeDraftLatitude = Number(latitude);
    homeDraftLongitude = Number(longitude);
    homeDraftPinStatus = "manual";
    if (els.homeLocationStatus) {
        els.homeLocationStatus.textContent =
            "Manual home pin ready. Save Home Address to remember it.";
    }
}

function addFreeMapLayers(map) {
    const aerial = globalThis.L.tileLayer(
        "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}",
        {
            maxNativeZoom: 16,
            maxZoom: 19,
            attribution: "USDA, USGS The National Map",
        },
    );
    const roads = globalThis.L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        },
    );

    aerial.addTo(map);
    globalThis.L.control
        .layers(
            {
                Aerial: aerial,
                Roads: roads,
            },
            null,
            { collapsed: false },
        )
        .addTo(map);
}

function showHomeLocationMap(latitude, longitude) {
    if (!els.homeLocationMap || !globalThis.L) return;

    els.homeLocationMap.hidden = false;

    if (!homeLocationMap) {
        homeLocationMap = globalThis.L.map(els.homeLocationMap).setView(
            [latitude, longitude],
            19,
        );
        addFreeMapLayers(homeLocationMap);

        homeLocationMarker = globalThis.L.marker([latitude, longitude], {
            draggable: true,
            autoPan: true,
            title: "Drag to correct the home location",
            icon: globalThis.L.divIcon({
                className: "manualPinIcon",
                iconSize: [24, 24],
                iconAnchor: [12, 12],
            }),
        }).addTo(homeLocationMap);

        homeLocationMarker.on("dragend", () => {
            const corrected = homeLocationMarker.getLatLng();
            setHomeManualPin(corrected.lat, corrected.lng);
        });

        homeLocationMap.on("click", (event) => {
            setHomeManualPin(event.latlng.lat, event.latlng.lng);
        });
    } else {
        homeLocationMap.setView([latitude, longitude], 19);
        homeLocationMarker.setLatLng([latitude, longitude]);
    }

    setTimeout(() => homeLocationMap.invalidateSize(), 0);
}

async function findHomeFormLocation() {
    const address = normalizeAddress(els.homeAddress?.value);
    if (!address) {
        alert("Enter the home address first.");
        return;
    }

    els.findHomeLocation.disabled = true;
    if (els.homeLocationStatus) {
        els.homeLocationStatus.textContent = "Finding home…";
    }

    try {
        const result = await findAddress(address, {
            storage: localStorage,
        });
        homeDraftLatitude = result.latitude;
        homeDraftLongitude = result.longitude;
        homeDraftPinStatus = "geocoded";
        showHomeLocationMap(result.latitude, result.longitude);
        if (els.homeLocationStatus) {
            els.homeLocationStatus.textContent =
                "Home found. Click the exact property to move the pin.";
        }
    } catch (error) {
        if (els.homeLocationStatus) {
            els.homeLocationStatus.textContent =
                error?.message || "The home location could not be found.";
        }
    } finally {
        els.findHomeLocation.disabled = false;
    }
}

function setManualPin(latitude, longitude) {
    locationMarker.setLatLng([latitude, longitude]);
    els.latitude.value = Number(latitude).toFixed(7);
    els.longitude.value = Number(longitude).toFixed(7);
    formPinStatus = "manual";
    updateLocationPreview(latitude, longitude);
    if (els.locationStatus) {
        els.locationStatus.textContent =
            "Manual pin ready. Save Address to remember it.";
    }
}

function showLocationMap(latitude, longitude) {
    if (!els.locationMap || !globalThis.L) return;

    els.locationMap.hidden = false;

    if (!locationMap) {
        locationMap = globalThis.L.map(els.locationMap).setView(
            [latitude, longitude],
            19,
        );
        addFreeMapLayers(locationMap);

        locationMarker = globalThis.L.marker([latitude, longitude], {
            draggable: true,
            autoPan: true,
            title: "Drag to correct this location",
            icon: globalThis.L.divIcon({
                className: "manualPinIcon",
                iconSize: [24, 24],
                iconAnchor: [12, 12],
            }),
        }).addTo(locationMap);

        locationMarker.on("dragend", () => {
            const corrected = locationMarker.getLatLng();
            setManualPin(corrected.lat, corrected.lng);
        });

        locationMap.on("click", (event) => {
            setManualPin(event.latlng.lat, event.latlng.lng);
        });
    } else {
        locationMap.setView([latitude, longitude], 19);
        locationMarker.setLatLng([latitude, longitude]);
    }

    setTimeout(() => locationMap.invalidateSize(), 0);
}

async function findFormLocation() {
    const address = normalizeAddress(els.address?.value);
    if (!address) {
        alert("Enter an address first.");
        return;
    }

    const currentLatitude = toNumberOrNull(els.latitude?.value);
    const currentLongitude = toNumberOrNull(els.longitude?.value);
    const hasValidManualCoordinates = isValidCoordinatePair(
        currentLatitude,
        currentLongitude,
    );
    if (
        formPinStatus === "manual" &&
        hasValidManualCoordinates
    ) {
        showLocationMap(currentLatitude, currentLongitude);
        updateLocationPreview(currentLatitude, currentLongitude);
        if (els.locationStatus) {
            els.locationStatus.textContent =
                "Manual pin protected. Move the pin on the map to change it, or change the address for a new lookup.";
        }
        return;
    }

    els.findLocation.disabled = true;
    if (els.locationStatus) {
        els.locationStatus.textContent = "Finding the location…";
    }

    try {
        const result = await findAddress(address, {
            storage: localStorage,
        });

        if (normalizeAddress(els.address?.value) !== address) {
            if (els.locationStatus) {
                els.locationStatus.textContent =
                    "Address changed during lookup. Find the new location when ready.";
            }
            return;
        }

        const latestLatitude = toNumberOrNull(els.latitude?.value);
        const latestLongitude = toNumberOrNull(els.longitude?.value);
        if (
            formPinStatus === "manual" &&
            isValidCoordinatePair(latestLatitude, latestLongitude)
        ) {
            showLocationMap(latestLatitude, latestLongitude);
            updateLocationPreview(latestLatitude, latestLongitude);
            if (els.locationStatus) {
                els.locationStatus.textContent =
                    "Manual pin kept. The automatic lookup was not applied.";
            }
            return;
        }

        els.latitude.value = String(result.latitude);
        els.longitude.value = String(result.longitude);
        formPinStatus = "geocoded";
        showLocationMap(result.latitude, result.longitude);

        updateLocationPreview(result.latitude, result.longitude);
        if (els.locationStatus) {
            els.locationStatus.textContent = result.cached
                ? "Saved lookup found. Click the exact property to move the pin."
                : "Location found. Click the exact property to move the pin.";
        }
    } catch (error) {
        if (els.locationPreview) {
            els.locationPreview.hidden = true;
            els.locationPreview.removeAttribute("href");
        }
        if (els.locationStatus) {
            els.locationStatus.textContent =
                error?.message || "The location could not be found.";
        }
    } finally {
        els.findLocation.disabled = false;
    }
}

// ============================================================================
// SECTION 12 — Optimize Route + Export
// ============================================================================
async function prepareMissingRouteCoordinates(
    selected,
    apiKey,
    selectedRouteIds = routeIds,
) {
    const missingCoords = selected.filter(
        (job) => job.latitude == null || job.longitude == null,
    );

    for (let index = 0; index < missingCoords.length; index++) {
        const job = missingCoords[index];
        if (els.routeStatus) {
            els.routeStatus.textContent =
                `Finding location ${index + 1} of ${missingCoords.length}: ${job.address}`;
        }

        const found = await findAddressWithGeoapify(job.address, apiKey, {
            storage: localStorage,
        });
        jobs = jobs.map((savedJob) =>
            savedJob.id === job.id
                ? normalizeStop({
                      ...savedJob,
                      latitude: found.latitude,
                      longitude: found.longitude,
                      pinStatus: "geocoded",
                  })
                : savedJob,
        );
    }

    writeJobs(jobs);
    return selectedRouteIds
        .map((id) => jobs.find((job) => job.id === id))
        .filter(Boolean);
}

function writeOptimizationFeedback(message, slot = activeRouteSlot) {
    const targetSlot = slot === "basic" ? "basic" : "google";
    const value = String(message || "");
    optimizerFeedbackByRoute[targetSlot] = value;
    if (targetSlot !== activeRouteSlot) return;
    if (els.routeOptimizeFeedback) {
        els.routeOptimizeFeedback.textContent = value;
    }
    if (els.routeStatus) {
        els.routeStatus.textContent = value;
    }
}

async function optimizeSelectedRoute() {
    writeOptimizationFeedback("Preparing Basic Route…");
    const basicRouteIds = routeHistory.basic?.routeIds.slice() || [];
    if (basicRouteIds.length < 2) {
        writeOptimizationFeedback("Select at least 2 addresses to optimize.");
        alert("Select at least 2 addresses to optimize.");
        return;
    }

    let selected = basicRouteIds
        .map((id) => jobs.find((j) => j.id === id))
        .filter(Boolean);

    if (home?.latitude == null || home?.longitude == null) {
        writeOptimizationFeedback("Verify the Home location before optimizing the route.");
        alert("Verify the Home location before optimizing the route.");
        showPage("home");
        return;
    }

    const missingCoords = selected.filter(
        (j) => j.latitude == null || j.longitude == null,
    );

    if (missingCoords.length > 0) {
        writeOptimizationFeedback("Finding missing stop locations for Basic Route…");
        const apiKey = readGeoapifyKey(localStorage);
        if (!apiKey) {
            writeOptimizationFeedback("Save the Geoapify key in Settings first.");
            alert("Save the Geoapify key in Settings first.");
            showPage("settings");
            return;
        }

        els.optimizeRoute.disabled = true;
        try {
            selected = await prepareMissingRouteCoordinates(
                selected,
                apiKey,
                basicRouteIds,
            );
        } catch (error) {
            writeJobs(jobs);
            renderAll();
            writeOptimizationFeedback(
                error?.message || "A location could not be prepared.",
            );
            return;
        } finally {
            els.optimizeRoute.disabled = false;
        }
    }

    writeOptimizationFeedback("Optimizing Basic Route…");
    const ordered = optimizeRoundTripOrder(home, selected);
    const optimizedBasicRouteIds = ordered.map((j) => j.id);
    persistRouteSlot(
        "basic",
        optimizedBasicRouteIds,
        "basic_optimized",
    );
    activeRouteSlot = "basic";
    routeIds = routeHistory.basic?.routeIds.slice() || [];
    renderRouteList();
    renderJobsList();
    renderRouteChoice();
    const sections = buildGoogleMapsRouteSections(home, ordered);
    const mapsReady =
        sections.length > 1
            ? ` ${sections.length} numbered Google Maps sections are ready below.`
            : "";
    writeOptimizationFeedback(
        `Basic Route optimized with ${selected.length} address${selected.length === 1 ? "" : "es"} and selected. Google Route was kept.${mapsReady}`,
    );
}

function exportToGoogleMaps() {
    if (!home) {
        alert("Save your Home / Route Base first.");
        return;
    }

    if (routeIds.length === 0) {
        alert("No addresses selected for route.");
        return;
    }

    const selected = selectedRouteJobs();
    const sections = buildGoogleMapsRouteSections(home, selected);

    if (sections.length > 1) {
        renderGoogleMapsActions();
        alert("Open the numbered Google Maps sections in order.");
        return;
    }

    const url = buildGoogleMapsDirectionsUrl(home, selected);
    if (!url) {
        alert(
            "Every route item needs a readable address or a valid corrected pin.",
        );
        return;
    }

    window.open(url, "_blank");
}

function completeCurrentStopAndNavigate() {
    if (!home) {
        alert("Save your Home / Route Base first.");
        return;
    }

    if (routeIds.length === 0) {
        alert("No current stop remains in this route.");
        return;
    }

    const currentStopId = routeIds[0];
    const currentStop = jobs.find((job) => job.id === currentStopId);
    if (!currentStop) {
        alert("The current route stop could not be found.");
        return;
    }

    const nextRouteIds = routeIds.slice(1);
    const nextStop = nextRouteIds
        .map((id) => jobs.find((job) => job.id === id))
        .find(Boolean);
    const destination = nextStop || home;
    const url = buildGoogleMapsNavigationUrl(destination);

    if (!url) {
        alert("The next destination needs a readable address or corrected pin.");
        return;
    }

    routeHistory = completeActivePlanStop(
        routeHistory,
        currentStopId,
        savedJobIds(),
    );
    routeHistory = writeRouteHistory(
        localStorage,
        routeHistory,
        savedJobIds(),
    );
    routeIds = routeHistory[activeRouteSlot]?.routeIds.slice() || [];
    renderRouteList();
    renderJobsList();

    if (els.routeStatus) {
        els.routeStatus.textContent = nextStop
            ? `Completed ${currentStop.address}. Navigating to ${nextStop.address}. ${nextRouteIds.length} stop${nextRouteIds.length === 1 ? "" : "s"} remain.`
            : `Completed ${currentStop.address}. Route complete — navigating Home.`;
    }

    window.open(url, "_blank");
}

function startCurrentStopNavigation() {
    if (!home) {
        alert("Save your Home / Route Base first.");
        return;
    }

    if (routeIds.length === 0) {
        alert("No current stop remains in this route.");
        return;
    }

    const currentStop = jobs.find((job) => job.id === routeIds[0]);
    if (!currentStop) {
        alert("The current route stop could not be found.");
        return;
    }

    const url = buildGoogleMapsNavigationUrl(currentStop);
    if (!url) {
        alert(
            "The first destination needs a readable address or corrected pin.",
        );
        return;
    }

    if (els.routeStatus) {
        els.routeStatus.textContent =
            `Navigating to ${currentStop.address}. ` +
            "This stop remains first until you tap Done & Navigate Next.";
    }

    window.open(url, "_blank");
}

// ============================================================================
// SECTION 13 — Event Wiring
// ============================================================================
if (els.homeForm) {
    els.homeForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const address = normalizeAddress(els.homeAddress?.value);

        if (!address) {
            alert("Home address is required.");
            return;
        }

        const samePhysicalHome =
            home && addressKey(home.address) === addressKey(address);

        home = writeHome(localStorage, {
            ...(samePhysicalHome ? home : {}),
            address,
            latitude: homeDraftLatitude,
            longitude: homeDraftLongitude,
            pinStatus: homeDraftPinStatus,
        });
        renderAll();
    });
}

if (els.homeAddress) {
    els.homeAddress.addEventListener("input", () => {
        homeDraftLatitude = null;
        homeDraftLongitude = null;
        homeDraftPinStatus = "unverified";
        if (els.homeLocationMap) els.homeLocationMap.hidden = true;
        if (els.homeLocationStatus) {
            els.homeLocationStatus.textContent =
                "Find home, then click the exact property on the map.";
        }
    });
}

if (els.findHomeLocation) {
    els.findHomeLocation.addEventListener("click", findHomeFormLocation);
}

if (els.settingsForm) {
    els.settingsForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const savedKey = writeGeoapifyKey(
            localStorage,
            els.geoapifyKey?.value,
        );
        if (els.geoapifyKeyStatus) {
            els.geoapifyKeyStatus.textContent = maskedKey(savedKey);
        }
    });
}

if (els.clearGeoapifyKey) {
    els.clearGeoapifyKey.addEventListener("click", () => {
        writeGeoapifyKey(localStorage, "");
        renderSettings();
    });
}

if (els.updateApp) {
    els.updateApp.addEventListener("click", async () => {
        els.updateApp.disabled = true;
        if (els.updateAppStatus) {
            els.updateAppStatus.textContent = "Checking for the newest app…";
        }

        try {
            const result = await updateApp({
                online: navigator.onLine !== false,
                serviceWorker: navigator.serviceWorker,
                cacheStorage: globalThis.caches,
                location: globalThis.location,
            });

            if (!result.updated) {
                els.updateApp.disabled = false;
                if (els.updateAppStatus) {
                    els.updateAppStatus.textContent =
                        "Connect to the internet before updating the app.";
                }
            }
        } catch (error) {
            els.updateApp.disabled = false;
            if (els.updateAppStatus) {
                els.updateAppStatus.textContent =
                    error?.message || "The app could not be updated.";
            }
        }
    });
}

if (els.downloadBackup) {
    els.downloadBackup.addEventListener("click", () => {
        const backup = createBackup({
            home,
            stops: jobs,
            routeIds,
            routes: routeHistory,
        });
        const blob = new Blob([JSON.stringify(backup, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = backupFilename();
        link.click();
        URL.revokeObjectURL(url);
        if (els.backupStatus) {
            els.backupStatus.textContent =
                "Backup downloaded. Save that file in Google Drive.";
        }
    });
}

if (els.restoreBackup) {
    els.restoreBackup.addEventListener("click", () => {
        els.backupFile?.click();
    });
}

if (els.backupFile) {
    els.backupFile.addEventListener("change", async () => {
        const file = els.backupFile.files?.[0];
        if (!file) return;

        try {
            const backup = parseBackup(await file.text());
            if (!backup.home) {
                throw new Error("The backup does not contain a Home address.");
            }
            if (
                !confirm(
                    "Replace the saved Home, addresses, pins, Google Route, Basic Route, and pending new route with this backup?",
                )
            ) {
                return;
            }

            jobs = writeStops(localStorage, backup.stops);
            home = writeHome(localStorage, backup.home);
            restoreRoutes(backup.routes);
            renderAll();
            if (els.backupStatus) {
                els.backupStatus.textContent =
                    `Backup restored: ${jobs.length} saved address${jobs.length === 1 ? "" : "es"}.`;
            }
        } catch (error) {
            if (els.backupStatus) {
                els.backupStatus.textContent =
                    error?.message || "The backup could not be restored.";
            }
        } finally {
            els.backupFile.value = "";
        }
    });
}

async function backUpNow() {
    const token = await requestDriveToken();
    const revision = ++driveSaveRevision;
    if (els.googleDriveStatus) {
        els.googleDriveStatus.textContent = "Backing up to Google Drive…";
    }
    const backup = createBackup({
        home,
        stops: jobs,
        routeIds,
        routes: routeHistory,
    });
    await driveSaveQueue.enqueue(token, backup);
    if (els.googleDriveStatus && revision === driveSaveRevision) {
        els.googleDriveStatus.textContent =
            "Backup complete: Free Map Router / Free Map Router Backup.json.";
    }
}

function setAddressCorrectionStatus(message) {
    if (els.addressCorrectionStatus) {
        els.addressCorrectionStatus.textContent = String(message || "");
    }
}

if (els.manageStreetCorrections) {
    els.manageStreetCorrections.addEventListener("click", () => {
        void manageStreetCorrections();
    });
}
if (els.streetCorrectionRuleChoice) {
    els.streetCorrectionRuleChoice.addEventListener("change", () => {
        if (els.removeSelectedStreetCorrection) {
            els.removeSelectedStreetCorrection.disabled =
                !els.streetCorrectionRuleChoice.value;
        }
    });
}
if (els.removeSelectedStreetCorrection) {
    els.removeSelectedStreetCorrection.addEventListener("click", () => {
        void removeSelectedStreetCorrection();
    });
}
if (els.closeStreetCorrectionManage) {
    els.closeStreetCorrectionManage.addEventListener("click", () => {
        if (els.streetCorrectionManagePanel) {
            els.streetCorrectionManagePanel.hidden = true;
        }
    });
}

async function loadPermanentAddressCorrections() {
    const token = currentDriveToken();
    if (!token) {
        throw new Error(
            "Tap Check Workbook Route to connect Google Drive and safely load saved address corrections.",
        );
    }

    const rawRecord = await loadAddressCorrectionsFromDrive(token);
    return rawRecord
        ? parseCorrectionRecord(rawRecord)
        : createCorrectionRecord([], new Date(0));
}

function commitCorrectionDelta(localRecord) {
    const action = async () => {
        setAddressCorrectionStatus("Saving shared corrections to Google Drive…");
        const token = await requestDriveToken();
        const raw = await loadAddressCorrectionsFromDrive(token);
        const remote = raw
            ? parseCorrectionRecord(raw)
            : createCorrectionRecord([], new Date(0));
        const merged = mergeCorrectionRecords(remote, localRecord);
        await saveAddressCorrectionsToDrive(token, merged);
        streetCorrectionRecord = merged;
        setAddressCorrectionStatus("Corrections saved in Google Drive for your devices.");
        const focusedStop = plannerFocusedStopId;
        renderJobsList();
        renderRouteList();
        if (focusedStop && !els.routePage?.hidden && focusPlannerStop(focusedStop)) {
            const focusedCard = Array.from(
                document.querySelectorAll("#routeList > li[data-stop-id]"),
            ).find((card) => card.dataset.stopId === focusedStop);
            focusedCard?.scrollIntoView?.({ block: "nearest" });
        }
        return merged;
    };
    // One device never overlaps its own correction writes.
    const pending = correctionWriteQueue.catch(() => {}).then(action);
    correctionWriteQueue = pending;
    return pending.catch((error) => {
        setAddressCorrectionStatus(
            error?.message || "Correction was not synced. Existing saved addresses were kept.",
        );
        return null;
    });
}

function savePermanentAddressCorrections(stops, proposedStreetRule = null) {
    let localRecord = createCorrectionRecord(stops);
    if (proposedStreetRule) {
        localRecord = addStreetCorrectionRule(localRecord, proposedStreetRule);
    }
    if (
        localRecord.corrections.length === 0 &&
        !localRecord.streetRules?.length
    ) return Promise.resolve(null);
    return commitCorrectionDelta(localRecord);
}

async function sendDisplayedRouteOrderToWorkbook() {
    if (routeOrderSendPromise) return routeOrderSendPromise;

    let routeOrder;
    try {
        routeOrder = buildWorkbookRouteOrder({
            routeSlot: activeRouteSlot,
            routeSnapshot: routeHistory[activeRouteSlot],
            routeStops: selectedRouteJobs(),
        });
    } catch (error) {
        if (els.workbookRouteOrderStatus) {
            els.workbookRouteOrderStatus.textContent =
                error?.message || "The route order could not be prepared.";
        }
        return null;
    }

    const routeName =
        routeOrder.routeSlot === "basic" ? "Basic Route" : "Google Route";
    const orderIdCount = workbookOrderIdCount(routeOrder);
    if (els.workbookRouteOrderStatus) {
        els.workbookRouteOrderStatus.textContent =
            `Sending ${routeName} order to the workbook…`;
    }

    routeOrderSendPromise = (async () => {
        const token = await requestDriveToken();
        await saveRouteOrderToDrive(token, routeOrder);
        return routeOrder;
    })();
    renderRouteList();

    try {
        await routeOrderSendPromise;
        if (els.workbookRouteOrderStatus) {
            els.workbookRouteOrderStatus.textContent =
                `${routeName} order sent for ${orderIdCount} workbook job${orderIdCount === 1 ? "" : "s"}.`;
        }
        return routeOrder;
    } catch (error) {
        if (els.workbookRouteOrderStatus) {
            els.workbookRouteOrderStatus.textContent =
                error?.message || "The route order could not be sent.";
        }
        return null;
    } finally {
        routeOrderSendPromise = null;
        renderRouteList();
    }
}

if (els.sendRouteOrder) {
    els.sendRouteOrder.addEventListener("click", () => {
        void sendDisplayedRouteOrderToWorkbook();
    });
}

async function syncWorkbookInboxFrom(
    loadInbox,
    { allowStaleConfirmation = true } = {},
) {
    if (driveInboxSyncPromise) return driveInboxSyncPromise;

    driveInboxSyncPromise = (async () => {
        let inbox = parseAddressInbox(await loadInbox());
        const corrections = await loadPermanentAddressCorrections();
        streetCorrectionRecord = corrections;
        inbox = applyCorrectionsToInbox(inbox, corrections);

        const inboxRelation = workbookRouteRelation(
            routeHistory,
            inbox.updatedAt,
        );

        const exportedToday = isAddressInboxExportedToday(inbox);
        const importApproved =
            inbox.addresses.length === 0 ||
            inboxRelation === "same" ||
            inboxRelation === "pending" ||
            inboxRelation === "older" ||
            exportedToday ||
            (allowStaleConfirmation &&
                confirm(
                    `This workbook inbox was exported on ${new Date(inbox.updatedAt).toLocaleString()}, not today. ` +
                    `It contains ${inbox.addresses.length} job${inbox.addresses.length === 1 ? "" : "s"}. ` +
                    "Loading it will save the jobs as New Route Available without replacing your Google or Basic route. Load it anyway?",
                ));

        if (inbox.addresses.length > 0 && inboxRelation === "older") {
            if (els.googleDriveInboxStatus) {
                els.googleDriveInboxStatus.textContent =
                    `Older inbox ignored — ${inbox.addresses.length} job${inbox.addresses.length === 1 ? "" : "s"} ` +
                    `were exported ${new Date(inbox.updatedAt).toLocaleString()}. ` +
                    "Google Route and Basic Route were kept.";
            }
            return "older";
        }
        if (inbox.addresses.length > 0 && !importApproved) {
            if (els.googleDriveInboxStatus) {
                els.googleDriveInboxStatus.textContent =
                    `Inbox not imported — ${inbox.addresses.length} job${inbox.addresses.length === 1 ? "" : "s"} ` +
                    `were exported ${new Date(inbox.updatedAt).toLocaleString()}, not today. ` +
                    "Google Route and Basic Route were kept.";
            }
            return "not-approved";
        }
        if (inbox.addresses.length === 0) {
            if (els.googleDriveInboxStatus) {
                els.googleDriveInboxStatus.textContent =
                    formatInboxImportStatus(inbox, 0);
            }
            return "empty";
        }

        const imported = applyAddressInbox(jobs, inbox);
        jobs = writeStops(localStorage, imported.stops);
        const stagedRoute = stageWorkbookRoute(
            routeHistory,
            imported.routeIds,
            inbox.updatedAt,
            savedJobIds(),
            imported.orderIdsByStopId,
            imported.workbookPayByStopId,
            inbox.planningDate || null,
        );
        routeHistory = writeRouteHistory(
            localStorage,
            stagedRoute.history,
            savedJobIds(),
        );
        routeIds = routeHistory[activeRouteSlot]?.routeIds.slice() || [];
        renderAll();
        if (els.googleDriveInboxStatus) {
            els.googleDriveInboxStatus.textContent =
                formatInboxImportStatus(
                    inbox,
                    imported.importedCount,
                ) + " " +
                (stagedRoute.result === "newer" ||
                stagedRoute.result === "pending"
                    ? "New Route Available. Google Route and Basic Route were kept until Start New Route. Saved addresses were kept."
                    : "Workbook route is already loaded. Google Route and Basic Route were kept. Saved addresses were kept.");
        }
        return stagedRoute.result;
    })();

    try {
        return await driveInboxSyncPromise;
    } finally {
        driveInboxSyncPromise = null;
    }
}

async function checkWorkbookRouteFromDrive() {
    if (!els.checkWorkbookRoute || els.checkWorkbookRoute.disabled) return null;

    els.checkWorkbookRoute.disabled = true;
    const checkStatus = els.workbookRouteCheckStatus || els.routeStatus;
    if (checkStatus) {
        checkStatus.textContent = "Checking Google Drive for the workbook route…";
    }

    try {
        const token = await requestDriveToken();
        const result = await syncWorkbookInboxFrom(
            () => loadAddressInboxFromDrive(token),
            { allowStaleConfirmation: true },
        );

        if (checkStatus) {
            if (result === "newer" || result === "pending") {
                checkStatus.textContent =
                    "New Route Available — tap Start New Route.";
            } else if (result === "older") {
                checkStatus.textContent = "Older workbook route ignored.";
            } else if (result === "empty") {
                checkStatus.textContent = "Workbook route has no jobs.";
            } else if (result === "not-approved") {
                checkStatus.textContent = "Workbook route was not loaded.";
            } else {
                checkStatus.textContent = "Workbook route is up to date.";
            }
        }
        return result;
    } catch (error) {
        if (checkStatus) {
            checkStatus.textContent =
                error?.message || "The workbook route could not be checked.";
        }
        return null;
    } finally {
        els.checkWorkbookRoute.disabled = false;
    }
}

if (els.checkWorkbookRoute) {
    els.checkWorkbookRoute.addEventListener("click", () => {
        void checkWorkbookRouteFromDrive();
    });
}

if (els.backupGoogleDrive) {
    els.backupGoogleDrive.addEventListener("click", async () => {
        try {
            await backUpNow();
        } catch (error) {
            if (els.googleDriveStatus) {
                els.googleDriveStatus.textContent =
                    error?.message || "Google Drive backup failed.";
            }
        }
    });
}

if (els.restoreGoogleDrive) {
    els.restoreGoogleDrive.addEventListener("click", async () => {
        try {
            const token = await requestDriveToken();
            await driveSaveQueue.whenIdle();
            const backup = parseBackup(await loadBackupFromDrive(token));
            if (!backup.home) {
                throw new Error("The Google Drive backup has no Home address.");
            }
            if (
                !confirm(
                    "Replace the saved Home, addresses, pins, Google Route, Basic Route, and pending new route with the Google Drive backup?",
                )
            ) {
                return;
            }

            jobs = writeStops(localStorage, backup.stops);
            home = writeHome(localStorage, backup.home);
            restoreRoutes(backup.routes);
            renderAll();
            if (els.googleDriveStatus) {
                els.googleDriveStatus.textContent =
                    `Restored ${jobs.length} address${jobs.length === 1 ? "" : "es"} from Google Drive.`;
            }
        } catch (error) {
            if (els.googleDriveStatus) {
                els.googleDriveStatus.textContent =
                    error?.message || "Google Drive restore failed.";
            }
        }
    });
}

if (els.jobForm) {
    els.jobForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const address = normalizeAddress(els.address?.value);
        const label = (els.label?.value ?? "").toString().trim();

        const lat = toNumberOrNull(els.latitude?.value);
        const lon = toNumberOrNull(els.longitude?.value);

        const notes = (els.notes?.value ?? "").toString();

        if (!address) {
            alert("Address is required.");
            return;
        }

        const latProvided =
            (els.latitude?.value ?? "").toString().trim() !== "";
        const lonProvided =
            (els.longitude?.value ?? "").toString().trim() !== "";

        if (latProvided || lonProvided) {
            if (lat == null || lon == null) {
                alert(
                    "If you enter coordinates, both Latitude and Longitude must be valid numbers.",
                );
                return;
            }
        }

        const draft = {
            address,
            label,
            latitude: latProvided && lonProvided ? lat : null,
            longitude: latProvided && lonProvided ? lon : null,
            notes: notes || "",
            pinStatus:
                latProvided && lonProvided
                    ? formPinStatus
                    : "unverified",
        };

        const returnToRouteStopId =
            editingJobId && routeEditReturnStopId === editingJobId
                ? editingJobId
                : null;

        const previousAddress = editingJobId
            ? jobs.find((job) => job.id === editingJobId)?.address || ""
            : "";
        if (editingJobId) {
            try {
                const edited = applyStopEdit(jobs, editingJobId, draft);
                jobs = writeStops(localStorage, edited.stops);
                routeHistory = remapRouteStopIds(
                    routeHistory,
                    edited.idRemap,
                    savedJobIds(),
                );
                routeHistory = writeRouteHistory(
                    localStorage,
                    routeHistory,
                    savedJobIds(),
                );
                routeIds =
                    routeHistory[activeRouteSlot]?.routeIds.slice() || [];
                const proposal = proposeStreetCorrection(previousAddress, address);
                const approvedRule = proposal && confirm(
                    "Also remember this street-name correction for other house numbers " +
                    "in " + proposal.town + ", " + proposal.state + "?\n" +
                    proposal.originalStreet + " → " + proposal.correctedStreet,
                ) ? proposal : null;
                void savePermanentAddressCorrections(jobs, approvedRule);
            } catch (error) {
                alert(error?.message || "The address could not be updated.");
                return;
            }
        } else {
            const job = normalizeStop({
                id: uid(),
                ...draft,
            });
            jobs.push(job);
            writeJobs(jobs);
        }

        resetForm();
        renderAll();
        if (returnToRouteStopId) {
            showPage("route");
            if (focusPlannerStop(returnToRouteStopId)) {
                const editedCard = Array.from(
                    document.querySelectorAll("#routeList > li[data-stop-id]"),
                ).find((card) => card.dataset.stopId === returnToRouteStopId);
                editedCard?.scrollIntoView?.({ block: "nearest" });
            }
        }
    });
}

if (els.address) {
    els.address.addEventListener("input", () => {
        refreshAddressSuggestions();
        if (els.latitude) els.latitude.value = "";
        if (els.longitude) els.longitude.value = "";
        if (els.locationPreview) {
            els.locationPreview.hidden = true;
            els.locationPreview.removeAttribute("href");
        }
        if (els.locationMap) els.locationMap.hidden = true;
        formPinStatus = "unverified";
    });
}

if (els.findLocation) {
    els.findLocation.addEventListener("click", findFormLocation);
}

for (const coordinateInput of [els.latitude, els.longitude]) {
    coordinateInput?.addEventListener("change", () => {
        formPinStatus = "manual";
    });
}

// Optimize / Export buttons
if (els.optimizeRoute) {
    els.optimizeRoute.addEventListener("click", optimizeSelectedRoute);
}

if (els.clearRoute) {
    els.clearRoute.addEventListener("click", clearRouteSelection);
}

if (els.exportRoute) {
    els.exportRoute.addEventListener("click", exportToGoogleMaps);
}

if (els.startRouteNavigation) {
    els.startRouteNavigation.addEventListener(
        "click",
        startCurrentStopNavigation,
    );
}

if (els.completeAndNavigateNext) {
    els.completeAndNavigateNext.addEventListener(
        "click",
        completeCurrentStopAndNavigate,
    );
}

// CSV import (file picker)
if (els.importCsvBtn) {
    els.importCsvBtn.addEventListener("click", async () => {
        const file = els.csvFile?.files?.[0];
        if (!file) {
            alert("Choose a CSV file first.");
            return;
        }
        const text = await file.text();
        importJobsFromCsvText(text);
    });
}

// CSV import (pasted text)
if (els.importCsvTextBtn) {
    els.importCsvTextBtn.addEventListener("click", () => {
        const text = els.csvText?.value || "";
        importJobsFromCsvText(text);
    });
}

// Drag & drop CSV (global)
window.addEventListener("dragover", (e) => {
    e.preventDefault();
});

window.addEventListener("drop", (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file) {
        if (els.dropHint) {
            els.dropHint.textContent =
                "Drop a real CSV file from File Explorer. Dragging from Chrome/Sheets may not provide a file.";
        }
        return;
    }
    const name = (file.name || "").toLowerCase();
    if (!name.endsWith(".csv")) {
        alert("Please drop a .csv file.");
        return;
    }
    file.text().then(importJobsFromCsvText);
});

// ============================================================================
// SECTION 14 — Init
// ============================================================================
if (els.pageMenu) {
    els.pageMenu.addEventListener("change", () => {
        showPage(els.pageMenu.value);
    });
}

// GOOGLE ROAD ROUTE BRIDGE
// Narrow app-owned bridge for the authenticated test-only Google optimizer.
// It exposes copies of the current selection and applies only a fully validated
// order. Route rendering and routeIds remain owned by app.js.
if (!globalThis.FMRGoogleRouteContract) {
    throw new Error("Google route contract failed to load.");
}

globalThis.FMRRouteBridge = Object.freeze({
    selectedRouteSnapshot() {
        return {
            home: home ? { ...home } : null,
            stops: selectedRouteJobs().map((job) => ({ ...job })),
        };
    },

    async prepareSelectedRouteSnapshot() {
        activateRouteSlot("google");
        if (home?.latitude == null || home?.longitude == null) {
            throw new Error("Verify the Home location before optimizing the route.");
        }

        return {
            home: home ? { ...home } : null,
            stops: selectedRouteJobs().map((job) => ({ ...job })),
        };
    },

    applyGoogleRouteResult(request, response) {
        const validated =
            globalThis.FMRGoogleRouteContract.validateBackendResponse(
                request,
                response,
            );
        const currentSelection = (routeHistory.google?.routeIds || [])
            .map((id) => jobs.find((job) => job.id === id))
            .filter(Boolean);
        const ordered = globalThis.FMRGoogleRouteContract.applyOrderedStopIds(
            currentSelection,
            validated.orderedStopIds,
        );

        const googleRouteIds = ordered.map((job) => job.id);
        persistRouteSlot("google", googleRouteIds, "google_optimized");
        activeRouteSlot = "google";
        routeIds = routeHistory.google?.routeIds.slice() || [];
        renderRouteList();
        renderJobsList();
        renderRouteChoice();

        return {
            orderedStopIds: routeIds.slice(),
            totalDistanceMeters: validated.totalDistanceMeters,
            totalDurationSeconds: validated.totalDurationSeconds,
        };
    },

    googleInsertionContext(newStopId) {
        return googleInsertionContext(newStopId);
    },

    async prepareGoogleInsertionSnapshot(newStopId) {
        return prepareGoogleInsertionSnapshot(newStopId);
    },

    applyGoogleInsertionResult({ expected, request, response, schedule = null }) {
        const current = googleInsertionContext(expected?.newStopId);
        if (current.guard !== expected.guard) {
            throw new Error("The saved route or address changed during Google calculation. Nothing was inserted.");
        }
        if (routeOrderSendPromise) {
            throw new Error("A workbook route send is in progress. No new stop was inserted.");
        }
        const validated =
            globalThis.FMRGoogleRouteContract.validateBackendResponse(
                request,
                response,
            );
        if (!request.insertion ||
            request.insertion.newStopId !== expected.newStopId) {
            throw new Error("The Google insertion request does not match the chosen address.");
        }
        const written = globalThis.FMRRouteHistory.commitGoogleInsertion(
            localStorage,
            {
                planId: expected.planId,
                planRevision: expected.planRevision,
                dayId: expected.dayId,
                originalIds: expected.originalIds,
                newStopId: expected.newStopId,
                orderedIds: validated.orderedStopIds,
                schedule,
            },
            savedJobIds(),
        );
        routeHistory = written;
        activeRouteSlot = "google";
        routeIds = written.google?.routeIds.slice() || [];
        renderAll();
        return { orderedStopIds: routeIds.slice() };
    },

    setGoogleInsertionBusy(value) {
        googleInsertionBusy = Boolean(value);
        renderGoogleInsertionChoices();
    },

    async applyWorkbookInboxFromBackend(
        inbox,
        { allowStaleConfirmation = true } = {},
    ) {
        return syncWorkbookInboxFrom(
            async () => JSON.stringify(inbox),
            { allowStaleConfirmation },
        );
    },

    setRouteStatus(message) {
        if (els.routeStatus) {
            els.routeStatus.textContent = String(message || "");
        }
    },

    setOptimizerFeedback(message) {
        writeOptimizationFeedback(message, "google");
    },
});

showPage("home");
renderAll();
refreshAddressSuggestions();

// ============================================================================
// PHASE 2H-C2 — Planner Map/List and Responsive Presentation
// ============================================================================
if (!globalThis.FMRPlannerModel) {
    throw new Error("Free Map Router planner model failed to load.");
}

const { buildPlannerModel, workItemKey: plannerWorkItemKey } =
    globalThis.FMRPlannerModel;

const plannerEls = {
    routePage: document.getElementById("routePage"),
    daySummary: document.getElementById("plannerDaySummary"),
    map: document.getElementById("plannerMap"),
    mapStatus: document.getElementById("plannerMapStatus"),
    mapEmpty: document.getElementById("plannerMapEmpty"),
    workspace: document.getElementById("plannerWorkspace"),
    viewToggle: document.getElementById("plannerViewToggle"),
};

let plannerMap = null;
let plannerMarkersByStopId = new Map();
let plannerFocusedStopId = null;
let plannerViewMode = "list";

function refreshPlannerRouteHistory() {
    routeHistory = readRouteHistory(localStorage, savedJobIds());
    routeIds = routeHistory[activeRouteSlot]?.routeIds.slice() || [];
}

function plannerDayContext() {
    const workday = globalThis.FMRWorkdayContext;
    try {
        return (
            workday?.displayContext?.(localStorage)?.context ||
            routeHistory.dayContext ||
            null
        );
    } catch {
        return routeHistory.dayContext || null;
    }
}

function plannerWorkItemDetails(manualGigs) {
    const details = {};
    for (const gig of Array.isArray(manualGigs) ? manualGigs : []) {
        const gigId = String(gig?.id || "").trim();
        if (!gigId) continue;
        details[plannerWorkItemKey("gig", gigId)] = {
            source: String(gig?.source || "").trim(),
            workOrderId: String(gig?.workOrderId || "").trim() || null,
            expectedPay:
                gig?.expectedPay === null || gig?.expectedPay === undefined
                    ? null
                    : Number(gig.expectedPay),
            dueDate: String(gig?.dueDate || "").trim() || null,
            completedDate: String(gig?.completedDate || "").trim() || null,
            notes: String(gig?.notes || "").trim(),
        };
    }
    return details;
}

function plannerServiceByStopId(snapshot, projection) {
    if (!projection?.complete) return null;
    const serviceByStopId = {};
    for (const stop of projection.stops || []) {
        const minutes = Number(stop?.serviceMinutes);
        if (!Number.isFinite(minutes) || minutes < 0) return null;
        const seconds = minutes * 60;
        const rounded = Math.round(seconds);
        if (Math.abs(seconds - rounded) > 1e-9) return null;
        serviceByStopId[stop.stopId] = rounded;
    }
    for (const stopId of snapshot?.routeIds || []) {
        if (!Object.hasOwn(serviceByStopId, stopId)) {
            serviceByStopId[stopId] = 0;
        }
    }
    return serviceByStopId;
}

function currentPlannerScheduleBasis(snapshot, projection, dayContext) {
    if (
        activeRouteSlot !== "google" ||
        !snapshot?.schedule ||
        !home
    ) {
        return "";
    }
    if (
        globalThis.FMRWorkdayContext?.homeByRestrictionEnabled?.(document) ===
        false
    ) {
        return "";
    }
    const googleBrowser = globalThis.FMRGoogleRouteBrowser;
    if (
        typeof googleBrowser?.resolveLocalRouteInstant !== "function" ||
        typeof googleBrowser?.buildScheduleBasisKey !== "function"
    ) {
        return "";
    }
    const serviceByStopId = plannerServiceByStopId(snapshot, projection);
    if (!serviceByStopId || !dayContext) return "";
    try {
        const timing = {
            departureTime: googleBrowser.resolveLocalRouteInstant(
                dayContext.routeDate,
                dayContext.departureTime,
                dayContext.timeZone,
            ),
            homeByTime: googleBrowser.resolveLocalRouteInstant(
                dayContext.routeDate,
                dayContext.homeByTime,
                dayContext.timeZone,
            ),
        };
        return googleBrowser.buildScheduleBasisKey({
            routeIds: snapshot.routeIds || [],
            home,
            serviceByStopId,
            timing,
        });
    } catch {
        return "";
    }
}

function activePlannerModel() {
    refreshPlannerRouteHistory();
    const snapshot = routeHistory[activeRouteSlot] || {
        routeIds: [],
        orderIdsByStopId: {},
        gigIdsByStopId: {},
        optimizationStatus: "not_optimized",
        schedule: null,
    };
    const manualGigs = readGigs(localStorage, savedJobIds());
    const paySummary = summarizeRouteExpectedPay(snapshot, manualGigs);
    const dayContext = plannerDayContext();
    let projection = null;
    let plannerError = "";
    try {
        projection =
            globalThis.FMRWorkItemPlanningRuntime?.projectRoute?.(snapshot) ||
            null;
    } catch (error) {
        plannerError =
            error?.message || "Route work could not be summarized safely.";
    }
    const currentScheduleBasisKey = currentPlannerScheduleBasis(
        snapshot,
        projection,
        dayContext,
    );
    const model = buildPlannerModel({
        routeSlot: activeRouteSlot,
        routeSnapshot: snapshot,
        savedStops: jobs,
        routePlanningProjection: projection,
        workItemDetails: plannerWorkItemDetails(manualGigs),
        currentScheduleBasisKey,
        paySummary,
        dayContext,
    });
    return { model, plannerError };
}

function plannerDurationText(seconds) {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value < 0) return "Unavailable";
    const minutes = Math.round(value / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

function plannerMinutesText(value) {
    const minutes = Number(value);
    if (!Number.isFinite(minutes) || minutes < 0) return "unknown";
    if (minutes < 60) return `${Math.round(minutes * 10) / 10} min`;
    const hours = Math.floor(minutes / 60);
    const remainder = Math.round((minutes - hours * 60) * 10) / 10;
    return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

function plannerClockText(instant, timeZone) {
    if (!instant) return "Unavailable";
    const date = new Date(instant);
    if (Number.isNaN(date.getTime())) return "Unavailable";
    try {
        return new Intl.DateTimeFormat("en-US", {
            timeZone: timeZone || "UTC",
            hour: "numeric",
            minute: "2-digit",
        }).format(date);
    } catch {
        return "Unavailable";
    }
}

function plannerOptimizationText(status) {
    return (
        {
            basic_optimized: "Basic Optimized",
            google_optimized: "Google Optimized",
            manually_changed: "Manually Changed",
            not_optimized: "Not Optimized",
        }[status] || "Not Optimized"
    );
}

function plannerSummaryItem(label, value) {
    const item = document.createElement("div");
    item.className = "plannerSummaryItem";
    const name = document.createElement("span");
    name.className = "plannerSummaryLabel";
    name.textContent = label;
    const content = document.createElement("span");
    content.className = "plannerSummaryValue";
    content.textContent = value;
    item.append(name, content);
    return item;
}

function renderPlannerDaySummary(model, plannerError = "") {
    if (!plannerEls.daySummary) return;
    const summary = model?.daySummary || {};
    const timeZone = plannerDayContext()?.timeZone || "UTC";
    const routeName =
        activeRouteSlot === "basic" ? "Basic Route" : "Google Route";
    const service = summary.serviceComplete
        ? plannerMinutesText(summary.serviceMinutes || 0)
        : `${plannerMinutesText(summary.knownServiceMinutes || 0)} known + incomplete`;
    const pay = summary.hasRepresentedWork
        ? `${moneyText(summary.expectedPayKnown)}${summary.payComplete ? "" : " + incomplete"}`
        : "No attached pay";
    const preferred =
        summary.preferredFinishStatus === "met"
            ? "Met"
            : summary.preferredFinishStatus === "overrun"
              ? `Over by ${summary.preferredFinishOverrunMinutes} min`
              : "Unavailable";
    const homeBy =
        summary.homeByStatus === "met"
            ? "Met"
            : summary.homeByStatus === "conflict"
              ? `Late by ${summary.homeByConflictMinutes} min`
              : "Unavailable";

    plannerEls.daySummary.innerHTML = "";
    const routeDateText =
        [summary.routeDate, summary.departureTime]
            .filter(Boolean)
            .join(" • ") || "Not set";
    const items = [
        [
            "Route",
            `${routeName} • ${plannerOptimizationText(summary.optimizationStatus)}`,
        ],
        ["Workday", routeDateText],
        [
            "Stops / work",
            `${summary.physicalStopCount || 0} stops • ${summary.workItemCount || 0} work items`,
        ],
        ["Expected pay", pay],
        ["Service", service],
        [
            "Traffic travel",
            summary.travelDurationSeconds === null
                ? "Unavailable"
                : plannerDurationText(summary.travelDurationSeconds),
        ],
        ["Field finish", plannerClockText(summary.fieldWorkFinishTime, timeZone)],
        ["Home", plannerClockText(summary.homeTime, timeZone)],
        ["Preferred finish", preferred],
        ["Home By", homeBy],
        [
            "Map",
            `${Math.max(
                0,
                (summary.physicalStopCount || 0) -
                    (summary.unplottableStopCount || 0),
            )} plotted • ${summary.unplottableStopCount || 0} unplottable`,
        ],
    ];
    for (const [label, value] of items) {
        plannerEls.daySummary.appendChild(plannerSummaryItem(label, value));
    }
    const message = document.createElement("p");
    message.className = "plannerSummaryMessage tiny muted";
    message.textContent =
        plannerError ||
        model?.timingConfidence?.reason ||
        "Planner facts are current for the displayed route.";
    plannerEls.daySummary.appendChild(message);
}

function plannerWorkIdentity(item, card) {
    if (item.kind === "workbook") {
        return `${card.source || item.source || "InspectorADE"} Order ${item.workItemId}`;
    }
    const source = item.source || "Manual";
    const workOrder = item.workOrderId ? ` • WO ${item.workOrderId}` : "";
    return `${source} Gig ${item.workItemId}${workOrder}`;
}

function plannerWorkFacts(item) {
    const facts = [
        item.serviceMinutes === null
            ? "Service unknown"
            : `Service ${plannerMinutesText(item.serviceMinutes)}`,
    ];
    if (item.assignedDate) facts.push(`Assigned ${item.assignedDate}`);
    if (item.lockedDay) facts.push("Locked day");
    if (item.dueDate) facts.push(`Due ${item.dueDate}`);
    if (item.expectedPay !== null) facts.push(`Pay ${moneyText(item.expectedPay)}`);
    return facts.join(" • ");
}

function plannerStopHeader(card, timeZone) {
    const header = document.createElement("span");
    header.className = "plannerStopHeader";
    const number = document.createElement("span");
    number.className = "plannerStopNumber";
    number.textContent = String(card.routeNumber).padStart(2, "0");
    const address = document.createElement("span");
    address.className = "plannerStopAddress";
    address.textContent = card.address || card.stopId;
    const meta = document.createElement("span");
    meta.className = "plannerStopMeta";
    if (card.source) {
        const source = document.createElement("span");
        source.className = "plannerSourceTag";
        source.textContent = card.source;
        meta.appendChild(source);
    }
    if (card.etaTime) {
        const eta = document.createElement("span");
        eta.className = "plannerEtaTag";
        eta.textContent = `ETA ${plannerClockText(card.etaTime, timeZone)}`;
        meta.appendChild(eta);
    }
    const mapState = document.createElement("span");
    mapState.className = "plannerMapTag";
    mapState.textContent = card.mapPlottable ? "Mapped" : "No saved pin";
    meta.appendChild(mapState);
    const service = document.createElement("span");
    service.dataset.fmrStopServiceTime = "true";
    service.className = "tiny muted";
    service.textContent = card.serviceComplete
        ? `Service: ${plannerMinutesText(card.serviceMinutes || 0)}`
        : `Service: ${plannerMinutesText(card.knownServiceMinutes || 0)} known + incomplete`;
    meta.appendChild(service);
    header.append(number, address, meta);
    appendStreetConflictWarning(
        header, card.address,
        jobs.find((job) => job.id === card.stopId)?.addressAliases || [],
    );
    return header;
}

function plannerWorkRows(card) {
    const list = document.createElement("div");
    list.className = "plannerWorkList";
    for (const item of card.workItems || []) {
        const row = document.createElement("div");
        row.className = "plannerWorkRow";
        row.dataset.workKind = item.kind;
        row.dataset.workItemId = item.workItemId;
        const identity = document.createElement("div");
        identity.className = "plannerWorkIdentity";
        identity.textContent = plannerWorkIdentity(item, card);
        const facts = document.createElement("div");
        facts.className = "plannerWorkFacts";
        facts.textContent = plannerWorkFacts(item);
        row.append(identity, facts);
        list.appendChild(row);
    }
    return list;
}

// Heading Here is a device-local assumption, not GPS, job completion or navigation.
function renderAssumedRouteLocationStatus() {
    const node = els.assumedRouteLocationStatus;
    if (!node) return;
    const selection = globalThis.FMRAssumedRouteLocation.read(
        localStorage, routeHistory, activeRouteSlot, jobs,
    );
    const stop = selection && jobs.find((job) => job.id === selection.stopId);
    node.hidden = !stop;
    node.textContent = stop
        ? `Assumed location: ${stop.address} (not GPS)`
        : "";
}

function beginAssumedRouteLocation(stopId) {
    const dialog = els.assumedRouteLocationDialog;
    if (!dialog) return false;
    const current = readRouteHistory(localStorage, savedJobIds());
    let proposed;
    try {
        proposed = globalThis.FMRAssumedRouteLocation.prepare(
            current, activeRouteSlot, stopId, jobs,
        );
    } catch (error) {
        if (els.routeStatus) {
            els.routeStatus.textContent = error?.message || "Could not select that route stop.";
        }
        return false;
    }
    pendingAssumedRouteLocation = proposed;
    const stop = jobs.find((job) => job.id === stopId);
    if (els.assumedRouteLocationAddress) {
        els.assumedRouteLocationAddress.textContent = stop?.address || stopId;
    }
    if (els.assumedRouteLocationDescription) {
        els.assumedRouteLocationDescription.textContent =
            "FMR will assume you're at this address, not use GPS. No jobs will be marked completed, and your route will not change.";
    }
    if (typeof dialog.showModal === "function") {
        dialog.showModal();
    } else {
        dialog.setAttribute("open", "");
    }
    return true;
}

function closeAssumedRouteLocationDialog() {
    pendingAssumedRouteLocation = null;
    if (typeof els.assumedRouteLocationDialog?.close === "function") {
        els.assumedRouteLocationDialog.close();
    } else {
        els.assumedRouteLocationDialog?.removeAttribute?.("open");
    }
}

function confirmAssumedRouteLocation() {
    const proposed = pendingAssumedRouteLocation;
    if (!proposed) return false;
    const current = readRouteHistory(localStorage, savedJobIds());
    try {
        globalThis.FMRAssumedRouteLocation.confirm(
            localStorage, proposed, current, activeRouteSlot, jobs,
        );
    } catch (error) {
        if (els.assumedRouteLocationDescription) {
            els.assumedRouteLocationDescription.textContent =
                error?.message || "The assumed location could not be saved.";
        }
        return false;
    }
    closeAssumedRouteLocationDialog();
    renderAssumedRouteLocationStatus();
    return true;
}

els.assumedRouteLocationContinue?.addEventListener(
    "click", confirmAssumedRouteLocation,
);
els.assumedRouteLocationCancel?.addEventListener(
    "click", closeAssumedRouteLocationDialog,
);
els.assumedRouteLocationDialog?.addEventListener("cancel", () => {
    pendingAssumedRouteLocation = null;
});
els.assumedRouteLocationDialog?.addEventListener("close", () => {
    pendingAssumedRouteLocation = null;
});

function focusPlannerStop(stopId) {
    const id = String(stopId || "").trim();
    if (!id || !routeIds.includes(id)) return false;
    plannerFocusedStopId = id;
    for (const card of document.querySelectorAll("#routeList > li[data-stop-id]")) {
        card.classList.toggle("isFocused", card.dataset.stopId === id);
    }
    const marker = plannerMarkersByStopId.get(id);
    if (marker) {
        marker.openTooltip?.();
        plannerMap?.panTo?.(marker.getLatLng());
    }
    return true;
}

function plannerCard(card, index, timeZone) {
    const li = document.createElement("li");
    li.className = "plannerStopCard";
    li.dataset.stopId = card.stopId;
    li.tabIndex = 0;
    if (plannerFocusedStopId === card.stopId) li.classList.add("isFocused");
    li.appendChild(plannerStopHeader(card, timeZone));
    li.appendChild(plannerWorkRows(card));
    const stopId = document.createElement("div");
    stopId.className = "plannerStopId";
    stopId.textContent = `Stop ID: ${card.stopId}`;
    li.appendChild(stopId);
    const actions = document.createElement("div");
    actions.className = "plannerCardActions";
    const headingHereBtn = document.createElement("button");
    headingHereBtn.type = "button";
    headingHereBtn.textContent = "Heading Here";
    headingHereBtn.setAttribute("aria-label", `Heading Here: ${card.address || card.stopId}`);
    headingHereBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        beginAssumedRouteLocation(card.stopId);
    });
    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.textContent = "Up";
    upBtn.disabled = index === 0;
    upBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        if (index === 0) return;
        const tmp = routeIds[index - 1];
        routeIds[index - 1] = routeIds[index];
        routeIds[index] = tmp;
        persistActiveRoute("manually_changed");
        renderRouteList();
    });
    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.textContent = "Down";
    downBtn.disabled = index === routeIds.length - 1;
    downBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        if (index === routeIds.length - 1) return;
        const tmp = routeIds[index + 1];
        routeIds[index + 1] = routeIds[index];
        routeIds[index] = tmp;
        persistActiveRoute("manually_changed");
        renderRouteList();
    });
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        routeIds = routeIds.filter((id) => id !== card.stopId);
        persistActiveRoute(markRouteManuallyChanged());
        if (plannerFocusedStopId === card.stopId) plannerFocusedStopId = null;
        renderRouteList();
        renderJobsList();
    });
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!jobs.some((job) => job.id === card.stopId)) return;
        const addEditView = document.getElementById("addressViewAddEdit");
        if (addEditView) addEditView.checked = true;
        showPage("addresses");
        startEditJob(card.stopId, true);
    });
    actions.append(headingHereBtn, upBtn, downBtn, editBtn, removeBtn);
    // Reuse the existing completion control only on the current first stop.
    // Reparenting preserves its original Done & Navigate Next event handler.
    if (
        index === 0 &&
        card.stopId === routeIds[0] &&
        els.completeAndNavigateNext
    ) {
        actions.prepend(els.completeAndNavigateNext);
    }
    li.appendChild(actions);
    li.addEventListener("click", (event) => {
        if (event.target?.closest?.("button")) return;
        focusPlannerStop(card.stopId);
    });
    li.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if (event.target?.closest?.("button")) return;
        event.preventDefault();
        focusPlannerStop(card.stopId);
    });
    return li;
}

function clearPlannerMarkers() {
    for (const marker of plannerMarkersByStopId.values()) marker.remove?.();
    plannerMarkersByStopId = new Map();
}

function plannerMapCanRender() {
    const mobile =
        globalThis.matchMedia?.("(max-width: 760px)")?.matches === true;
    return !mobile || plannerViewMode === "map";
}

function renderPlannerMap(model) {
    if (!plannerEls.mapStatus || !plannerEls.map || !plannerEls.mapEmpty) return;
    const plotted = model?.mapPlottableStopIds?.length || 0;
    const total = model?.stopCards?.length || 0;
    const unplottable = model?.unplottableStopIds?.length || 0;
    plannerEls.mapStatus.textContent =
        `${plotted} of ${total} route stop${total === 1 ? "" : "s"} plotted` +
        (unplottable
            ? ` • ${unplottable} without a saved display pin`
            : "");
    if (!plannerMapCanRender() || plannerEls.routePage?.hidden) return;
    clearPlannerMarkers();
    if (!globalThis.L || plotted === 0) {
        plannerEls.mapEmpty.hidden = false;
        plannerEls.mapEmpty.textContent = total
            ? "No route stops with saved display coordinates are available for this map. The full route remains in the list."
            : "Add route stops to see them on the map.";
        if (plannerMap) plannerMap.invalidateSize?.();
        return;
    }
    plannerEls.mapEmpty.hidden = true;
    if (!plannerMap) {
        plannerMap = globalThis.L.map(plannerEls.map, {
            zoomControl: true,
            attributionControl: true,
        });
        addFreeMapLayers(plannerMap);
    }
    const bounds = [];
    for (const card of model.stopCards || []) {
        if (!card.mapPlottable || !card.coordinates) continue;
        const point = [card.coordinates.latitude, card.coordinates.longitude];
        const marker = globalThis.L.marker(point, {
            draggable: false,
            title: `${card.routeNumber}. ${card.address}`,
            icon: globalThis.L.divIcon({
                className: "plannerMarkerHost",
                html: `<span class="plannerMarkerIcon">${String(card.routeNumber).padStart(2, "0")}</span>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15],
            }),
        }).addTo(plannerMap);
        const tooltip = document.createElement("span");
        tooltip.textContent = `${card.routeNumber}. ${card.address}`;
        marker.bindTooltip(tooltip, { direction: "top" });
        marker.on("click", () => focusPlannerStop(card.stopId));
        plannerMarkersByStopId.set(card.stopId, marker);
        bounds.push(point);
    }
    plannerMap.invalidateSize?.();
    if (bounds.length === 1) plannerMap.setView(bounds[0], 15);
    else if (bounds.length > 1)
        plannerMap.fitBounds(bounds, { padding: [24, 24] });
    if (plannerFocusedStopId) focusPlannerStop(plannerFocusedStopId);
}

function renderPlannerRouteCards(model) {
    const list = els.routeList;
    if (!list) return;
    list.innerHTML = "";
    if (!home) {
        const li = document.createElement("li");
        li.className = "plannerEndpoint";
        li.textContent = "Save your Home / Route Base first.";
        list.appendChild(li);
        return;
    }
    const start = document.createElement("li");
    start.className = "plannerEndpoint";
    start.textContent = `Start — ${home.address}`;
    list.appendChild(start);
    if (!model.stopCards.length) {
        const li = document.createElement("li");
        li.className = "plannerEndpoint";
        li.textContent = "No addresses selected for route.";
        list.appendChild(li);
    } else {
        if (
            plannerFocusedStopId &&
            !model.stopCards.some((card) => card.stopId === plannerFocusedStopId)
        ) {
            plannerFocusedStopId = null;
        }
        const timeZone = plannerDayContext()?.timeZone || "UTC";
        model.stopCards.forEach((card, index) =>
            list.appendChild(plannerCard(card, index, timeZone)),
        );
    }
    const finish = document.createElement("li");
    finish.className = "plannerEndpoint";
    finish.textContent = `Finish — ${home.address}`;
    list.appendChild(finish);
}

function positionCurrentCompletionControl() {
    const button = els.completeAndNavigateNext;
    if (!button) return;
    const firstCard = document.querySelector("#routeList > li.plannerStopCard");
    const currentActions =
        firstCard?.dataset.stopId === routeIds[0]
            ? firstCard.querySelector(".plannerCardActions")
            : null;
    const mapOnlyOnPhone =
        plannerViewMode === "map" &&
        globalThis.matchMedia?.("(max-width: 760px)")?.matches === true;
    if (!mapOnlyOnPhone && currentActions) {
        currentActions.prepend(button);
    } else {
        document.querySelector("#routePage .plannerExecutionActions")
            ?.appendChild(button);
    }
}

function renderPlannerPresentation() {
    const { model, plannerError } = activePlannerModel();
    renderAssumedRouteLocationStatus();
    renderPlannerDaySummary(model, plannerError);
    renderPlannerRouteCards(model);
    positionCurrentCompletionControl();
    renderPlannerMap(model);
    return model;
}

function setPlannerView(mode) {
    plannerViewMode = mode === "map" ? "map" : "list";
    if (plannerEls.workspace) {
        plannerEls.workspace.dataset.plannerView = plannerViewMode;
    }
    for (const button of
        plannerEls.viewToggle?.querySelectorAll?.("[data-planner-view]") || []) {
        button.setAttribute(
            "aria-pressed",
            button.dataset.plannerView === plannerViewMode ? "true" : "false",
        );
    }
    positionCurrentCompletionControl();
    if (plannerViewMode === "map") {
        const { model } = activePlannerModel();
        renderPlannerMap(model);
    }
}

renderRouteList = function plannerAwareRenderRouteList() {
    refreshPlannerRouteHistory();
    renderRouteChoice();
    renderGoogleInsertionChoices();
    renderRouteOptimizationStatus();
    renderRoutePaySummary();
    renderGoogleMapsActions();
    if (els.completeAndNavigateNext) {
        els.completeAndNavigateNext.disabled = !home || routeIds.length === 0;
    }
    if (els.startRouteNavigation) {
        els.startRouteNavigation.disabled = !home || routeIds.length === 0;
    }
    if (els.sendRouteOrder) {
        els.sendRouteOrder.disabled =
            routeIds.length === 0 || Boolean(routeOrderSendPromise);
    }
    if (els.reverseRoute) {
        els.reverseRoute.disabled =
            routeIds.length < 2 || Boolean(routeOrderSendPromise);
    }
    return renderPlannerPresentation();
};

const originalShowPageForC2 = showPage;
showPage = function plannerAwareShowPage(pageName) {
    const result = originalShowPageForC2(pageName);
    const resolved = ["home", "addresses", "import", "route", "settings"].includes(
        pageName,
    )
        ? pageName
        : "home";
    if (resolved === "route") {
        renderRouteList();
        plannerMap?.invalidateSize?.();
    }
    return result;
};

plannerEls.viewToggle?.addEventListener("click", (event) => {
    const button = event.target?.closest?.("[data-planner-view]");
    if (!button) return;
    setPlannerView(button.dataset.plannerView);
});

for (const inputId of [
    "routeDate",
    "routeDepartureTime",
    "routePreferredFinishTime",
    "routeHomeByTime",
    "routeHomeByEnabled",
]) {
    document.getElementById(inputId)?.addEventListener("change", () => {
        refreshPlannerRouteHistory();
        renderRouteList();
    });
}

document.addEventListener("submit", (event) => {
    if (event.target?.id !== "workItemPlanningForm") return;
    queueMicrotask(() => renderRouteList());
});

const routeBridgeBeforePlanner = globalThis.FMRRouteBridge;
globalThis.FMRRouteBridge = Object.freeze({
    ...routeBridgeBeforePlanner,
    setRouteStatus(message) {
        refreshPlannerRouteHistory();
        renderRouteList();
        const text = String(message || "");
        if (
            text.startsWith("Tap Check Workbook Route to connect Google Drive") &&
            els.workbookRouteCheckStatus
        ) {
            els.workbookRouteCheckStatus.textContent = text;
        } else if (els.routeStatus) {
            els.routeStatus.textContent = text;
        }
    },
});

setPlannerView("list");
renderRouteList();
