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

if (!globalThis.FMRRouteHistory) {
    throw new Error("Free Map Router route history failed to load.");
}

if (!globalThis.FMRRouteOrder) {
    throw new Error("Free Map Router route order failed to load.");
}

const {
    normalizeAddress,
    addressKey,
    normalizeStop,
    readStops,
    writeStops,
    readHome,
    writeHome,
} = globalThis.FMRContract;

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
    readRouteHistory,
    replaceRoute,
    setRouteOptimizationStatus,
    stageWorkbookRoute,
    startPendingRoute,
    workbookRouteRelation,
    writeRouteHistory,
} = globalThis.FMRRouteHistory;
const {
    buildWorkbookRouteOrder,
    workbookOrderIdCount,
} = globalThis.FMRRouteOrder;
const {
    createLatestDriveSaveQueue,
    loadBackupFromDrive,
    requestDriveToken,
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
let routeIds = routeHistory.google?.routeIds.slice() || [];
let editingJobId = null;
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
    routeList: document.getElementById("routeList"),
    routeChoice: document.getElementById("routeChoice"),
    routeOptimizationStatus: document.getElementById(
        "routeOptimizationStatus",
    ),
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
    routeMapLinks: document.getElementById("routeMapLinks"),
    clearRoute: document.getElementById("clearRoute"),
    startRouteNavigation: document.getElementById("startRouteNavigation"),
    completeAndNavigateNext: document.getElementById(
        "completeAndNavigateNext",
    ),

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
function getFilteredJobs() {
    return jobs;
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

function renderGoogleMapsActions() {
    if (!els.exportRoute || !els.routeMapLinks) return;

    els.routeMapLinks.innerHTML = "";
    els.routeMapLinks.hidden = true;
    els.exportRoute.hidden = false;

    if (!home || routeIds.length === 0) return;

    const sections = buildGoogleMapsRouteSections(home, selectedRouteJobs());
    if (sections.length <= 1) return;

    els.exportRoute.hidden = true;
    els.routeMapLinks.hidden = false;

    const message = document.createElement("span");
    message.className = "tiny muted";
    message.textContent =
        `Open these ${sections.length} map sections in order:`;
    els.routeMapLinks.appendChild(message);

    for (const section of sections) {
        const link = document.createElement("a");
        link.className = "btn btnSmall";
        link.href = section.url;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = `Map ${section.number} of ${section.total}`;
        els.routeMapLinks.appendChild(link);
    }
}

function renderJobsList() {
    const list = els.jobList;
    if (!list) return;
    list.innerHTML = "";

    const filtered = getFilteredJobs();

    if (filtered.length === 0) {
        const li = document.createElement("li");
        li.textContent = "No addresses yet.";
        list.appendChild(li);
        return;
    }

    for (const job of filtered) {
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
        li.appendChild(label);
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
    renderRouteOptimizationStatus();
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

function renderRouteChoice() {
    if (!els.routeChoice) return;
    els.routeChoice.value = activeRouteSlot;
    const googleOption = els.routeChoice.querySelector(
        'option[value="google"]',
    );
    const basicOption = els.routeChoice.querySelector(
        'option[value="basic"]',
    );
    if (googleOption) {
        googleOption.disabled =
            !routeHistory.google || routeHistory.google.routeIds.length === 0;
    }
    if (basicOption) {
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

if (els.startNewRoute) {
    els.startNewRoute.addEventListener("click", () => {
        const pendingCount = routeHistory.pending?.routeIds.length || 0;
        if (pendingCount === 0) return;
        if (
            !confirm(
                `Start the new ${pendingCount}-job route? This replaces both the saved Google Route and Basic Route. Saved addresses and pins will be kept.`,
            )
        ) {
            return;
        }

        const started = startPendingRoute(routeHistory, savedJobIds());
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

// ============================================================================
// SECTION 9 — Address Suggestions (Saved-only, Offline)
// ============================================================================
function refreshAddressSuggestions() {
    const dl = els.addressSuggestions;
    if (!dl) return;

    const q = (els.address?.value || "").trim().toLowerCase();

    const pool = [];
    const seen = new Set();

    for (const job of jobs) {
        const a = (job.address || "").trim();
        if (!a) continue;
        const key = a.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        pool.push(a);
    }

    const filtered = q ? pool.filter((a) => a.toLowerCase().includes(q)) : pool;
    const cap = filtered.slice(0, 8);

    dl.innerHTML = "";
    for (const a of cap) {
        const opt = document.createElement("option");
        opt.value = a;
        dl.appendChild(opt);
    }
}

// ============================================================================
// SECTION 11 — Job CRUD (Add/Edit)
// ============================================================================
function resetForm() {
    editingJobId = null;
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

function startEditJob(jobId) {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;

    editingJobId = jobId;

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

async function optimizeSelectedRoute() {
    activateRouteSlot("basic");
    const basicRouteIds = routeIds.slice();
    if (basicRouteIds.length < 2) {
        alert("Select at least 2 addresses to optimize.");
        return;
    }

    let selected = basicRouteIds
        .map((id) => jobs.find((j) => j.id === id))
        .filter(Boolean);

    if (home?.latitude == null || home?.longitude == null) {
        alert("Verify the Home location before optimizing the route.");
        showPage("home");
        return;
    }

    const missingCoords = selected.filter(
        (j) => j.latitude == null || j.longitude == null,
    );

    if (missingCoords.length > 0) {
        const apiKey = readGeoapifyKey(localStorage);
        if (!apiKey) {
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
            if (els.routeStatus) {
                els.routeStatus.textContent =
                    error?.message || "A location could not be prepared.";
            }
            return;
        } finally {
            els.optimizeRoute.disabled = false;
        }
    }

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
    if (els.routeStatus) {
        const sections = buildGoogleMapsRouteSections(home, ordered);
        const mapsReady =
            sections.length > 1
                ? ` ${sections.length} numbered Google Maps sections are ready below.`
                : "";
        els.routeStatus.textContent =
            `Route optimized with ${selected.length} address${selected.length === 1 ? "" : "es"}.${mapsReady}`;
    }
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

    routeIds = nextRouteIds;
    persistActiveRoute(
        nextRouteIds.length === 0 ? "not_optimized" : null,
    );
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
        const inbox = parseAddressInbox(await loadInbox());

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
    els.jobForm.addEventListener("submit", (e) => {
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

        const job = normalizeStop({
            id: editingJobId || uid(),
            address,
            label,
            latitude: latProvided && lonProvided ? lat : null,
            longitude: latProvided && lonProvided ? lon : null,
            notes: notes || "",
            pinStatus:
                latProvided && lonProvided
                    ? formPinStatus
                    : "unverified",
        });

        if (editingJobId) {
            jobs = jobs.map((j) => (j.id === editingJobId ? job : j));
        } else {
            jobs.push(job);
        }

        writeJobs(jobs);
        resetForm();
        renderAll();
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
});

showPage("home");
renderAll();
refreshAddressSuggestions();
