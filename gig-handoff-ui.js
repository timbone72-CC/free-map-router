(function attachGigHandoffUi(root) {
    "use strict";

    const handoffSupport = root?.FMRGigHandoff;
    const manualGigs = root?.FMRManualGigs;
    const googleDrive = root?.FMRGoogleDrive;

    if (!handoffSupport || !manualGigs || !googleDrive) {
        throw new Error("Free Map Router gig handoff UI failed to load.");
    }

    const { buildGigHandoff, saveGigHandoffToDrive } = handoffSupport;
    const { requestDriveToken } = googleDrive;

    function setStatus(message) {
        const status = document.getElementById("gigHandoffStatus");
        if (status) status.textContent = String(message || "");
    }

    async function syncGigsToWorkbook() {
        const button = document.getElementById("syncGigsToWorkbook");
        if (button) button.disabled = true;
        setStatus("Preparing the manual gig handoff for the workbook…");

        try {
            const handoff = buildGigHandoff(manualGigs.list(), jobs, new Date());
            const token = await requestDriveToken();
            await saveGigHandoffToDrive(token, handoff);
            const count = handoff.gigs.length;
            setStatus(
                `Synced ${count} manual gig${count === 1 ? "" : "s"} to the workbook handoff in Google Drive. The workbook can now receive them into Gig_Log.`,
            );
            return handoff;
        } catch (error) {
            setStatus(
                error?.message ||
                    "The gig handoff was not saved. Local gigs were not changed.",
            );
            return null;
        } finally {
            if (button) button.disabled = false;
        }
    }

    function initialize() {
        document
            .getElementById("syncGigsToWorkbook")
            ?.addEventListener("click", () => void syncGigsToWorkbook());
    }

    root.FMRGigHandoffUi = Object.freeze({ syncGigsToWorkbook });
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
})(typeof globalThis !== "undefined" ? globalThis : this);
