(function attachFreeMapRouterDrive(root, factory) {
    const drive = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = drive;
    }

    if (root) {
        root.FMRGoogleDrive = drive;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildDrive() {
    "use strict";

    const CLIENT_ID =
        "170117881136-v1k2p78ukleac3ep22b9rc3mpnsut4i8.apps.googleusercontent.com";
    const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
    const DRIVE_FOLDER_NAME = "Free Map Router";
    const DRIVE_BACKUP_NAME = "Free Map Router Backup.json";
    const DRIVE_INBOX_NAME = "Free Map Router Address Inbox.json";
    const DRIVE_ROUTE_ORDER_NAME = "Free Map Router Route Order.json";
    const DRIVE_CORRECTIONS_NAME = "Free Map Router Address Corrections.json";
    const WORKBOOK_FOLDER_ID = "1DEqVNh2-Z8RkzMftxd4vOxsahRwD3mvf";
    const WORKBOOK_DRIVE_ACCOUNT_ERROR_CODE =
        "WORKBOOK_DRIVE_ACCOUNT_REQUIRED";
    let tokenClient = null;
    let accessToken = "";
    let tokenExpiresAt = 0;

    function authorizationHeaders(token) {
        return { Authorization: `Bearer ${token}` };
    }

    function requireSuccessfulResponse(response, message) {
        if (!response.ok) throw new Error(message);
        return response;
    }

    function clearCachedDriveToken(token) {
        if (token && token === accessToken) {
            accessToken = "";
            tokenExpiresAt = 0;
        }
    }

    function workbookDriveAccountError(token) {
        clearCachedDriveToken(token);
        const error = new Error(
            "The selected Google Drive account cannot access the InspectorADE workbook route folder. Tap Send Route Order to Workbook again, then choose the Google account that owns the workbook.",
        );
        error.code = WORKBOOK_DRIVE_ACCOUNT_ERROR_CODE;
        return error;
    }

    async function requireWorkbookRouteFolder(
        token,
        fetchFn = globalThis.fetch,
    ) {
        const response = await fetchFn(
            `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(WORKBOOK_FOLDER_ID)}?fields=id,name,mimeType,trashed`,
            { headers: authorizationHeaders(token) },
        );
        if (!response.ok) throw workbookDriveAccountError(token);

        const folder = await response.json();
        if (
            folder?.id !== WORKBOOK_FOLDER_ID ||
            folder?.name !== DRIVE_FOLDER_NAME ||
            folder?.mimeType !== "application/vnd.google-apps.folder" ||
            folder?.trashed === true
        ) {
            throw workbookDriveAccountError(token);
        }
        return folder;
    }

    async function findBackupFolder(token, fetchFn = globalThis.fetch) {
        const url = new URL("https://www.googleapis.com/drive/v3/files");
        url.searchParams.set(
            "q",
            `name = '${DRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        );
        url.searchParams.set("spaces", "drive");
        url.searchParams.set("fields", "files(id,name)");
        url.searchParams.set("pageSize", "1");

        const response = await fetchFn(url.toString(), {
            headers: authorizationHeaders(token),
        });
        requireSuccessfulResponse(
            response,
            "Google Drive could not find the app folder.",
        );
        const data = await response.json();
        return Array.isArray(data?.files) ? data.files[0] || null : null;
    }

    async function createBackupFolder(token, fetchFn = globalThis.fetch) {
        const response = await fetchFn(
            "https://www.googleapis.com/drive/v3/files?fields=id,name",
            {
                method: "POST",
                headers: {
                    ...authorizationHeaders(token),
                    "Content-Type": "application/json; charset=UTF-8",
                },
                body: JSON.stringify({
                    name: DRIVE_FOLDER_NAME,
                    mimeType: "application/vnd.google-apps.folder",
                    appProperties: { app: "free-map-router" },
                }),
            },
        );
        requireSuccessfulResponse(
            response,
            "Google Drive could not create the app folder.",
        );
        return response.json();
    }

    async function ensureBackupFolder(token, fetchFn = globalThis.fetch) {
        return (
            (await findBackupFolder(token, fetchFn)) ||
            createBackupFolder(token, fetchFn)
        );
    }

    async function findBackupFile(
        token,
        folderId,
        fetchFn = globalThis.fetch,
    ) {
        const url = new URL("https://www.googleapis.com/drive/v3/files");
        url.searchParams.set(
            "q",
            `name = '${DRIVE_BACKUP_NAME}' and '${folderId}' in parents and trashed = false`,
        );
        url.searchParams.set("spaces", "drive");
        url.searchParams.set("fields", "files(id,name,modifiedTime,parents)");
        url.searchParams.set("orderBy", "modifiedTime desc");
        url.searchParams.set("pageSize", "1");

        const response = await fetchFn(url.toString(), {
            headers: authorizationHeaders(token),
        });
        requireSuccessfulResponse(
            response,
            "Google Drive could not find the backup.",
        );
        const data = await response.json();
        return Array.isArray(data?.files) ? data.files[0] || null : null;
    }

    async function findAddressInbox(
        token,
        folderId,
        fetchFn = globalThis.fetch,
    ) {
        const url = new URL("https://www.googleapis.com/drive/v3/files");
        url.searchParams.set(
            "q",
            `name = '${DRIVE_INBOX_NAME}' and '${folderId}' in parents and trashed = false`,
        );
        url.searchParams.set("spaces", "drive");
        url.searchParams.set("fields", "files(id,name,modifiedTime,parents)");
        url.searchParams.set("pageSize", "1");

        const response = await fetchFn(url.toString(), {
            headers: authorizationHeaders(token),
        });
        requireSuccessfulResponse(
            response,
            "Google Drive could not find the address inbox.",
        );
        const data = await response.json();
        return Array.isArray(data?.files) ? data.files[0] || null : null;
    }

    async function findRouteOrderFile(
        token,
        folderId,
        fetchFn = globalThis.fetch,
    ) {
        const url = new URL("https://www.googleapis.com/drive/v3/files");
        url.searchParams.set(
            "q",
            `name = '${DRIVE_ROUTE_ORDER_NAME}' and '${folderId}' in parents and trashed = false`,
        );
        url.searchParams.set("spaces", "drive");
        url.searchParams.set("fields", "files(id,name,modifiedTime,parents)");
        url.searchParams.set("pageSize", "2");

        const response = await fetchFn(url.toString(), {
            headers: authorizationHeaders(token),
        });
        requireSuccessfulResponse(
            response,
            "Google Drive could not find the route order file.",
        );
        const data = await response.json();
        const files = Array.isArray(data?.files) ? data.files : [];
        if (files.length > 1) {
            throw new Error(
                "More than one Free Map Router route order file was found.",
            );
        }
        return files[0] || null;
    }

    async function findCorrectionFile(
        token,
        folderId,
        fetchFn = globalThis.fetch,
    ) {
        const url = new URL("https://www.googleapis.com/drive/v3/files");
        url.searchParams.set(
            "q",
            `name = '${DRIVE_CORRECTIONS_NAME}' and '${folderId}' in parents and trashed = false`,
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
            "Google Drive could not find the permanent address corrections.",
        );
        const data = await response.json();
        const files = Array.isArray(data?.files) ? data.files : [];
        if (files.length > 1) {
            throw new Error(
                "More than one permanent address-corrections file was found.",
            );
        }
        return files[0] || null;
    }

    async function createDriveBackup(token, folderId, contents, fetchFn) {
        const boundary = `fmr_${Date.now().toString(16)}`;
        const metadata = {
            name: DRIVE_BACKUP_NAME,
            mimeType: "application/json",
            parents: [folderId],
            appProperties: { app: "free-map-router" },
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
            "Google Drive could not create the backup.",
        );
        return response.json();
    }

    async function createAddressInbox(token, folderId, fetchFn) {
        const boundary = `fmr_inbox_${Date.now().toString(16)}`;
        const metadata = {
            name: DRIVE_INBOX_NAME,
            mimeType: "application/json",
            parents: [folderId],
            appProperties: { app: "free-map-router", role: "address-inbox" },
        };
        const inbox = {
            app: "free-map-router",
            inboxVersion: 1,
            source: "InspectorADE Repeat Job Predictor - LIVE",
            updatedAt: null,
            addresses: [],
        };
        const body = [
            `--${boundary}`,
            "Content-Type: application/json; charset=UTF-8",
            "",
            JSON.stringify(metadata),
            `--${boundary}`,
            "Content-Type: application/json; charset=UTF-8",
            "",
            JSON.stringify(inbox, null, 2),
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
            "Google Drive could not create the address inbox.",
        );
        return response.json();
    }

    async function createRouteOrderFile(
        token,
        folderId,
        contents,
        fetchFn,
    ) {
        const boundary = `fmr_route_order_${Date.now().toString(16)}`;
        const metadata = {
            name: DRIVE_ROUTE_ORDER_NAME,
            mimeType: "application/json",
            parents: [folderId],
            appProperties: { app: "free-map-router", role: "route-order" },
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
            "Google Drive could not create the route order file.",
        );
        return response.json();
    }

    async function createCorrectionFile(token, folderId, contents, fetchFn) {
        const boundary = `fmr_corrections_${Date.now().toString(16)}`;
        const metadata = {
            name: DRIVE_CORRECTIONS_NAME,
            mimeType: "application/json",
            parents: [folderId],
            appProperties: {
                app: "free-map-router",
                role: "address-corrections",
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
            "Google Drive could not create the permanent address corrections.",
        );
        return response.json();
    }

    async function ensureAddressInbox(token, fetchFn = globalThis.fetch) {
        const folder = await ensureBackupFolder(token, fetchFn);
        return (
            (await findAddressInbox(token, folder.id, fetchFn)) ||
            createAddressInbox(token, folder.id, fetchFn)
        );
    }

    async function updateDriveBackup(token, fileId, contents, fetchFn) {
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
            "Google Drive could not update the backup.",
        );
        return response.json();
    }

    async function updateRouteOrderFile(token, fileId, contents, fetchFn) {
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
            "Google Drive could not update the route order file.",
        );
        return response.json();
    }

    async function updateCorrectionFile(token, fileId, contents, fetchFn) {
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
            "Google Drive could not update the permanent address corrections.",
        );
        return response.json();
    }

    async function saveRouteOrderToDrive(
        token,
        routeOrder,
        fetchFn = globalThis.fetch,
    ) {
        const contents = JSON.stringify(routeOrder, null, 2);
        const folder = await requireWorkbookRouteFolder(token, fetchFn);
        const existing = await findRouteOrderFile(token, folder.id, fetchFn);
        return existing
            ? updateRouteOrderFile(token, existing.id, contents, fetchFn)
            : createRouteOrderFile(token, folder.id, contents, fetchFn);
    }

    async function saveBackupToDrive(
        token,
        backup,
        fetchFn = globalThis.fetch,
    ) {
        const contents = JSON.stringify(backup, null, 2);
        const folder = await ensureBackupFolder(token, fetchFn);
        const existing = await findBackupFile(token, folder.id, fetchFn);
        return existing
            ? updateDriveBackup(token, existing.id, contents, fetchFn)
            : createDriveBackup(token, folder.id, contents, fetchFn);
    }

    async function saveAddressCorrectionsToDrive(
        token,
        corrections,
        fetchFn = globalThis.fetch,
    ) {
        const contents = JSON.stringify(corrections, null, 2);
        const folder = await ensureBackupFolder(token, fetchFn);
        const existing = await findCorrectionFile(token, folder.id, fetchFn);
        return existing
            ? updateCorrectionFile(token, existing.id, contents, fetchFn)
            : createCorrectionFile(token, folder.id, contents, fetchFn);
    }

    function createLatestDriveSaveQueue(saveFn = saveBackupToDrive) {
        let active = false;
        let pending = null;
        let idleResolvers = [];

        function finishIdleWaiters() {
            const resolvers = idleResolvers;
            idleResolvers = [];
            resolvers.forEach((resolve) => resolve());
        }

        async function drain() {
            if (active) return;
            active = true;

            while (pending) {
                const task = pending;
                pending = null;
                try {
                    task.resolve(await saveFn(task.token, task.backup));
                } catch (error) {
                    task.reject(error);
                }
            }

            active = false;
            finishIdleWaiters();
        }

        function enqueue(token, backup) {
            return new Promise((resolve, reject) => {
                if (pending) pending.resolve({ superseded: true });
                pending = { token, backup, resolve, reject };
                void drain();
            });
        }

        function whenIdle() {
            if (!active && !pending) return Promise.resolve();
            return new Promise((resolve) => idleResolvers.push(resolve));
        }

        return { enqueue, whenIdle };
    }

    async function loadBackupFromDrive(
        token,
        fetchFn = globalThis.fetch,
    ) {
        const folder = await findBackupFolder(token, fetchFn);
        if (!folder) {
            throw new Error("The Free Map Router folder was not found.");
        }
        const existing = await findBackupFile(token, folder.id, fetchFn);
        if (!existing) {
            throw new Error("No Free Map Router backup was found in Google Drive.");
        }

        const response = await fetchFn(
            `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(existing.id)}?alt=media`,
            { headers: authorizationHeaders(token) },
        );
        requireSuccessfulResponse(
            response,
            "Google Drive could not open the backup.",
        );
        return response.text();
    }

    async function loadAddressInboxFromDrive(
        token,
        fetchFn = globalThis.fetch,
    ) {
        const folder = await findBackupFolder(token, fetchFn);
        if (!folder) {
            throw new Error("The Free Map Router folder was not found.");
        }
        const existing = await findAddressInbox(token, folder.id, fetchFn);
        if (!existing) {
            throw new Error(
                "No Free Map Router address inbox was found in Google Drive.",
            );
        }

        const response = await fetchFn(
            `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(existing.id)}?alt=media`,
            { headers: authorizationHeaders(token) },
        );
        requireSuccessfulResponse(
            response,
            "Google Drive could not open the address inbox.",
        );
        return response.text();
    }

    async function loadAddressCorrectionsFromDrive(
        token,
        fetchFn = globalThis.fetch,
    ) {
        const folder = await findBackupFolder(token, fetchFn);
        if (!folder) return null;
        const existing = await findCorrectionFile(token, folder.id, fetchFn);
        if (!existing) return null;

        const response = await fetchFn(
            `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(existing.id)}?alt=media`,
            { headers: authorizationHeaders(token) },
        );
        requireSuccessfulResponse(
            response,
            "Google Drive could not open the permanent address corrections.",
        );
        return response.text();
    }

    function requestDriveToken() {
        if (accessToken && Date.now() < tokenExpiresAt) {
            return Promise.resolve(accessToken);
        }

        const oauth = globalThis.google?.accounts?.oauth2;
        if (!oauth) {
            return Promise.reject(
                new Error("Google sign-in is still loading. Try again."),
            );
        }

        return new Promise((resolve, reject) => {
            if (!tokenClient) {
                tokenClient = oauth.initTokenClient({
                    client_id: CLIENT_ID,
                    scope: DRIVE_SCOPE,
                    callback: () => {},
                });
            }

            tokenClient.callback = (response) => {
                if (response?.error || !response?.access_token) {
                    reject(
                        new Error(
                            response?.error_description ||
                                "Google Drive connection was not approved.",
                        ),
                    );
                    return;
                }
                accessToken = response.access_token;
                const lifetime = Number(response.expires_in) || 3600;
                tokenExpiresAt = Date.now() + Math.max(0, lifetime - 60) * 1000;
                resolve(accessToken);
            };
            tokenClient.requestAccessToken({
                prompt: accessToken ? "" : "select_account",
            });
        });
    }

    function currentDriveToken() {
        return accessToken && Date.now() < tokenExpiresAt ? accessToken : "";
    }

    return {
        CLIENT_ID,
        DRIVE_BACKUP_NAME,
        DRIVE_CORRECTIONS_NAME,
        DRIVE_FOLDER_NAME,
        DRIVE_INBOX_NAME,
        DRIVE_ROUTE_ORDER_NAME,
        DRIVE_SCOPE,
        WORKBOOK_DRIVE_ACCOUNT_ERROR_CODE,
        WORKBOOK_FOLDER_ID,
        createLatestDriveSaveQueue,
        ensureAddressInbox,
        ensureBackupFolder,
        findAddressInbox,
        findBackupFolder,
        findBackupFile,
        findCorrectionFile,
        findRouteOrderFile,
        loadAddressInboxFromDrive,
        loadAddressCorrectionsFromDrive,
        loadBackupFromDrive,
        currentDriveToken,
        requestDriveToken,
        requireWorkbookRouteFolder,
        saveBackupToDrive,
        saveAddressCorrectionsToDrive,
        saveRouteOrderToDrive,
    };
});
