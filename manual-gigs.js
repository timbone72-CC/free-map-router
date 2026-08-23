(function attachFreeMapRouterManualGigs(root) {
    "use strict";

    const gigContract = root?.FMRGigContract;
    const routeHistoryContract = root?.FMRRouteHistory;
    const stopContract = root?.FMRContract;
    const backupContract = root?.FMRBackup;
    const manualWorkContract = root?.FMRManualWorkLibrary;
    const manualWorkDrive = root?.FMRManualWorkDrive;
    const googleDrive = root?.FMRGoogleDrive;

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
    if (!manualWorkContract) {
        throw new Error("Free Map Router Manual Work Library failed to load.");
    }
    if (!manualWorkDrive || !googleDrive) {
        throw new Error("Free Map Router Manual Work Drive support failed to load.");
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
    const {
        DEFAULT_ALERT_LEAD_DAYS,
        advanceTemplateDue,
        dueCounts,
        dueState,
        emptyLibrary,
        findPropertyForStop,
        mergeManualWorkLibraries,
        parseManualWorkRecord,
        propertyMatchesStop,
        readManualWork,
        restoreLibraryPropertiesToStops,
        setPropertyArchived,
        templateForProperty,
        upsertPropertyFromStop,
        upsertRepeatTemplate,
        writeManualWork,
    } = manualWorkContract;
    const { loadManualWorkFromDrive, saveManualWorkToDrive } = manualWorkDrive;
    const { requestDriveToken } = googleDrive;

    let manualGigs = [];
    let manualWorkLibrary = emptyLibrary(new Date(0));
    let editingGigId = null;
    let editingSchedulePropertyId = null;
    let beforeAddressSubmitJobs = null;
    let pendingStartWasAvailable = false;
    let manualWorkSyncPromise = null;

    function currentStopIds() {
        return new Set(jobs.map((job) => job.id));
    }

    function persistManualGigs(nextGigs) {
        manualGigs = writeGigs(localStorage, nextGigs, currentStopIds());
        return manualGigs;
    }

    function persistManualWork(nextLibrary) {
        manualWorkLibrary = writeManualWork(localStorage, nextLibrary);
        return manualWorkLibrary;
    }

    function setManualWorkStatus(message) {
        const status = document.getElementById("manualWorkStatus");
        if (status) status.textContent = String(message || "");
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

    function captureGigProperties({ touch = false } = {}) {
        let next = manualWorkLibrary;
        for (const gig of manualGigs) {
            const stop = stopForGig(gig);
            if (!stop) continue;
            next = upsertPropertyFromStop(next, stop, { touch });
        }
        return persistManualWork(next);
    }

    function captureEditedProperties(beforeJobs) {
        let next = manualWorkLibrary;
        for (const property of manualWorkLibrary.properties) {
            const beforeStop = beforeJobs.find((job) =>
                propertyMatchesStop(property, job),
            );
            if (!beforeStop) continue;
            const currentStop =
                jobs.find((job) => job.id === beforeStop.id) ||
                jobs.find((job) =>
                    (job.addressAliases || []).some(
                        (alias) => addressKey(alias) === beforeStop.addressKey,
                    ),
                );
            if (!currentStop) continue;
            next = upsertPropertyFromStop(next, currentStop, { touch: false });
        }
        manualWorkLibrary = next;
        return captureGigProperties({ touch: false });
    }

    async function syncManualWorkLibrary(successMessage) {
        if (manualWorkSyncPromise) return manualWorkSyncPromise;

        manualWorkSyncPromise = (async () => {
            const token = await requestDriveToken();
            const remoteRaw = await loadManualWorkFromDrive(token);
            const remote = remoteRaw
                ? parseManualWorkRecord(remoteRaw)
                : emptyLibrary(new Date(0));
            const merged = mergeManualWorkLibraries(remote, manualWorkLibrary);
            const restored = restoreLibraryPropertiesToStops(merged, jobs);
            if (restored.restoredCount > 0) {
                writeJobs(restored.stops);
            }
            persistManualWork(merged);
            await saveManualWorkToDrive(token, manualWorkLibrary);
            renderManualWorkList();
            renderHomeDueSummary();
            renderJobsList();
            if (successMessage) {
                setManualWorkStatus(
                    `${successMessage}${restored.restoredCount > 0 ? ` Restored ${restored.restoredCount} saved address${restored.restoredCount === 1 ? "" : "es"} from the library.` : ""}`,
                );
            }
            return {
                saved: true,
                restoredCount: restored.restoredCount,
            };
        })();

        try {
            return await manualWorkSyncPromise;
        } catch (error) {
            setManualWorkStatus(
                error?.message ||
                    "The manual property is saved on this device, but Google Drive could not save it permanently.",
            );
            return { saved: false, restoredCount: 0 };
        } finally {
            manualWorkSyncPromise = null;
        }
    }

    async function savePropertyPermanently(stop) {
        persistManualWork(
            upsertPropertyFromStop(manualWorkLibrary, stop, { touch: true }),
        );
        renderManualWorkList();
        renderHomeDueSummary();
        setManualWorkStatus("Saving this manual property permanently in Google Drive…");
        const result = await syncManualWorkLibrary(
            "Manual property saved permanently in Google Drive.",
        );
        if (!result.saved) {
            setManualWorkStatus(
                "Gig saved on this device. Its property is not yet saved permanently in Google Drive; tap Sync Library to retry.",
            );
        }
        return result;
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

    function recurrenceLabel(template) {
        const unit =
            template.recurrenceCount === 1
                ? template.recurrenceUnit.replace(/s$/, "")
                : template.recurrenceUnit;
        return `Every ${template.recurrenceCount} ${unit}`;
    }

    function scheduleSummary(template) {
        const state = dueState(template, new Date());
        const parts = [template.source];
        const pay = moneyLabel(template.expectedPay);
        if (pay) parts.push(pay);
        parts.push(recurrenceLabel(template));
        if (state) parts.push(state.label);
        parts.push(`Next ${template.nextDueDate}`);
        return parts.filter(Boolean).join(" • ");
    }

    function ensureHomeDueSummary() {
        let summary = document.getElementById("manualDueSummary");
        if (summary) return summary;
        const homeForm = document.getElementById("homeForm");
        if (!homeForm?.parentElement) return null;
        summary = document.createElement("div");
        summary.id = "manualDueSummary";
        summary.className = "subSection manualDueSummary";
        homeForm.insertAdjacentElement("afterend", summary);
        return summary;
    }

    function openDueWork() {
        const pageMenu = document.getElementById("pageMenu");
        const workLibrary = document.getElementById("addressViewWorkLibrary");
        if (pageMenu) {
            pageMenu.value = "addresses";
            pageMenu.dispatchEvent(new Event("change", { bubbles: true }));
        }
        if (workLibrary) workLibrary.checked = true;
        document.getElementById("manualWorkList")?.scrollIntoView({
            block: "start",
        });
    }

    function renderHomeDueSummary() {
        const summary = ensureHomeDueSummary();
        if (!summary) return;
        summary.innerHTML = "";
        const counts = dueCounts(manualWorkLibrary, new Date());
        const dueNow = counts.overdue + counts.dueToday + counts.dueSoon;
        const message = document.createElement("span");
        if (manualWorkLibrary.templates.length === 0) {
            message.textContent = "No manual repeat schedules yet.";
        } else if (dueNow === 0) {
            message.textContent = `No manual repeat work due in the next ${DEFAULT_ALERT_LEAD_DAYS} days.`;
        } else {
            const parts = [];
            if (counts.overdue) parts.push(`${counts.overdue} overdue`);
            if (counts.dueToday) parts.push(`${counts.dueToday} due today`);
            if (counts.dueSoon) parts.push(`${counts.dueSoon} due soon`);
            message.textContent = `Manual work: ${parts.join(" • ")}`;
        }
        summary.appendChild(message);

        if (dueNow > 0) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "btn btnSmall";
            button.textContent = "View Due Work";
            button.addEventListener("click", openDueWork);
            summary.appendChild(document.createTextNode(" "));
            summary.appendChild(button);
        }
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
        if (!confirm(`Delete this ${gig.source} manual gig? The saved address and Manual Work Library property will be kept.`)) {
            return;
        }

        if (gig.routeIncluded) {
            changeGigRouteMembership(gig, false);
        }
        persistManualGigs(deleteGig(manualGigs, gig.id, currentStopIds()));
        if (editingGigId === gig.id) resetGigForm();
        renderManualGigsList();
        renderManualWorkList();
        renderHomeDueSummary();
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

    function attachedGigCount(stopId) {
        return gigsForStop(manualGigs, stopId).length;
    }

    function startScheduleEdit(propertyId) {
        const property = manualWorkLibrary.properties.find(
            (item) => item.propertyId === propertyId,
        );
        if (!property || property.archived) return;
        editingSchedulePropertyId = propertyId;
        renderManualWorkList();
        document.querySelector("#manualWorkList .manualScheduleEditor input")?.focus();
    }

    function cancelScheduleEdit() {
        editingSchedulePropertyId = null;
        renderManualWorkList();
    }

    function createScheduleEditor(property) {
        const template = templateForProperty(manualWorkLibrary, property.propertyId);
        const li = document.createElement("li");
        li.className = "manualScheduleEditor";
        const form = document.createElement("form");
        form.innerHTML = `
            <strong>${template ? "Edit" : "Add"} Repeat Schedule — <span class="schedulePropertyAddress"></span></strong>
            <div class="row2">
                <label>Company / source *
                    <select name="source" required>
                        <option value="HNP">HNP</option>
                        <option value="OTHER">Other</option>
                    </select>
                </label>
                <label>Expected pay (optional)
                    <input name="expectedPay" type="number" min="0" step="0.01" inputmode="decimal" />
                </label>
            </div>
            <div class="row2">
                <label>Repeat every *
                    <input name="recurrenceCount" type="number" min="1" max="365" step="1" required />
                </label>
                <label>Cadence *
                    <select name="recurrenceUnit" required>
                        <option value="days">Days</option>
                        <option value="weeks">Weeks</option>
                        <option value="months">Months</option>
                    </select>
                </label>
            </div>
            <label>Next due date *
                <input name="nextDueDate" type="date" required />
            </label>
            <label>Default notes (optional)
                <textarea name="notes"></textarea>
            </label>
            <p class="tiny muted">Due Soon starts ${DEFAULT_ALERT_LEAD_DAYS} days before the scheduled date. Due work is never added to a route automatically.</p>
            <div class="btnRow">
                <button type="submit" class="btn btnSmall">Save Repeat Schedule</button>
                <button type="button" class="btn btnSmall" data-action="cancel-schedule">Cancel</button>
            </div>`;
        form.querySelector(".schedulePropertyAddress").textContent = property.address;
        form.elements.source.value = template?.source === "HNP" ? "HNP" : "OTHER";
        form.elements.expectedPay.value = Number.isFinite(template?.expectedPay)
            ? String(template.expectedPay)
            : "";
        form.elements.recurrenceCount.value = String(template?.recurrenceCount || 30);
        form.elements.recurrenceUnit.value = template?.recurrenceUnit || "days";
        form.elements.nextDueDate.value = template?.nextDueDate || "";
        form.elements.notes.value = template?.notes || "";
        form.addEventListener("submit", (event) => {
            void submitRepeatSchedule(event, property.propertyId);
        });
        form.querySelector('[data-action="cancel-schedule"]')?.addEventListener(
            "click",
            cancelScheduleEdit,
        );
        li.appendChild(form);
        return li;
    }

    async function submitRepeatSchedule(event, propertyId) {
        event.preventDefault();
        const form = event.currentTarget;
        try {
            persistManualWork(
                upsertRepeatTemplate(
                    manualWorkLibrary,
                    propertyId,
                    {
                        source: form.elements.source.value,
                        expectedPay: form.elements.expectedPay.value,
                        recurrenceCount: form.elements.recurrenceCount.value,
                        recurrenceUnit: form.elements.recurrenceUnit.value,
                        nextDueDate: form.elements.nextDueDate.value,
                        notes: form.elements.notes.value,
                    },
                    { now: new Date() },
                ),
            );
            editingSchedulePropertyId = null;
            renderManualWorkList();
            renderHomeDueSummary();
            setManualWorkStatus(
                "Repeat schedule saved on this device. Saving it permanently in Google Drive…",
            );
            const result = await syncManualWorkLibrary(
                "Repeat schedule saved permanently in Google Drive.",
            );
            if (!result.saved) {
                setManualWorkStatus(
                    "Repeat schedule is saved on this device, but Google Drive did not save it permanently. Tap Sync Library to retry.",
                );
            }
        } catch (error) {
            alert(error?.message || "The repeat schedule could not be saved.");
        }
    }

    async function addScheduledWorkToRoute(templateId) {
        const template = manualWorkLibrary.templates.find(
            (item) => item.templateId === templateId,
        );
        const property = manualWorkLibrary.properties.find(
            (item) => item.propertyId === template?.propertyId,
        );
        const state = template ? dueState(template, new Date()) : null;
        if (!template || !property || property.archived || !state) return;
        if (state.code === "upcoming") return;

        try {
            const restored = restoreLibraryPropertiesToStops(manualWorkLibrary, jobs);
            if (restored.restoredCount > 0) writeJobs(restored.stops);
            const stop = jobs.find((job) => propertyMatchesStop(property, job));
            if (!stop) {
                throw new Error("The scheduled property could not be restored as a saved address.");
            }

            const gig = createGig(
                {
                    stopId: stop.id,
                    source: template.source,
                    workOrderId: "",
                    expectedPay: template.expectedPay,
                    notes: template.notes,
                    routeIncluded: true,
                },
                { validStopIds: currentStopIds() },
            );
            persistManualGigs([...manualGigs, gig]);
            changeGigRouteMembership(gig, true);
            persistManualWork(
                advanceTemplateDue(manualWorkLibrary, template.templateId, new Date()),
            );

            const advanced = manualWorkLibrary.templates.find(
                (item) => item.templateId === template.templateId,
            );
            renderManualGigsList();
            renderManualWorkList();
            renderHomeDueSummary();
            renderJobsList();
            renderRouteList();
            setManualWorkStatus(
                `${template.source} scheduled work added to both saved routes as a new manual gig. Next due ${advanced?.nextDueDate || "date saved"}. Saving the advanced schedule to Google Drive…`,
            );
            const result = await syncManualWorkLibrary(
                `Scheduled work added to the route. Next due ${advanced?.nextDueDate || "date saved"}.`,
            );
            if (!result.saved) {
                setManualWorkStatus(
                    `Scheduled work was added to the route and the next due date is saved on this device, but Google Drive did not save the advanced schedule. Tap Sync Library to retry.`,
                );
            }
        } catch (error) {
            alert(error?.message || "The scheduled work could not be added to the route.");
        }
    }

    async function setArchived(propertyId, archived) {
        const property = manualWorkLibrary.properties.find(
            (item) => item.propertyId === propertyId,
        );
        if (!property) return;

        const stop = jobs.find((job) => propertyMatchesStop(property, job));
        if (archived && stop && attachedGigCount(stop.id) > 0) {
            alert(
                "This property still has a manual gig. Delete the gig occurrence first; the property itself will still be kept in the Manual Work Library.",
            );
            return;
        }

        if (
            archived &&
            !confirm(
                `Archive ${property.address}? It will stay recoverable in Google Drive and will not be permanently deleted.`,
            )
        ) {
            return;
        }

        persistManualWork(
            setPropertyArchived(
                manualWorkLibrary,
                propertyId,
                archived,
                new Date(),
            ),
        );

        if (editingSchedulePropertyId === propertyId) {
            editingSchedulePropertyId = null;
        }

        if (!archived) {
            const restored = restoreLibraryPropertiesToStops(manualWorkLibrary, jobs);
            if (restored.restoredCount > 0) writeJobs(restored.stops);
        }

        renderManualWorkList();
        renderHomeDueSummary();
        renderJobsList();
        setManualWorkStatus(
            archived
                ? "Property archived locally. Saving archive state to Google Drive…"
                : "Property restored locally. Saving restore state to Google Drive…",
        );
        await syncManualWorkLibrary(
            archived
                ? "Property archived and kept in the permanent Manual Work Library."
                : "Property restored from the permanent Manual Work Library.",
        );
    }

    function renderManualWorkList() {
        const list = document.getElementById("manualWorkList");
        if (!list) return;
        list.innerHTML = "";

        if (manualWorkLibrary.properties.length === 0) {
            const li = document.createElement("li");
            li.textContent = "No permanent manual properties yet.";
            list.appendChild(li);
            return;
        }

        if (editingSchedulePropertyId) {
            const editingProperty = manualWorkLibrary.properties.find(
                (property) => property.propertyId === editingSchedulePropertyId,
            );
            if (editingProperty && !editingProperty.archived) {
                list.appendChild(createScheduleEditor(editingProperty));
            }
        }

        for (const property of manualWorkLibrary.properties) {
            const li = document.createElement("li");
            li.dataset.propertyId = property.propertyId;
            li.dataset.archived = property.archived ? "true" : "false";

            const label = document.createElement("span");
            label.textContent = property.archived
                ? `Archived — ${property.address}`
                : property.address;

            const action = document.createElement("button");
            action.type = "button";
            action.style.width = "auto";
            action.textContent = property.archived ? "Restore" : "Archive";
            action.addEventListener("click", () => {
                void setArchived(property.propertyId, !property.archived);
            });

            li.appendChild(label);
            li.appendChild(document.createTextNode(" "));
            li.appendChild(action);

            if (!property.archived) {
                const template = templateForProperty(
                    manualWorkLibrary,
                    property.propertyId,
                );
                const schedule = document.createElement("button");
                schedule.type = "button";
                schedule.style.width = "auto";
                schedule.textContent = template ? "Edit Schedule" : "Add Schedule";
                schedule.addEventListener("click", () =>
                    startScheduleEdit(property.propertyId),
                );
                li.appendChild(document.createTextNode(" "));
                li.appendChild(schedule);

                if (template) {
                    const detail = document.createElement("div");
                    detail.className = "manualScheduleDetail tiny";
                    detail.textContent = scheduleSummary(template);
                    li.appendChild(detail);
                    const state = dueState(template, new Date());
                    if (state && state.code !== "upcoming") {
                        const add = document.createElement("button");
                        add.type = "button";
                        add.className = "btn btnSmall manualScheduleAdd";
                        add.textContent = "Add to Route";
                        add.addEventListener("click", () => {
                            void addScheduledWorkToRoute(template.templateId);
                        });
                        li.appendChild(add);
                    }
                }
            }

            list.appendChild(li);
        }
    }

    async function submitManualGig(event) {
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
            await savePropertyPermanently(stopForGig(nextGig) || stop);
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
        const previousJobs = beforeAddressSubmitJobs;
        const replacements = deriveStopRemap(previousJobs);
        if (Object.keys(replacements).length > 0) {
            persistManualGigs(
                remapGigStopIds(manualGigs, replacements, currentStopIds()),
            );
        }

        const beforeLibrary = JSON.stringify(manualWorkLibrary);
        captureEditedProperties(previousJobs);
        beforeAddressSubmitJobs = null;
        renderManualGigsList();
        renderManualWorkList();
        renderHomeDueSummary();

        if (JSON.stringify(manualWorkLibrary) !== beforeLibrary) {
            setManualWorkStatus(
                "Manual property changed. Saving the updated property permanently…",
            );
            void syncManualWorkLibrary(
                "Updated manual property saved permanently in Google Drive.",
            );
        }
    }

    function activePropertyForStop(stop) {
        const property = findPropertyForStop(manualWorkLibrary, stop);
        return property && !property.archived ? property : null;
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
        if (count > 0) {
            event.preventDefault();
            event.stopImmediatePropagation();
            alert(
                `This address has ${count} manual gig${count === 1 ? "" : "s"}. Delete the manual gig${count === 1 ? "" : "s"} first.`,
            );
            return;
        }

        const property = activePropertyForStop(job);
        if (!property) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        alert(
            "This address is protected by the permanent Manual Work Library. Archive the property first if you really want to remove the saved address. Archiving keeps the Drive copy recoverable.",
        );
    }

    function guardSelectionDelete(event) {
        const button = event.target?.closest?.("button");
        if (!button) return;
        const buttonText = button.textContent.trim();

        if (buttonText === "Delete All Addresses") {
            const activeProperties = manualWorkLibrary.properties.filter(
                (property) => !property.archived,
            );
            if (manualGigs.length > 0 || activeProperties.length > 0) {
                event.preventDefault();
                event.stopImmediatePropagation();
                alert(
                    "Manual work is protected. Delete gig occurrences and archive active Manual Work Library properties before using Delete All Addresses.",
                );
            }
            return;
        }

        if (buttonText !== "Delete") return;
        const gigBlocked = routeIds.filter((stopId) => attachedGigCount(stopId) > 0);
        const propertyBlocked = routeIds.filter((stopId) => {
            const stop = jobs.find((job) => job.id === stopId);
            return Boolean(activePropertyForStop(stop));
        });
        if (gigBlocked.length === 0 && propertyBlocked.length === 0) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        alert(
            "One or more selected addresses are protected by manual gigs or the permanent Manual Work Library. Delete gig occurrences and archive the property before deleting the saved address.",
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
                captureGigProperties({ touch: false });
                renderManualGigsList();
                renderManualWorkList();
                renderHomeDueSummary();
                const status = document.getElementById("gigStatus");
                if (status) {
                    status.textContent =
                        `Restored ${manualGigs.length} manual gig${manualGigs.length === 1 ? "" : "s"} with the backup.`;
                }
                setManualWorkStatus(
                    "Manual properties and repeat schedules remain in their separate permanent library. Tap Sync Library if this browser needs the latest Drive copy.",
                );
            }
            return result;
        };
    }

    function initialize() {
        manualGigs = readGigs(localStorage, currentStopIds());
        persistManualGigs(manualGigs);
        manualWorkLibrary = readManualWork(localStorage);
        captureGigProperties({ touch: false });
        installBackupRestoreHook();

        document
            .getElementById("gigForm")
            ?.addEventListener("submit", submitManualGig);
        document.getElementById("cancelGigEdit")?.addEventListener("click", () => {
            resetGigForm();
        });
        document.getElementById("syncManualWork")?.addEventListener("click", () => {
            setManualWorkStatus("Syncing the permanent Manual Work Library…");
            void syncManualWorkLibrary("Manual Work Library is synced with Google Drive.");
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
        renderManualWorkList();
        renderHomeDueSummary();
        if (manualWorkLibrary.properties.length > 0) {
            setManualWorkStatus(
                `${manualWorkLibrary.properties.filter((property) => !property.archived).length} active manual propert${manualWorkLibrary.properties.filter((property) => !property.archived).length === 1 ? "y" : "ies"} saved on this device. Sync Library verifies the permanent Drive copy.`,
            );
        }
    }

    root.FMRManualGigs = Object.freeze({
        list() {
            return manualGigs.map((gig) => ({ ...gig }));
        },
        listProperties() {
            return manualWorkLibrary.properties.map((property) => ({
                ...property,
                addressAliases: (property.addressAliases || []).slice(),
            }));
        },
        listSchedules() {
            return manualWorkLibrary.templates.map((template) => ({ ...template }));
        },
        render: renderManualGigsList,
        syncManualWork() {
            return syncManualWorkLibrary(
                "Manual Work Library is synced with Google Drive.",
            );
        },
    });

    document.addEventListener("DOMContentLoaded", initialize, { once: true });
})(typeof globalThis !== "undefined" ? globalThis : this);