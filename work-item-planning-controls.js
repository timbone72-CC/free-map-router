(function attachWorkItemPlanningControls(root) {
    "use strict";

    const planningContract = root?.FMRWorkItemPlanning;
    const planningRuntime = root?.FMRWorkItemPlanningRuntime;

    if (!planningContract || !planningRuntime) {
        throw new Error("Free Map Router work-item planning controls failed to load.");
    }

    const { workItemKey } = planningContract;
    let selectedPlanningKey = null;
    let planningRenderHookInstalled = false;

    function uniqueIds(values) {
        const result = [];
        const seen = new Set();
        for (const value of Array.isArray(values) ? values : []) {
            const id = String(value ?? "").trim();
            if (!id || seen.has(id)) continue;
            seen.add(id);
            result.push(id);
        }
        return result;
    }

    function planningRefsForSnapshot(snapshot) {
        const routeStopIds = uniqueIds(snapshot?.routeIds);
        const orderIdsByStopId = snapshot?.orderIdsByStopId || {};
        const gigIdsByStopId = snapshot?.gigIdsByStopId || {};
        const refs = [];
        const identityStops = new Map();

        for (const stopId of routeStopIds) {
            const stopRefs = [
                ...uniqueIds(orderIdsByStopId[stopId]).map((workItemId) => ({
                    stopId,
                    kind: "workbook",
                    workItemId,
                })),
                ...uniqueIds(gigIdsByStopId[stopId]).map((workItemId) => ({
                    stopId,
                    kind: "gig",
                    workItemId,
                })),
            ];

            for (const ref of stopRefs) {
                const key = workItemKey(ref.kind, ref.workItemId);
                const previousStopId = identityStops.get(key);
                if (previousStopId && previousStopId !== stopId) {
                    throw new Error(
                        `Work item ${key} is attached to more than one route stop.`,
                    );
                }
                identityStops.set(key, stopId);
                refs.push(ref);
            }
        }

        return refs;
    }

    function ensurePlanningPanel() {
        let panel = document.getElementById("workItemPlanningPanel");
        if (panel) return panel;

        const anchor = document.getElementById("routeStatus");
        if (!anchor?.parentElement) return null;

        panel = document.createElement("div");
        panel.id = "workItemPlanningPanel";
        panel.className = "subSection";
        panel.innerHTML = `
            <div class="inlineHeader">
                <strong>Plan Work Item</strong>
                <span id="workItemPlanningRouteSummary" class="tiny muted"></span>
            </div>
            <p class="tiny muted">
                Planning belongs to the exact Order ID or Gig_ID, not the address.
                Blank InspectorADE minutes use the current default. Manual gigs need
                an explicit duration before their service time is known.
            </p>
            <form id="workItemPlanningForm">
                <label>
                    Work item
                    <select id="workItemPlanningSelect"></select>
                </label>
                <div class="row2">
                    <label>
                        Service minutes
                        <input
                            id="workItemPlanningMinutes"
                            type="number"
                            min="0.1"
                            step="0.1"
                            inputmode="decimal"
                            placeholder="Use default"
                        />
                    </label>
                    <label>
                        Assigned day
                        <input id="workItemPlanningDate" type="date" />
                    </label>
                </div>
                <label style="display:flex;align-items:center;gap:6px;">
                    <input
                        id="workItemPlanningLocked"
                        type="checkbox"
                        style="display:inline-block;width:auto;margin:0;padding:0;"
                    />
                    Lock to assigned day
                </label>
                <div class="btnRow">
                    <button
                        id="saveWorkItemPlanning"
                        type="submit"
                        class="btn btnSmall"
                    >
                        Save Planning
                    </button>
                </div>
            </form>
            <p id="workItemPlanningStatus" class="tiny muted"></p>
        `;
        anchor.insertAdjacentElement("beforebegin", panel);

        document
            .getElementById("workItemPlanningSelect")
            ?.addEventListener("change", () => {
                selectedPlanningKey = selectedPlanningRef()?.key || null;
                loadSelectedPlanning();
            });
        document
            .getElementById("workItemPlanningForm")
            ?.addEventListener("submit", saveSelectedPlanning);

        return panel;
    }

    function activeRouteSnapshot() {
        return routeHistory?.[activeRouteSlot] || null;
    }

    function stopForId(stopId) {
        return jobs.find((job) => job.id === stopId) || null;
    }

    function manualGigMap() {
        const list = root.FMRManualGigs?.list?.() || [];
        return new Map(list.map((gig) => [String(gig.id || ""), gig]));
    }

    function planningLabel(ref, gigs) {
        const stop = stopForId(ref.stopId);
        const address = stop?.address ? ` — ${stop.address}` : "";
        if (ref.kind === "workbook") {
            const source = String(stop?.source || "InspectorADE").trim();
            return `${source} Order ${ref.workItemId}${address}`;
        }

        const gig = gigs.get(ref.workItemId);
        const source = String(gig?.source || "Manual").trim();
        const workOrder = String(gig?.workOrderId || "").trim();
        const identity = workOrder
            ? `${source} WO ${workOrder} (Gig ${ref.workItemId})`
            : `${source} Gig ${ref.workItemId}`;
        return `${identity}${address}`;
    }

    function selectedPlanningRef() {
        const select = document.getElementById("workItemPlanningSelect");
        const option = select?.options?.[select.selectedIndex];
        if (!option?.dataset?.kind || !option?.dataset?.workItemId) return null;
        return {
            kind: option.dataset.kind,
            workItemId: option.dataset.workItemId,
            stopId: option.dataset.stopId || "",
            key: option.value,
            label: option.textContent || option.value,
        };
    }

    function setPlanningFieldsDisabled(disabled) {
        for (const id of [
            "workItemPlanningMinutes",
            "workItemPlanningDate",
            "workItemPlanningLocked",
            "saveWorkItemPlanning",
        ]) {
            const element = document.getElementById(id);
            if (element) element.disabled = Boolean(disabled);
        }
    }

    function loadSelectedPlanning() {
        const ref = selectedPlanningRef();
        const form = document.getElementById("workItemPlanningForm");
        const minutes = document.getElementById("workItemPlanningMinutes");
        const date = document.getElementById("workItemPlanningDate");
        const locked = document.getElementById("workItemPlanningLocked");
        const status = document.getElementById("workItemPlanningStatus");
        if (!form || !minutes || !date || !locked || !status) return;

        if (!ref) {
            form.dataset.expectedRevision = "0";
            minutes.value = "";
            date.value = "";
            locked.checked = false;
            setPlanningFieldsDisabled(true);
            status.textContent =
                "No exact Order IDs or Gig_IDs are attached to this route.";
            return;
        }

        const record = planningRuntime.get(ref.kind, ref.workItemId);
        form.dataset.expectedRevision = String(record?.revision || 0);
        minutes.value =
            record?.serviceMinutes === null || record?.serviceMinutes === undefined
                ? ""
                : String(record.serviceMinutes);
        date.value = record?.assignedDate || "";
        locked.checked = record?.lockedDay === true;
        setPlanningFieldsDisabled(false);
        if (record) {
            status.textContent =
                `Saved planning revision ${record.revision}. Change only what this exact work item needs.`;
        } else if (ref.kind === "workbook") {
            status.textContent =
                "No saved planning override. InspectorADE work currently uses the 5-minute default unless an exact override or verified interior rule applies.";
        } else {
            status.textContent =
                "No saved planning yet. Enter service minutes if this manual gig should count in route timing.";
        }
    }

    function renderPlanningControls() {
        const panel = ensurePlanningPanel();
        if (!panel) return;

        const select = document.getElementById("workItemPlanningSelect");
        const summary = document.getElementById("workItemPlanningRouteSummary");
        const status = document.getElementById("workItemPlanningStatus");
        if (!select || !summary || !status) return;

        const previousKey = selectedPlanningKey || select.value || null;
        let refs;
        try {
            refs = planningRefsForSnapshot(activeRouteSnapshot());
        } catch (error) {
            select.innerHTML = "";
            select.disabled = true;
            setPlanningFieldsDisabled(true);
            summary.textContent = "Planning unavailable";
            status.textContent =
                error?.message || "Route work identities could not be planned safely.";
            return;
        }

        const gigs = manualGigMap();
        select.innerHTML = "";
        for (const ref of refs) {
            const option = document.createElement("option");
            option.value = workItemKey(ref.kind, ref.workItemId);
            option.dataset.kind = ref.kind;
            option.dataset.workItemId = ref.workItemId;
            option.dataset.stopId = ref.stopId;
            option.textContent = planningLabel(ref, gigs);
            select.appendChild(option);
        }

        select.disabled = refs.length === 0;
        const routeName = activeRouteSlot === "basic" ? "Basic Route" : "Google Route";
        summary.textContent = refs.length
            ? `${routeName} • ${refs.length} work item${refs.length === 1 ? "" : "s"}`
            : `${routeName} • no exact work items`;

        if (refs.length === 0) {
            selectedPlanningKey = null;
            loadSelectedPlanning();
            return;
        }

        const matchingIndex = Array.from(select.options).findIndex(
            (option) => option.value === previousKey,
        );
        select.selectedIndex = matchingIndex >= 0 ? matchingIndex : 0;
        selectedPlanningKey = selectedPlanningRef()?.key || null;
        loadSelectedPlanning();
    }

    function saveSelectedPlanning(event) {
        event?.preventDefault?.();
        const ref = selectedPlanningRef();
        const form = document.getElementById("workItemPlanningForm");
        const minutes = document.getElementById("workItemPlanningMinutes");
        const date = document.getElementById("workItemPlanningDate");
        const locked = document.getElementById("workItemPlanningLocked");
        const status = document.getElementById("workItemPlanningStatus");
        if (!ref || !form || !minutes || !date || !locked || !status) return;

        const expectedRevision = Number(form.dataset.expectedRevision || 0);
        try {
            const saved = planningRuntime.save(
                ref.kind,
                ref.workItemId,
                {
                    serviceMinutes: minutes.value,
                    assignedDate: date.value,
                    lockedDay: locked.checked,
                },
                { expectedRevision },
            );
            form.dataset.expectedRevision = String(saved.revision);
            selectedPlanningKey = ref.key;
            loadSelectedPlanning();
            status.textContent =
                `Planning saved for ${ref.label}. Revision ${saved.revision}.`;
        } catch (error) {
            const stale = /changed since it was loaded/i.test(error?.message || "");
            if (stale) {
                loadSelectedPlanning();
                status.textContent =
                    "This work item changed elsewhere. Current saved planning was reloaded; review it before saving again.";
                return;
            }
            status.textContent =
                error?.message || "This work item's planning could not be saved.";
        }
    }

    function installPlanningRenderHook() {
        if (planningRenderHookInstalled || typeof renderRouteList !== "function") {
            return;
        }
        planningRenderHookInstalled = true;
        const originalRenderRouteList = renderRouteList;
        renderRouteList = function planningAwareRenderRouteList(...args) {
            const result = originalRenderRouteList.apply(this, args);
            renderPlanningControls();
            return result;
        };
    }

    function initialize() {
        ensurePlanningPanel();
        installPlanningRenderHook();
        renderPlanningControls();
    }

    root.FMRWorkItemPlanningControls = Object.freeze({
        planningRefsForSnapshot,
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }
})(typeof globalThis !== "undefined" ? globalThis : this);
