(function attachFreeMapRouterManualGigs(root) {
    "use strict";

    const gigContract = root?.FMRGigContract;
    const routeHistoryContract = root?.FMRRouteHistory;
    const stopContract = root?.FMRContract;
    const backupContract = root?.FMRBackup;

    if (!gigContract) {
        throw new Error("Free Map Router gig contract failed to load.");
    }
    if (!routeHistoryContract) {
        throw new Error("Free Map Router route history failed to load.");
    }
    if (!stopContract) {
        throw new Error("Free Map Router stop contract failed to load.");
    }
    if (!backupContract) {
        throw new Error("Free Map Router backup contract failed to load.");
    }

    const {
        applyGigEdit,
        createGig,
        deleteGig,
        gigsForStop,
        readGigs,
        remapGigStopIds,
        writeGigs,
    } = gigContract;
    const { setGigRouteMembership, writeRouteHistory } = routeHistoryContract;
    const { addressKey, normalizeAddress, normalizeStop } = stopContract;

    let manualGigs = [];
    let editingGigId = null;
    let beforeAddressSubmitJobs = null;
    let pendingStartWasAvailable = false;

    function currentStopIds() {
        return new Set(jobs.map((job) => job.id));
    }

    function persistManualGigs(nextGigs) {
        manualGigs = writeGigs(localStorage, nextGigs, currentStopIds());
        return manualGigs;
    }

    function refreshActiveRouteFromHistory() {
        routeIds = routeHistory[activeRouteSlot]?.routeIds.slice() || [];
        renderJobsList();
        renderRouteList();
        renderRouteChoice();
        renderNewRouteAvailable();
    }

    function persistRouteHistory(nextHistory) {
        routeHistory = writeRouteHistory(
            localStorage,
            nextHistory,
            currentStopIds(),
        );
        refreshActiveRouteFromHistory();
        return routeHistory;
    }

    function changeGigRouteMembership(gig, included) {
        return persistRouteHistory(
            setGigRouteMembership(
                routeHistory,
                gig,
                included,
                currentStopIds(),
            ),
        );
    }

    function stopForGig(gig) {
        return jobs.find((job) => job.id === gig?.stopId) || null;
    }

    function findStopByAddress(address) {
        const key = addressKey(address);
        return jobs.find((job) => job.addressKey === key) || null;
    }

    function findOrCreateStop(address) {
        const normalizedAddress = normalizeAddress(address);
        if (!normalizedAddress) {
            throw new Error("Address is required.");
        }

        const existing = findStopByAddress(normalizedAddress);
        if (existing) return existing;

        const stop = normalizeStop({
            id: uid(),
            address: normalizedAddress,
            label: "",
            notes: "",
        });
        if (!stop) {
            throw new Error("The manual gig address could not be saved.");
        }

        writeJobs([...jobs, stop]);
        return jobs.find((job) => job.id === stop.id) || stop;
    }

    function moneyLabel(value) {
        return Number.isFinite(value) ? `$${value.toFixed(2)}` : "";
    }

    function gigSummary(gig) {
        const stop = stopForGig(gig);
        const parts = [gig.source];
        if (gig.workOrderId) parts.push(`WO ${gig.workOrderId}`);
        const pay = moneyLabel(gig.expectedPay);
        if (pay) parts.push(pay);
        if (stop?.address) parts.push(stop.address);
        if (gig.notes) parts.push(`Notes: ${gig.notes}`);
        if (!gig.routeIncluded) parts.push("Not included in route");
        return parts.filter(Boolean).join(" — ");
    }

    function resetGigForm() {
        editingGigId = null;
        const form = document.getElementById("gigForm");
        form?.reset();
        const source = document.getElementById("gigSource");
        const included = document.getElementById("gigRouteIncluded");
        const cancel = document.getElementById("cancelGigEdit");
        const status = document.getElementById("gigStatus");
        if (source) source.value = "HNP";
        if (included) included.checked = true;
        if (cancel) cancel.hidden = true;
        if (status) {
            status.textContent =
                "Manual gigs stay separate from InspectorADE prediction history.";
        }
    }

    function startGigEdit(gigId) {
        const gig = manualGigs.find((item) => item.id === gigId);
        const stop = stopForGig(gig);
        if (!gig || !stop) {
            alert("That manual gig is no longer attached to a saved address.");
            return;
        }

        editingGigId = gig.id;
        document.getElementById("gigAddress").value = stop.address;
        document.getElementById("gigSource").value =
            gig.source === "HNP" ? "HNP" : "OTHER";
        document.getElementById("gigWorkOrderId").value = gig.workOrderId || "";
        document.getElementById("gigExpectedPay").value =
            Number.isFinite(gig.expectedPay) ? String(gig.expectedPay) : "";
        document.getElementById("gigNotes").value = gig.notes || "";
        document.getElementById("gigRouteIncluded").checked = gig.routeIncluded;
        const cancel = document.getElementById("cancelGigEdit");
        const status = document.getElementById("gigStatus");
        if (cancel) cancel.hidden = false;
        if (status) status.textContent = `Editing ${gig.source} manual gig.`;
        document.getElementById("gigAddress")?.focus();
    }

    function deleteManualGig(gigId) {
        const gig = manualGigs.find((item) => item.id === gigId);
        if (!gig) return;
        if (!confirm(`Delete this ${gig.source} manual gig? The saved address will be kept.`)) {
            return;
        }

        if (gig.routeIncluded) {
            changeGigRouteMembership(gig, false);
        }
        persistManualGigs(deleteGig(manualGigs, gig.id, currentStopIds()));
        if (editingGigId === gig.id) resetGigForm();
        renderManualGigsList();
    }

    function renderManualGigsList() {
        const list = document.getElementById("gigList");
        if (!list) return;
        list.innerHTML = "";

        if (manualGigs.length === 0) {
            const li = document.createElement("li");
            li.textContent = "No manual gigs yet.";
            list.appendChild(li);
            return;
        }

        for (const gig of manualGigs) {
            const li = document.createElement("li");
            li.dataset.gigId = gig.id;

            const label = document.createElement("span");
            label.textContent = gigSummary(gig);

            const edit = document.createElement("button");
            edit.type = "button";
            edit.textContent = "Edit";
            edit.style.width = "auto";
            edit.addEventListener("click", () => startGigEdit(gig.id));

            const remove = document.createElement("button");
            remove.type = "button";
            remove.textContent = "Delete Gig";
            remove.style.width = "auto";
            remove.addEventListener("click", () => deleteManualGig(gig.id));

            li.appendChild(label);
            li.appendChild(document.createTextNode(" "));
            li.appendChild(edit);
            li.appendChild(document.createTextNode(" "));
            li.appendChild(remove);
            list.appendChild(li);
        }
    }

    function submitManualGig(event) {
        event.preventDefault();

        const address = normalizeAddress(
            document.getElementById("gigAddress")?.value,
        );
        const source = document.getElementById("gigSource")?.value || "OTHER";
        const workOrderId =
            document.getElementById("gigWorkOrderId")?.value || "";
        const expectedPay =
            document.getElementById("gigExpectedPay")?.value || "";
        const notes = document.getElementById("gigNotes")?.value || "";
        const routeIncluded = Boolean(
            document.getElementById("gigRouteIncluded")?.checked,
        );

        if (!address) {
            alert("Address is required.");
            return;
        }

        try {
            const stop = findOrCreateStop(address);
            const previous = editingGigId
                ? manualGigs.find((gig) => gig.id === editingGigId) || null
                : null;

            let nextGig;
            if (previous) {
                const nextGigs = applyGigEdit(
                    manualGigs,
                    previous.id,
                    {
                        stopId: stop.id,
                        source,
                        workOrderId,
                        expectedPay,
                        notes,
                        routeIncluded,
                    },
                    { validStopIds: currentStopIds() },
                );
                nextGig = nextGigs.find((gig) => gig.id === previous.id);

                if (
                    previous.routeIncluded &&
                    (previous.stopId !== nextGig.stopId || !nextGig.routeIncluded)
                ) {
                    changeGigRouteMembership(previous, false);
                }
                persistManualGigs(nextGigs);
                if (
                    nextGig.routeIncluded &&
                    (!previous.routeIncluded || previous.stopId !== nextGig.stopId)
                ) {
                    changeGigRouteMembership(nextGig, true);
                }
            } else {
                nextGig = createGig(
                    {
                        stopId: stop.id,
                        source,
                        workOrderId,
                        expectedPay,
                        notes,
                        routeIncluded,
                    },
                    { validStopIds: currentStopIds() },
                );
                persistManualGigs([...manualGigs, nextGig]);
                if (nextGig.routeIncluded) {
                    changeGigRouteMembership(nextGig, true);
                }
            }

            resetGigForm();
            renderManualGigsList();
            renderJobsList();
            renderRouteList();
        } catch (error) {
            alert(error?.message || "The manual gig could not be saved.");
        }
    }

    function deriveStopRemap(beforeJobs) {
        const currentById = new Set(jobs.map((job) => job.id));
        const current = jobs.slice();
        const replacements = {};

        for (const gig of manualGigs) {
            if (currentById.has(gig.stopId)) continue;
            const oldStop = beforeJobs.find((job) => job.id === gig.stopId);
            if (!oldStop) continue;
            const oldKey = addressKey(oldStop.address);

            const matches = current.filter((job) => {
                if (job.addressKey === oldKey) return true;
                return (job.addressAliases || []).some(
                    (alias) => addressKey(alias) === oldKey,
                );
            });
            if (matches.length === 1) {
                replacements[gig.stopId] = matches[0].id;
            }
        }

        return replacements;
    }

    function remapGigsAfterAddressSubmit() {
        if (!Array.isArray(beforeAddressSubmitJobs)) return;
        const replacements = deriveStopRemap(beforeAddressSubmitJobs);
        if (Object.keys(replacements).length > 0) {
            persistManualGigs(
                remapGigStopIds(manualGigs, replacements, currentStopIds()),
            );
        }
        beforeAddressSubmitJobs = null;
        renderManualGigsList();
    }

    function attachedGigCount(stopId) {
        return gigsForStop(manualGigs, stopId).length;
    }

    function guardIndividualAddressDelete(event) {
        const button = event.target?.closest?.("button");
        if (!button || button.textContent.trim() !== "Delete") return;
        const li = button.closest("li");
        const list = document.getElementById("jobList");
        if (!li || !list) return;
        const index = Array.from(list.children).indexOf(li);
        if (index < 0) return;
        const job = getFilteredJobs()[index];
        const count = attachedGigCount(job?.id);
        if (count === 0) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        alert(
            `This address has ${count} manual gig${count === 1 ? "" : "s"}. Delete the manual gig${count === 1 ? "" : "s"} first.`,
        );
    }

    function guardSelectionDelete(event) {
        const button = event.target?.closest?.("button");
        if (!button) return;
        const text = button.textContent.trim();

        if (text === "Delete All Addresses" && manualGigs.length > 0) {
            event.preventDefault();
            event.stopImmediatePropagation();
            alert(
                `There ${manualGigs.length === 1 ? "is" : "are"} ${manualGigs.length} saved manual gig${manualGigs.length === 1 ? "" : "s"}. Delete the manual gigs before deleting all addresses.`,
            );
            return;
        }

        if (text !== "Delete") return;
        const blocked = routeIds.filter((stopId) => attachedGigCount(stopId) > 0);
        if (blocked.length === 0) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        alert(
            `${blocked.length} selected address${blocked.length === 1 ? " has" : "es have"} manual gigs. Delete those manual gigs first.`,
        );
    }

    function reapplyIncludedGigsAfterWorkbookStart() {
        if (!pendingStartWasAvailable) return;
        pendingStartWasAvailable = false;
        if (routeHistory.pending?.routeIds.length) return;

        let nextHistory = routeHistory;
        let includedCount = 0;
        for (const gig of manualGigs) {
            if (!gig.routeIncluded) continue;
            nextHistory = setGigRouteMembership(
                nextHistory,
                gig,
                true,
                currentStopIds(),
            );
            includedCount += 1;
        }
        if (includedCount > 0) persistRouteHistory(nextHistory);
    }

    function installBackupRestoreHook() {
        if (typeof restoreRoutes !== "function") return;
        const originalRestoreRoutes = restoreRoutes;
        restoreRoutes = function manualGigAwareRestoreRoutes(routes) {
            const result = originalRestoreRoutes(routes);
            const restoredGigs = backupContract.takeParsedGigsForRestore();
            if (Array.isArray(restoredGigs)) {
                persistManualGigs(restoredGigs);
                renderManualGigsList();
                const status = document.getElementById("gigStatus");
                if (status) {
                    status.textContent =
                        `Restored ${manualGigs.length} manual gig${manualGigs.length === 1 ? "" : "s"} with the backup.`;
                }
            }
            return result;
        };
    }

    function initialize() {
        manualGigs = readGigs(localStorage, currentStopIds());
        persistManualGigs(manualGigs);
        installBackupRestoreHook();

        document
            .getElementById("gigForm")
            ?.addEventListener("submit", submitManualGig);
        document.getElementById("cancelGigEdit")?.addEventListener("click", () => {
            resetGigForm();
        });

        const jobForm = document.getElementById("jobForm");
        jobForm?.addEventListener(
            "submit",
            () => {
                beforeAddressSubmitJobs = jobs.map((job) => ({
                    ...job,
                    addressAliases: (job.addressAliases || []).slice(),
                }));
            },
            true,
        );
        jobForm?.addEventListener("submit", remapGigsAfterAddressSubmit);

        document
            .getElementById("jobList")
            ?.addEventListener("click", guardIndividualAddressDelete, true);
        document
            .getElementById("fmrSelectionControls")
            ?.addEventListener("click", guardSelectionDelete, true);

        const startNewRoute = document.getElementById("startNewRoute");
        startNewRoute?.addEventListener(
            "click",
            () => {
                pendingStartWasAvailable = Boolean(
                    routeHistory.pending?.routeIds.length,
                );
            },
            true,
        );
        startNewRoute?.addEventListener(
            "click",
            reapplyIncludedGigsAfterWorkbookStart,
        );

        resetGigForm();
        renderManualGigsList();
    }

    root.FMRManualGigs = Object.freeze({
        list() {
            return manualGigs.map((gig) => ({ ...gig }));
        },
        render: renderManualGigsList,
    });

    document.addEventListener("DOMContentLoaded", initialize, { once: true });
})(typeof globalThis !== "undefined" ? globalThis : this);