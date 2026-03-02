// Free Map Router — V1 (Vanilla)
// localStorage + job CRUD (add/delete/edit) + filter + route selection rendering
// Optimize Route: nearest-neighbor IF all selected have coords; otherwise keep manual order
// Export: Google Maps Directions URL in the current route order
// CSV Import: file picker + pasted CSV text, de-dupe by (company + address), coords optional
// Drag/drop: global drop handler for CSV files (Windows File Explorer works best)
// Company picks: manual Top 10 quick-picks stored in localStorage
// Address suggestions: offline-only datalist from saved jobs (same-company prioritized)

// ============================================================================
// SECTION 1 — Storage Keys
// ============================================================================
const STORAGE_KEY = "fmr_v1_jobs";
const PICKS_KEY = "fmr_v1_company_picks";

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

function safeJsonParse(raw, fallback) {
    try {
        const v = JSON.parse(raw);
        return v ?? fallback;
    } catch {
        return fallback;
    }
}

function readJobs() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = safeJsonParse(raw, []);
    return Array.isArray(parsed) ? parsed : [];
}

function writeJobs(jobs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
}

function readCompanyPicks() {
    const raw = localStorage.getItem(PICKS_KEY);
    const parsed = safeJsonParse(raw, []);
    return Array.isArray(parsed) ? parsed : [];
}

function writeCompanyPicks(picks) {
    localStorage.setItem(PICKS_KEY, JSON.stringify(picks));
}

function normalizeCompany(company) {
    const c = (company ?? "").toString().trim();
    return c || "Unknown";
}

function normalizeAddress(address) {
    return (address ?? "").toString().trim();
}

function toNumberOrNull(v) {
    const s = (v ?? "").toString().trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

function clampCompanyPicks(picks) {
    const out = [];
    const seen = new Set();
    for (const p of picks) {
        const v = (p ?? "").toString().trim();
        if (!v) continue;
        const key = v.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(v);
        if (out.length >= 10) break;
    }
    return out;
}

// ============================================================================
// SECTION 3 — Distance Utilities (Haversine) + Nearest Neighbor
// ============================================================================
function toRad(deg) {
    return (deg * Math.PI) / 180;
}

function haversineMiles(lat1, lon1, lat2, lon2) {
    const R = 3958.8; // Earth radius miles
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Nearest-neighbor reorder (simple heuristic)
function nearestNeighborOrder(jobsWithCoords) {
    if (jobsWithCoords.length <= 2) return jobsWithCoords.slice();

    const remaining = jobsWithCoords.slice();
    const route = [];
    route.push(remaining.shift()); // start at first in list

    while (remaining.length) {
        const last = route[route.length - 1];
        let bestIdx = 0;
        let bestDist = Infinity;

        for (let i = 0; i < remaining.length; i++) {
            const cand = remaining[i];
            const d = haversineMiles(
                last.latitude,
                last.longitude,
                cand.latitude,
                cand.longitude,
            );
            if (d < bestDist) {
                bestDist = d;
                bestIdx = i;
            }
        }
        route.push(remaining.splice(bestIdx, 1)[0]);
    }

    return route;
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
    // De-dupe by (company + address)
    const existing = jobs.slice();
    const seen = new Set(
        existing.map(
            (j) =>
                `${(j.company || "").toLowerCase()}|${(j.address || "").toLowerCase()}`,
        ),
    );

    let added = 0;

    for (const row of rows) {
        const company = normalizeCompany(
            pickFirst(row, ["Client", "Company", "company", "client"]),
        );

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

        const key = `${company.toLowerCase()}|${address.toLowerCase()}`;
        if (seen.has(key)) continue;

        seen.add(key);

        existing.push({
            id: uid(),
            company,
            address,
            latitude: coordLat,
            longitude: coordLon,
            notes: notes || "",
        });

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
    alert(`Imported ${added} new jobs (de-duped by company + address).`);
}

// ============================================================================
// SECTION 5 — State
// ============================================================================
let jobs = readJobs();
let activeCompanyFilter = "";
let routeIds = [];
let editingJobId = null;
let companyPicks = readCompanyPicks();

// ============================================================================
// SECTION 6 — DOM
// ============================================================================
const els = {
    // import
    csvFile: document.getElementById("csvFile"),
    importCsvBtn: document.getElementById("importCsvBtn"),
    csvText: document.getElementById("csvText"),
    importCsvTextBtn: document.getElementById("importCsvTextBtn"),
    dropHint: document.getElementById("dropHint"),

    // company picks
    companyPicks: document.getElementById("companyPicks"),
    addCompanyPickBtn: document.getElementById("addCompanyPickBtn"),
    clearCompanyPicksBtn: document.getElementById("clearCompanyPicksBtn"),

    // address suggestions
    addressSuggestions: document.getElementById("addressSuggestions"),

    // job form
    jobForm: document.getElementById("jobForm"),
    company: document.getElementById("company"),
    address: document.getElementById("address"),
    latitude: document.getElementById("latitude"),
    longitude: document.getElementById("longitude"),
    notes: document.getElementById("notes"),

    // filtering
    companyFilter: document.getElementById("companyFilter"),
    clearFilter: document.getElementById("clearFilter"),

    // lists
    jobList: document.getElementById("jobList"),
    routeList: document.getElementById("routeList"),

    // actions
    optimizeRoute: document.getElementById("optimizeRoute"),
    exportRoute: document.getElementById("exportRoute"),
};

// ============================================================================
// SECTION 7 — Selection Controls (Select All / Clear / Delete Selected)
//  - Select All: adds filtered jobs to the routeIds selection
//  - Clear: clears routeIds only (does not delete jobs)
//  - Delete Selected: deletes jobs currently selected (checked) with confirmation,
//    then clears routeIds
// ============================================================================
function deleteSelectedJobs() {
    if (routeIds.length === 0) {
        alert("No jobs selected to delete.");
        return;
    }

    const ok = confirm(
        `Delete ${routeIds.length} selected job(s)? This cannot be undone.`,
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
    btnClear.textContent = "Clear";

    // NEW: Delete button beside Clear
    const btnDeleteSelected = document.createElement("button");
    btnDeleteSelected.type = "button";
    btnDeleteSelected.textContent = "Delete";

    wrap.appendChild(btnSelectAll);
    wrap.appendChild(btnClear);
    wrap.appendChild(btnDeleteSelected);

    // Insert controls right above the job list
    const parent = els.jobList.parentNode;
    if (parent) parent.insertBefore(wrap, els.jobList);

    // Select All = only filtered jobs
    btnSelectAll.addEventListener("click", () => {
        const filtered = getFilteredJobs();
        const set = new Set(routeIds);
        for (const j of filtered) set.add(j.id);
        routeIds = Array.from(set);
        renderJobsList();
        renderRouteList();
    });

    // Clear = clear route selection only
    btnClear.addEventListener("click", () => {
        routeIds = [];
        renderJobsList();
        renderRouteList();
    });

    // Delete Selected = delete checked jobs + clear route (confirmed)
    btnDeleteSelected.addEventListener("click", () => {
        deleteSelectedJobs();
    });
}

// ============================================================================
// SECTION 8 — Rendering
// ============================================================================
function getFilteredJobs() {
    if (!activeCompanyFilter) return jobs;
    return jobs.filter((j) => j.company === activeCompanyFilter);
}

function renderCompanyFilterOptions() {
    const companies = Array.from(new Set(jobs.map((j) => j.company))).sort(
        (a, b) => a.localeCompare(b),
    );

    const selected = activeCompanyFilter;

    if (!els.companyFilter) return;
    els.companyFilter.innerHTML = "";

    const allOpt = document.createElement("option");
    allOpt.value = "";
    allOpt.textContent = "All Companies";
    els.companyFilter.appendChild(allOpt);

    for (const c of companies) {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        els.companyFilter.appendChild(opt);
    }

    if (selected && companies.includes(selected)) {
        els.companyFilter.value = selected;
    } else {
        els.companyFilter.value = "";
        activeCompanyFilter = "";
    }
}

function formatJobLine(job) {
    const addr = job.address ? ` — ${job.address}` : "";
    const coords =
        job.latitude != null && job.longitude != null
            ? ` (${job.latitude}, ${job.longitude})`
            : "";
    const notesRaw = String(job.notes || "").trim();
    const notes = notesRaw ? ` | Notes: ${notesRaw}` : "";
    return `${job.company}${coords}${addr}${notes}`;
}

function renderJobsList() {
    const list = els.jobList;
    if (!list) return;
    list.innerHTML = "";

    const filtered = getFilteredJobs();

    if (filtered.length === 0) {
        const li = document.createElement("li");
        li.textContent = "No jobs yet.";
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
            jobs = jobs.filter((j) => j.id !== job.id);
            routeIds = routeIds.filter((id) => id !== job.id);

            if (editingJobId === job.id) {
                editingJobId = null;
                if (els.jobForm) els.jobForm.reset();
            }

            writeJobs(jobs);
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
    list.innerHTML = "";

    if (routeIds.length === 0) {
        const li = document.createElement("li");
        li.textContent = "No jobs selected for route.";
        list.appendChild(li);
        return;
    }

    for (let i = 0; i < routeIds.length; i++) {
        const jobId = routeIds[i];
        const job = jobs.find((j) => j.id === jobId);
        if (!job) continue;

        const li = document.createElement("li");

        const label = document.createElement("span");
        label.textContent = formatJobLine(job);

        const upBtn = document.createElement("button");
        upBtn.textContent = "Up";
        upBtn.style.width = "auto";
        upBtn.disabled = i === 0;
        upBtn.addEventListener("click", () => {
            if (i === 0) return;
            const tmp = routeIds[i - 1];
            routeIds[i - 1] = routeIds[i];
            routeIds[i] = tmp;
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
            renderRouteList();
        });

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "Remove";
        removeBtn.style.width = "auto";
        removeBtn.addEventListener("click", () => {
            routeIds = routeIds.filter((id) => id !== jobId);
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

function renderAll() {
    ensureSelectionControls();
    renderCompanyPicks();
    renderCompanyFilterOptions();
    renderJobsList();
    renderRouteList();
}

// ============================================================================
// SECTION 9 — Address Suggestions (Saved-only, Offline)
// ============================================================================
function refreshAddressSuggestions() {
    const dl = els.addressSuggestions;
    if (!dl) return;

    const company = (els.company?.value || "").trim();
    const q = (els.address?.value || "").trim().toLowerCase();

    const sameCompany = [];
    const otherCompany = [];

    for (const j of jobs) {
        const addr = (j.address || "").trim();
        if (!addr) continue;

        if (company && j.company === company) sameCompany.push(addr);
        else otherCompany.push(addr);
    }

    const pool = [];
    const seen = new Set();

    for (const a of [...sameCompany, ...otherCompany]) {
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
// SECTION 10 — Company Picks (Top 10 Manual)
// ============================================================================
function renderCompanyPicks() {
    const host = els.companyPicks;
    if (!host) return;

    host.innerHTML = "";

    companyPicks = clampCompanyPicks(companyPicks);
    writeCompanyPicks(companyPicks);

    for (const c of companyPicks) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = c;
        btn.style.width = "auto";
        btn.addEventListener("click", () => {
            if (els.company) els.company.value = c;
            if (els.address) els.address.focus();
            refreshAddressSuggestions();
        });
        host.appendChild(btn);
    }

    if (companyPicks.length === 0) {
        const span = document.createElement("span");
        span.textContent = "No company picks yet.";
        span.style.opacity = "0.8";
        span.style.fontSize = "12px";
        host.appendChild(span);
    }
}

// ============================================================================
// SECTION 11 — Job CRUD (Add/Edit)
// ============================================================================
function resetForm() {
    editingJobId = null;
    if (els.jobForm) els.jobForm.reset();
    if (els.company) els.company.focus();
    refreshAddressSuggestions();
}

function startEditJob(jobId) {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;

    editingJobId = jobId;

    if (els.company) els.company.value = job.company || "";
    if (els.address) els.address.value = job.address || "";
    if (els.latitude)
        els.latitude.value = job.latitude != null ? String(job.latitude) : "";
    if (els.longitude)
        els.longitude.value =
            job.longitude != null ? String(job.longitude) : "";
    if (els.notes) els.notes.value = job.notes || "";

    if (els.company) els.company.focus();
    refreshAddressSuggestions();
}

// ============================================================================
// SECTION 12 — Optimize Route + Export
// ============================================================================
function optimizeSelectedRoute() {
    if (routeIds.length < 2) {
        alert("Select at least 2 jobs to optimize.");
        return;
    }

    const selected = routeIds
        .map((id) => jobs.find((j) => j.id === id))
        .filter(Boolean);

    const anyMissingCoords = selected.some(
        (j) => j.latitude == null || j.longitude == null,
    );

    if (anyMissingCoords) {
        alert(
            "Not all selected jobs have coordinates. Keeping your manual order.",
        );
        return;
    }

    const ordered = nearestNeighborOrder(selected);
    routeIds = ordered.map((j) => j.id);
    renderRouteList();
}

function exportToGoogleMaps() {
    if (routeIds.length === 0) {
        alert("No jobs selected for route.");
        return;
    }

    const selected = routeIds
        .map((id) => jobs.find((j) => j.id === id))
        .filter(Boolean);

    const addresses = selected
        .map((j) => (j.address || "").trim())
        .filter(Boolean);

    if (addresses.length === 0) {
        alert("Selected jobs have no addresses.");
        return;
    }

    const origin = encodeURIComponent(addresses[0]);
    const destination = encodeURIComponent(addresses[addresses.length - 1]);

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;

    if (addresses.length > 2) {
        const waypoints = addresses
            .slice(1, -1)
            .map(encodeURIComponent)
            .join("|");
        url += `&waypoints=${waypoints}`;
    }

    window.open(url, "_blank");
}

// ============================================================================
// SECTION 13 — Event Wiring
// ============================================================================
if (els.companyFilter) {
    els.companyFilter.addEventListener("change", () => {
        activeCompanyFilter = els.companyFilter.value || "";
        renderJobsList();
    });
}

if (els.clearFilter) {
    els.clearFilter.addEventListener("click", () => {
        activeCompanyFilter = "";
        if (els.companyFilter) els.companyFilter.value = "";
        renderJobsList();
    });
}

if (els.jobForm) {
    els.jobForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const company = normalizeCompany(els.company?.value);
        const address = normalizeAddress(els.address?.value);

        const lat = toNumberOrNull(els.latitude?.value);
        const lon = toNumberOrNull(els.longitude?.value);

        const notes = (els.notes?.value ?? "").toString();

        if (!company || company === "Unknown") {
            alert("Company is required.");
            return;
        }
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

        const job = {
            id: editingJobId || uid(),
            company,
            address,
            latitude: latProvided && lonProvided ? lat : null,
            longitude: latProvided && lonProvided ? lon : null,
            notes: notes || "",
        };

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

if (els.company) {
    els.company.addEventListener("input", () => refreshAddressSuggestions());
}
if (els.address) {
    els.address.addEventListener("input", () => refreshAddressSuggestions());
}

// Company picks controls
if (els.addCompanyPickBtn) {
    els.addCompanyPickBtn.addEventListener("click", () => {
        const c = (els.company?.value || "").trim();
        if (!c) {
            alert("Enter a company first.");
            return;
        }

        companyPicks = clampCompanyPicks([c, ...companyPicks]);
        writeCompanyPicks(companyPicks);
        renderCompanyPicks();
    });
}

if (els.clearCompanyPicksBtn) {
    els.clearCompanyPicksBtn.addEventListener("click", () => {
        const ok = confirm("Clear Top 10 company picks?");
        if (!ok) return;
        companyPicks = [];
        writeCompanyPicks(companyPicks);
        renderCompanyPicks();
    });
}

// Optimize / Export buttons
if (els.optimizeRoute) {
    els.optimizeRoute.addEventListener("click", optimizeSelectedRoute);
}

if (els.exportRoute) {
    els.exportRoute.addEventListener("click", exportToGoogleMaps);
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
renderAll();
refreshAddressSuggestions();
