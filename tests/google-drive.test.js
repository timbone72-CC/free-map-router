const test = require("node:test");
const assert = require("node:assert/strict");

const {
    CLIENT_ID,
    DRIVE_BACKUP_NAME,
    DRIVE_SCOPE,
    findBackupFile,
    loadBackupFromDrive,
    saveBackupToDrive,
} = require("../google-drive.js");

test("Google Drive connection uses the limited drive.file permission", () => {
    assert.equal(DRIVE_SCOPE, "https://www.googleapis.com/auth/drive.file");
    assert.match(CLIENT_ID, /\.apps\.googleusercontent\.com$/);
    assert.equal(DRIVE_BACKUP_NAME, "Free Map Router Backup.json");
});

test("backup search is limited to the app backup filename", async () => {
    let requestedUrl = "";
    const file = await findBackupFile("token", async (url, options) => {
        requestedUrl = url;
        assert.equal(options.headers.Authorization, "Bearer token");
        return {
            ok: true,
            json: async () => ({
                files: [{ id: "file-1", name: DRIVE_BACKUP_NAME }],
            }),
        };
    });

    const request = new URL(requestedUrl);
    assert.match(request.searchParams.get("q"), /Free Map Router Backup\.json/);
    assert.equal(request.searchParams.get("pageSize"), "1");
    assert.equal(file.id, "file-1");
});

test("first Drive save creates a JSON backup", async () => {
    const requests = [];
    const fetchFn = async (url, options) => {
        requests.push({ url, options });
        if (url.startsWith("https://www.googleapis.com/drive/v3/files?")) {
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
    assert.equal(requests[1].options.method, "POST");
    assert.match(requests[1].options.body, /Free Map Router Backup\.json/);
    assert.match(requests[1].options.body, /"address": "Home"/);
});

test("Drive restore downloads the existing backup", async () => {
    let count = 0;
    const text = await loadBackupFromDrive("token", async (url) => {
        count++;
        if (count === 1) {
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
