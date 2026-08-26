const test = require("node:test");
const assert = require("node:assert/strict");

const {
    CLIENT_ID,
    DRIVE_BACKUP_NAME,
    DRIVE_CORRECTIONS_NAME,
    DRIVE_FOLDER_NAME,
    DRIVE_INBOX_NAME,
    DRIVE_ROUTE_ORDER_NAME,
    DRIVE_SCOPE,
    WORKBOOK_DRIVE_ACCOUNT_ERROR_CODE,
    WORKBOOK_FOLDER_ID,
    currentDriveToken,
    createLatestDriveSaveQueue,
    ensureAddressInbox,
    ensureBackupFolder,
    findBackupFolder,
    findBackupFile,
    loadAddressCorrectionsFromDrive,
    findAddressInbox,
    findRouteOrderFile,
    loadAddressInboxFromDrive,
    loadBackupFromDrive,
    requestDriveToken,
    requireWorkbookRouteFolder,
    saveBackupToDrive,
    saveAddressCorrectionsToDrive,
    saveRouteOrderToDrive,
} = require("../google-drive.js");

function governedFolder() {
    return {
        id: WORKBOOK_FOLDER_ID,
        name: DRIVE_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
        trashed: false,
    };
}

test("Drive save queue always writes the latest queued backup last", async () => {
    const calls = [];
    let finishFirst;
    const firstBlocked = new Promise((resolve) => {
        finishFirst = resolve;
    });
    const queue = createLatestDriveSaveQueue(async (_token, backup) => {
        calls.push(backup.route);
        if (backup.route === "old") await firstBlocked;
        return backup.route;
    });

    const oldSave = queue.enqueue("token", { route: "old" });
    const newSave = queue.enqueue("token", { route: "new" });
    finishFirst();
    await Promise.all([oldSave, newSave, queue.whenIdle()]);

    assert.deepEqual(calls, ["old", "new"]);
});

test("Google Drive connection uses the limited drive.file permission", () => {
    assert.equal(DRIVE_SCOPE, "https://www.googleapis.com/auth/drive.file");
    assert.match(CLIENT_ID, /\.apps\.googleusercontent\.com$/);
    assert.equal(DRIVE_FOLDER_NAME, "Free Map Router");
    assert.equal(DRIVE_BACKUP_NAME, "Free Map Router Backup.json");
    assert.equal(DRIVE_INBOX_NAME, "Free Map Router Address Inbox.json");
    assert.equal(DRIVE_ROUTE_ORDER_NAME, "Free Map Router Route Order.json");
    assert.equal(
        DRIVE_CORRECTIONS_NAME,
        "Free Map Router Address Corrections.json",
    );
    assert.equal(WORKBOOK_FOLDER_ID, "1DEqVNh2-Z8RkzMftxd4vOxsahRwD3mvf");
    assert.equal(
        WORKBOOK_DRIVE_ACCOUNT_ERROR_CODE,
        "WORKBOOK_DRIVE_ACCOUNT_REQUIRED",
    );
});

test("Drive token is not exposed before the user connects", () => {
    assert.equal(currentDriveToken(), "");
});

test("app folder lookup uses the exact governed folder ID", async () => {
    let requestedUrl = "";
    const folder = await findBackupFolder("token", async (url, options) => {
        requestedUrl = url;
        assert.equal(options.headers.Authorization, "Bearer token");
        return {
            ok: true,
            json: async () => ({
                id: WORKBOOK_FOLDER_ID,
                name: DRIVE_FOLDER_NAME,
                mimeType: "application/vnd.google-apps.folder",
                trashed: false,
            }),
        };
    });

    const request = new URL(requestedUrl);
    assert.equal(request.pathname, `/drive/v3/files/${WORKBOOK_FOLDER_ID}`);
    assert.equal(folder.id, WORKBOOK_FOLDER_ID);
});

test("workbook route folder is verified by exact governed folder ID", async () => {
    let requestedUrl = "";
    const folder = await requireWorkbookRouteFolder(
        "token",
        async (url, options) => {
            requestedUrl = url;
            assert.equal(options.headers.Authorization, "Bearer token");
            return {
                ok: true,
                json: async () => ({
                    id: WORKBOOK_FOLDER_ID,
                    name: DRIVE_FOLDER_NAME,
                    mimeType: "application/vnd.google-apps.folder",
                    trashed: false,
                }),
            };
        },
    );

    const request = new URL(requestedUrl);
    assert.equal(
        request.pathname,
        `/drive/v3/files/${WORKBOOK_FOLDER_ID}`,
    );
    assert.equal(request.searchParams.get("fields"), "id,name,mimeType,trashed");
    assert.equal(folder.id, WORKBOOK_FOLDER_ID);
});

test("backup search stays inside the app folder", async () => {
    let requestedUrl = "";
    await findBackupFile("token", "folder-1", async (url) => {
        requestedUrl = url;
        return { ok: true, json: async () => ({ files: [] }) };
    });

    const request = new URL(requestedUrl);
    assert.match(request.searchParams.get("q"), /Free Map Router Backup\.json/);
    assert.match(request.searchParams.get("q"), /'folder-1' in parents/);
    assert.equal(request.searchParams.get("pageSize"), "2");

    await assert.rejects(
        () => findBackupFile("token", "folder-1", async () => ({
            ok: true,
            json: async () => ({ files: [{ id: "one" }, { id: "two" }] }),
        })),
        /More than one Free Map Router backup/,
    );
});

test("address inbox search stays inside the app folder", async () => {
    let requestedUrl = "";
    await findAddressInbox("token", "folder-1", async (url) => {
        requestedUrl = url;
        return { ok: true, json: async () => ({ files: [] }) };
    });

    const request = new URL(requestedUrl);
    assert.match(request.searchParams.get("q"), /Address Inbox\.json/);
    assert.match(request.searchParams.get("q"), /'folder-1' in parents/);
    assert.equal(request.searchParams.get("pageSize"), "2");

    await assert.rejects(
        () => findAddressInbox("token", "folder-1", async () => ({
            ok: true,
            json: async () => ({ files: [{ id: "one" }, { id: "two" }] }),
        })),
        /More than one Free Map Router address inbox/,
    );
});

test("route order search stays inside the app folder and rejects duplicates", async () => {
    let requestedUrl = "";
    await findRouteOrderFile("token", "folder-1", async (url) => {
        requestedUrl = url;
        return { ok: true, json: async () => ({ files: [] }) };
    });

    const request = new URL(requestedUrl);
    assert.match(request.searchParams.get("q"), /Route Order\.json/);
    assert.match(request.searchParams.get("q"), /'folder-1' in parents/);
    assert.equal(request.searchParams.get("pageSize"), "2");

    await assert.rejects(
        () =>
            findRouteOrderFile("token", "folder-1", async () => ({
                ok: true,
                json: async () => ({ files: [{ id: "one" }, { id: "two" }] }),
            })),
        /More than one/,
    );
});

test("missing address inbox is created for the live workbook", async () => {
    let count = 0;
    const inbox = await ensureAddressInbox("token", async (url, options) => {
        count++;
        if (count === 1) {
            return {
                ok: true,
                json: async () => governedFolder(),
            };
        }
        if (count === 2) {
            return { ok: true, json: async () => ({ files: [] }) };
        }
        assert.equal(options.method, "POST");
        assert.match(options.body, /Free Map Router Address Inbox\.json/);
        assert.match(
            options.body,
            /InspectorADE Repeat Job Predictor - LIVE/,
        );
        assert.match(options.body, /"addresses": \[\]/);
        return { ok: true, json: async () => ({ id: "inbox-1" }) };
    });
    assert.equal(inbox.id, "inbox-1");
});

test("missing governed folder fails closed without creating a replacement", async () => {
    const requests = [];
    await assert.rejects(
        () => ensureBackupFolder("token", async (url, options) => {
            requests.push({ url, options });
            return { ok: false, status: 404, json: async () => ({}) };
        }),
        (error) => error?.code === WORKBOOK_DRIVE_ACCOUNT_ERROR_CODE,
    );
    assert.equal(requests.length, 1);
    assert.match(requests[0].url, new RegExp(WORKBOOK_FOLDER_ID));
    assert.equal(requests[0].options?.method, undefined);
});

test("first folder Drive save creates a JSON backup", async () => {
    const requests = [];
    const fetchFn = async (url, options) => {
        requests.push({ url, options });
        if (
            requests.length === 1 &&
            url.includes(`/drive/v3/files/${WORKBOOK_FOLDER_ID}`)
        ) {
            return {
                ok: true,
                json: async () => ({
                    id: WORKBOOK_FOLDER_ID,
                    name: DRIVE_FOLDER_NAME,
                    mimeType: "application/vnd.google-apps.folder",
                    trashed: false,
                }),
            };
        }
        if (requests.length === 2) {
            return { ok: true, json: async () => ({ files: [] }) };
        }
        return {
            ok: true,
            json: async () => ({ id: "created-1", name: DRIVE_BACKUP_NAME }),
        };
    };

    const result = await saveBackupToDrive(
        "token",
        { app: "free-map-router", home: { address: "Home" } },
        fetchFn,
    );
    assert.equal(result.id, "created-1");
    assert.equal(requests[2].options.method, "POST");
    assert.match(requests[2].options.body, /Free Map Router Backup\.json/);
    assert.match(requests[2].options.body, new RegExp(`"parents":\\["${WORKBOOK_FOLDER_ID}"\\]`));
    assert.match(requests[2].options.body, /"address": "Home"/);
});

test("route order is created once and later overwritten only in the governed workbook folder", async () => {
    const payload = {
        app: "free-map-router",
        routeOrderVersion: 1,
        stops: [{ stopNumber: 1, orderIds: ["ORDER-1"] }],
    };
    const createRequests = [];
    const created = await saveRouteOrderToDrive(
        "token",
        payload,
        async (url, options) => {
            createRequests.push({ url, options });
            if (createRequests.length === 1) {
                assert.match(url, new RegExp(WORKBOOK_FOLDER_ID));
                return {
                    ok: true,
                    json: async () => ({
                        id: WORKBOOK_FOLDER_ID,
                        name: DRIVE_FOLDER_NAME,
                        mimeType: "application/vnd.google-apps.folder",
                        trashed: false,
                    }),
                };
            }
            if (createRequests.length === 2) {
                const request = new URL(url);
                assert.match(
                    request.searchParams.get("q"),
                    new RegExp(`'${WORKBOOK_FOLDER_ID}' in parents`),
                );
                return { ok: true, json: async () => ({ files: [] }) };
            }
            return {
                ok: true,
                json: async () => ({ id: "route-order-1" }),
            };
        },
    );

    assert.equal(created.id, "route-order-1");
    assert.equal(createRequests[2].options.method, "POST");
    assert.match(createRequests[2].options.body, /Free Map Router Route Order\.json/);
    assert.match(
        createRequests[2].options.body,
        new RegExp(`"parents":\\["${WORKBOOK_FOLDER_ID}"\\]`),
    );
    assert.match(createRequests[2].options.body, /"ORDER-1"/);

    const updateRequests = [];
    await saveRouteOrderToDrive("token", payload, async (url, options) => {
        updateRequests.push({ url, options });
        if (updateRequests.length === 1) {
            return {
                ok: true,
                json: async () => ({
                    id: WORKBOOK_FOLDER_ID,
                    name: DRIVE_FOLDER_NAME,
                    mimeType: "application/vnd.google-apps.folder",
                    trashed: false,
                }),
            };
        }
        if (updateRequests.length === 2) {
            return {
                ok: true,
                json: async () => ({ files: [{ id: "route-order-1" }] }),
            };
        }
        return { ok: true, json: async () => ({ id: "route-order-1" }) };
    });

    assert.equal(updateRequests[2].options.method, "PATCH");
    assert.match(updateRequests[2].url, /route-order-1\?uploadType=media/);
});

test("Drive restore downloads the existing backup", async () => {
    let count = 0;
    const text = await loadBackupFromDrive("token", async (url) => {
        count++;
        if (count === 1) {
            return {
                ok: true,
                json: async () => governedFolder(),
            };
        }
        if (count === 2) {
            return {
                ok: true,
                json: async () => ({ files: [{ id: "file-1" }] }),
            };
        }
        assert.match(url, /file-1\?alt=media/);
        return {
            ok: true,
            text: async () => '{"app":"free-map-router"}',
        };
    });
    assert.equal(text, '{"app":"free-map-router"}');
});

test("Drive inbox load downloads the workbook handoff file", async () => {
    let count = 0;
    const text = await loadAddressInboxFromDrive("token", async (url) => {
        count++;
        if (count === 1) {
            return {
                ok: true,
                json: async () => governedFolder(),
            };
        }
        if (count === 2) {
            return {
                ok: true,
                json: async () => ({ files: [{ id: "inbox-1" }] }),
            };
        }
        assert.match(url, /inbox-1\?alt=media/);
        return {
            ok: true,
            text: async () => '{"app":"free-map-router","addresses":[]}',
        };
    });

    assert.equal(text, '{"app":"free-map-router","addresses":[]}');
});

test("permanent correction memory creates, updates, and reads one app-owned file", async () => {
    const corrections = {
        app: "free-map-router",
        correctionsVersion: 1,
        corrections: [],
    };
    const createRequests = [];
    await saveAddressCorrectionsToDrive(
        "token",
        corrections,
        async (url, options) => {
            createRequests.push({ url, options });
            if (createRequests.length === 1) {
                return { ok: true, json: async () => governedFolder() };
            }
            if (createRequests.length === 2) {
                return { ok: true, json: async () => ({ files: [] }) };
            }
            return { ok: true, json: async () => ({ id: "corrections-1" }) };
        },
    );
    assert.equal(createRequests[2].options.method, "POST");
    assert.match(createRequests[2].options.body, /Free Map Router Address Corrections\.json/);

    const updateRequests = [];
    await saveAddressCorrectionsToDrive(
        "token",
        corrections,
        async (url, options) => {
            updateRequests.push({ url, options });
            if (updateRequests.length === 1) {
                return { ok: true, json: async () => governedFolder() };
            }
            if (updateRequests.length === 2) {
                return { ok: true, json: async () => ({ files: [{ id: "corrections-1" }] }) };
            }
            return { ok: true, json: async () => ({ id: "corrections-1" }) };
        },
    );
    assert.equal(updateRequests[2].options.method, "PATCH");
    assert.match(updateRequests[2].url, /corrections-1\?uploadType=media/);

    let reads = 0;
    const loaded = await loadAddressCorrectionsFromDrive("token", async (url) => {
        reads += 1;
        if (reads === 1) {
            return { ok: true, json: async () => governedFolder() };
        }
        if (reads === 2) {
            return { ok: true, json: async () => ({ files: [{ id: "corrections-1" }] }) };
        }
        assert.match(url, /corrections-1\?alt=media/);
        return { ok: true, text: async () => JSON.stringify(corrections) };
    });
    assert.equal(loaded, JSON.stringify(corrections));
});

test("wrong Drive account fails closed, clears the cached token, and fresh authorization selects an account", async () => {
    let requestArgs = null;
    const tokenClient = {
        callback: () => {},
        requestAccessToken(args) {
            requestArgs = args;
            tokenClient.callback({
                access_token: "wrong-drive-token",
                expires_in: 3600,
            });
        },
    };
    globalThis.google = {
        accounts: {
            oauth2: {
                initTokenClient: () => tokenClient,
            },
        },
    };

    try {
        const token = await requestDriveToken();
        assert.equal(token, "wrong-drive-token");
        assert.equal(requestArgs.prompt, "select_account");
        assert.equal(currentDriveToken(), "wrong-drive-token");

        const requests = [];
        let caught = null;
        try {
            await saveRouteOrderToDrive(
                token,
                {
                    app: "free-map-router",
                    routeOrderVersion: 1,
                    stops: [{ stopNumber: 1, orderIds: ["ORDER-1"] }],
                },
                async (url) => {
                    requests.push(url);
                    return {
                        ok: false,
                        status: 404,
                        json: async () => ({}),
                    };
                },
            );
        } catch (error) {
            caught = error;
        }

        assert.equal(requests.length, 1);
        assert.match(requests[0], new RegExp(WORKBOOK_FOLDER_ID));
        assert.equal(caught?.code, WORKBOOK_DRIVE_ACCOUNT_ERROR_CODE);
        assert.match(caught?.message || "", /Tap Send Route Order to Workbook again/);
        assert.equal(currentDriveToken(), "");
    } finally {
        delete globalThis.google;
    }
});
