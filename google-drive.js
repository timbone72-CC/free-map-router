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
                prompt: accessToken ? "" : "consent",
            });
        });
    }

    return {
        CLIENT_ID,
        DRIVE_BACKUP_NAME,
        DRIVE_FOLDER_NAME,
        DRIVE_SCOPE,
        ensureBackupFolder,
        findBackupFolder,
        findBackupFile,
        loadBackupFromDrive,
        requestDriveToken,
        saveBackupToDrive,
    };
});
