const test = require("node:test");
const assert = require("node:assert/strict");

const {
    CLIENT_ID,
    DRIVE_BACKUP_NAME,
    DRIVE_FOLDER_NAME,
    DRIVE_SCOPE,
    currentDriveToken,
    ensureBackupFolder,
    findBackupFolder,
    findBackupFile,
    loadBackupFromDrive,
    saveBackupToDrive,
} = require("../google-drive.js");

test("Google Drive connection uses the limited drive.file permission", () => {
    assert.equal(DRIVE_SCOPE, "https://www.googleapis.com/auth/drive.file");
    assert.match(CLIENT_ID, /\.apps\.googleusercontent\.com$/);
    assert.equal(DRIVE_FOLDER_NAME, "Free Map Router");
    assert.equal(DRIVE_BACKUP_NAME, "Free Map Router Backup.json");
});

test("Drive token is not exposed before the user connects", () => {
    assert.equal(currentDriveToken(), "");
});

test("app folder search is limited to the app folder name", async () => {
    let requestedUrl = "";
    const folder = await findBackupFolder("token", async (url, options) => {
        requestedUrl = url;
        assert.equal(options.headers.Authorization, "Bearer token");
        return {
            ok: true,
            json: async () => ({
                files: [{ id: "folder-1", name: DRIVE_FOLDER_NAME }],
            }),
        };
    });

    const request = new URL(requestedUrl);
    assert.match(request.searchParams.get("q"), /Free Map Router/);
    assert.match(request.searchParams.get("q"), /google-apps\.folder/);
    assert.equal(request.searchParams.get("pageSize"), "1");
    assert.equal(folder.id, "folder-1");
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
});

test("missing app folder is created", async () => {
    let count = 0;
    const folder = await ensureBackupFolder("token", async (url, options) => {
        count++;
        if (count === 1) {
            return { ok: true, json: async () => ({ files: [] }) };
        }
        assert.equal(options.method, "POST");
        assert.match(options.body, /Free Map Router/);
        return { ok: true, json: async () => ({ id: "folder-1" }) };
    });
    assert.equal(folder.id, "folder-1");
});

test("first folder Drive save creates a JSON backup", async () => {
    const requests = [];
    const fetchFn = async (url, options) => {
        requests.push({ url, options });
        if (
            requests.length === 1 &&
            url.startsWith("https://www.googleapis.com/drive/v3/files?")
        ) {
            return {
                ok: true,
                json: async () => ({ files: [{ id: "folder-1" }] }),
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
    assert.match(requests[2].options.body, /"parents":\["folder-1"\]/);
    assert.match(requests[2].options.body, /"address": "Home"/);
});

test("Drive restore downloads the existing backup", async () => {
    let count = 0;
    const text = await loadBackupFromDrive("token", async (url) => {
        count++;
        if (count === 1) {
            return {
                ok: true,
                json: async () => ({ files: [{ id: "folder-1" }] }),
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
