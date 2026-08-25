(function attachFreeMapRouterGigHandoff(root, factory) {
    const drive =
        typeof module === "object" && module.exports
            ? require("./google-drive.js")
            : root?.FMRGoogleDrive;
    const gigHandoff = factory(drive);

    if (typeof module === "object" && module.exports) {
        module.exports = gigHandoff;
    }

    if (root) {
        root.FMRGigHandoff = gigHandoff;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildGigHandoffSupport(drive) {
    "use strict";

    const GIG_HANDOFF_VERSION = 1;
    const DRIVE_GIG_HANDOFF_NAME = "Free Map Router Gig Handoff.json";

    if (!drive) {
        throw new Error("Free Map Router Google Drive support failed to load.");
    }

    const { requireWorkbookRouteFolder } = drive;

    function text(value) {
        return (value ?? "").toString().trim();
    }

    function isoTimestamp(value, label) {
        const raw = text(value);
        const date = new Date(raw);
        if (!raw || Number.isNaN(date.getTime())) {
            throw new Error(`${label} must be a valid timestamp.`);
        }
        return date.toISOString();
    }

    function calendarDate(value, label) {
        if (value === null || value === undefined || text(value) === "") {
            return null;
        }
        const raw = text(value);
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
        if (!match) throw new Error(`${label} must be a valid local calendar date.`);
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const check = new Date(Date.UTC(year, month - 1, day));
        if (
            check.getUTCFullYear() !== year ||
            check.getUTCMonth() !== month - 1 ||
            check.getUTCDate() !== day
        ) {
            throw new Error(`${label} must be a valid local calendar date.`);
        }
        return raw;
    }

    function expectedPay(value) {
        if (value === null || value === undefined || text(value) === "") {
            return null;
        }
        const amount = Number(value);
        if (!Number.isFinite(amount) || amount < 0) {
            throw new Error("Expected pay must be a nonnegative number.");
        }
        return Math.round((amount + Number.EPSILON) * 100) / 100;
    }

    function buildGigHandoff(gigs, stops, now = new Date()) {
        const handoffUpdatedAt = isoTimestamp(now, "Gig handoff updated time");
        const stopById = new Map();
        for (const stop of Array.isArray(stops) ? stops : []) {
            const stopId = text(stop?.id);
            if (!stopId || stopById.has(stopId)) continue;
            stopById.set(stopId, stop);
        }

        const seenGigIds = new Set();
        const rows = [];
        for (const gig of Array.isArray(gigs) ? gigs : []) {
            const gigId = text(gig?.id);
            if (!gigId) throw new Error("A manual gig is missing its Gig_ID.");
            if (seenGigIds.has(gigId)) {
                throw new Error(`Manual Gig_ID ${gigId} appears more than once.`);
            }
            seenGigIds.add(gigId);

            const stop = stopById.get(text(gig?.stopId));
            const address = text(stop?.address);
            if (!address) {
                throw new Error(`Manual gig ${gigId} is not attached to a saved address.`);
            }
            const source = text(gig?.source).toUpperCase();
            if (!source) throw new Error(`Manual gig ${gigId} is missing its source.`);

            rows.push({
                gigId,
                source,
                address,
                workOrderId: text(gig?.workOrderId),
                expectedPay: expectedPay(gig?.expectedPay),
                dueDate: calendarDate(gig?.dueDate, "Due date"),
                completedDate: calendarDate(gig?.completedDate, "Completed date"),
                notes: text(gig?.notes),
                updatedAt: isoTimestamp(gig?.updatedAt, `Manual gig ${gigId} updated time`),
            });
        }

        return {
            app: "free-map-router",
            gigHandoffVersion: GIG_HANDOFF_VERSION,
            updatedAt: handoffUpdatedAt,
            gigs: rows,
        };
    }

    function authorizationHeaders(token) {
        return { Authorization: `Bearer ${token}` };
    }

    function requireSuccessfulResponse(response, message) {
        if (!response.ok) throw new Error(message);
        return response;
    }

    async function findGigHandoffFile(
        token,
        folderId,
        fetchFn = globalThis.fetch,
    ) {
        const url = new URL("https://www.googleapis.com/drive/v3/files");
        url.searchParams.set(
            "q",
            `name = '${DRIVE_GIG_HANDOFF_NAME}' and '${folderId}' in parents and trashed = false`,
        );
        url.searchParams.set("spaces", "drive");
        url.searchParams.set("fields", "files(id,name,modifiedTime,parents)");
        url.searchParams.set("pageSize", "2");

        const response = await fetchFn(url.toString(), {
            headers: authorizationHeaders(token),
        });
        requireSuccessfulResponse(
            response,
            "Google Drive could not find the gig handoff file.",
        );
        const data = await response.json();
        const files = Array.isArray(data?.files) ? data.files : [];
        if (files.length > 1) {
            throw new Error(
                "More than one Free Map Router gig handoff file was found. Remove the duplicate before syncing gigs.",
            );
        }
        return files[0] || null;
    }

    async function createGigHandoffFile(
        token,
        folderId,
        contents,
        fetchFn = globalThis.fetch,
    ) {
        const boundary = `fmr_gig_handoff_${Date.now().toString(16)}`;
        const metadata = {
            name: DRIVE_GIG_HANDOFF_NAME,
            mimeType: "application/json",
            parents: [folderId],
            appProperties: {
                app: "free-map-router",
                role: "gig-handoff",
            },
        };
        const body = [
            `--${boundary}`,
            "Content-Type: application/json; charset=UTF-8",
            "",
            JSON.stringify(metadata),
            `--${boundary}`,
            "Content-Type: application/json; charset=UTF-8",
            "",
            contents,
            `--${boundary}--`,
            "",
        ].join("\r\n");

        const response = await fetchFn(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime",
            {
                method: "POST",
                headers: {
                    ...authorizationHeaders(token),
                    "Content-Type": `multipart/related; boundary=${boundary}`,
                },
                body,
            },
        );
        requireSuccessfulResponse(
            response,
            "Google Drive could not create the gig handoff file.",
        );
        return response.json();
    }

    async function updateGigHandoffFile(
        token,
        fileId,
        contents,
        fetchFn = globalThis.fetch,
    ) {
        const response = await fetchFn(
            `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media&fields=id,name,modifiedTime`,
            {
                method: "PATCH",
                headers: {
                    ...authorizationHeaders(token),
                    "Content-Type": "application/json; charset=UTF-8",
                },
                body: contents,
            },
        );
        requireSuccessfulResponse(
            response,
            "Google Drive could not update the gig handoff file.",
        );
        return response.json();
    }

    async function saveGigHandoffToDrive(
        token,
        handoff,
        fetchFn = globalThis.fetch,
    ) {
        const folder = await requireWorkbookRouteFolder(token, fetchFn);
        const existing = await findGigHandoffFile(token, folder.id, fetchFn);
        const contents = JSON.stringify(handoff, null, 2);
        return existing
            ? updateGigHandoffFile(token, existing.id, contents, fetchFn)
            : createGigHandoffFile(token, folder.id, contents, fetchFn);
    }

    return Object.freeze({
        DRIVE_GIG_HANDOFF_NAME,
        GIG_HANDOFF_VERSION,
        buildGigHandoff,
        findGigHandoffFile,
        saveGigHandoffToDrive,
    });
});
