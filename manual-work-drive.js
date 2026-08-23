(function attachManualWorkDrive(root, factory) {
    const drive =
        typeof module === "object" && module.exports
            ? require("./google-drive.js")
            : root?.FMRGoogleDrive;
    const manualWorkDrive = factory(drive);

    if (typeof module === "object" && module.exports) {
        module.exports = manualWorkDrive;
    }

    if (root) {
        root.FMRManualWorkDrive = manualWorkDrive;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildManualWorkDrive(drive) {
    "use strict";

    const DRIVE_MANUAL_WORK_NAME = "Free Map Router Manual Work.json";

    if (!drive) {
        throw new Error("Free Map Router Google Drive support failed to load.");
    }

    const { ensureBackupFolder, findBackupFolder } = drive;

    function authorizationHeaders(token) {
        return { Authorization: `Bearer ${token}` };
    }

    function requireSuccessfulResponse(response, message) {
        if (!response.ok) throw new Error(message);
        return response;
    }

    async function findManualWorkFile(
        token,
        folderId,
        fetchFn = globalThis.fetch,
    ) {
        const url = new URL("https://www.googleapis.com/drive/v3/files");
        url.searchParams.set(
            "q",
            `name = '${DRIVE_MANUAL_WORK_NAME}' and '${folderId}' in parents and trashed = false`,
        );
        url.searchParams.set("spaces", "drive");
        url.searchParams.set("fields", "files(id,name,modifiedTime,parents)");
        url.searchParams.set("orderBy", "modifiedTime desc");
        url.searchParams.set("pageSize", "2");

        const response = await fetchFn(url.toString(), {
            headers: authorizationHeaders(token),
        });
        requireSuccessfulResponse(
            response,
            "Google Drive could not find the Manual Work Library.",
        );
        const data = await response.json();
        const files = Array.isArray(data?.files) ? data.files : [];
        if (files.length > 1) {
            throw new Error("More than one Manual Work Library file was found.");
        }
        return files[0] || null;
    }

    async function createManualWorkFile(
        token,
        folderId,
        contents,
        fetchFn = globalThis.fetch,
    ) {
        const boundary = `fmr_manual_work_${Date.now().toString(16)}`;
        const metadata = {
            name: DRIVE_MANUAL_WORK_NAME,
            mimeType: "application/json",
            parents: [folderId],
            appProperties: {
                app: "free-map-router",
                role: "manual-work-library",
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
            "Google Drive could not create the Manual Work Library.",
        );
        return response.json();
    }

    async function updateManualWorkFile(
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
            "Google Drive could not update the Manual Work Library.",
        );
        return response.json();
    }

    async function saveManualWorkToDrive(
        token,
        library,
        fetchFn = globalThis.fetch,
    ) {
        const contents = JSON.stringify(library, null, 2);
        const folder = await ensureBackupFolder(token, fetchFn);
        const existing = await findManualWorkFile(
            token,
            folder.id,
            fetchFn,
        );
        return existing
            ? updateManualWorkFile(
                  token,
                  existing.id,
                  contents,
                  fetchFn,
              )
            : createManualWorkFile(token, folder.id, contents, fetchFn);
    }

    async function loadManualWorkFromDrive(
        token,
        fetchFn = globalThis.fetch,
    ) {
        const folder = await findBackupFolder(token, fetchFn);
        if (!folder) return null;
        const existing = await findManualWorkFile(
            token,
            folder.id,
            fetchFn,
        );
        if (!existing) return null;

        const response = await fetchFn(
            `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(existing.id)}?alt=media`,
            { headers: authorizationHeaders(token) },
        );
        requireSuccessfulResponse(
            response,
            "Google Drive could not open the Manual Work Library.",
        );
        return response.text();
    }

    return Object.freeze({
        DRIVE_MANUAL_WORK_NAME,
        findManualWorkFile,
        loadManualWorkFromDrive,
        saveManualWorkToDrive,
    });
});