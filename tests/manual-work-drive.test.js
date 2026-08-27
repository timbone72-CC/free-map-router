const test = require("node:test");
const assert = require("node:assert/strict");

const googleDrive = require("../google-drive.js");
const {
    DRIVE_MANUAL_WORK_NAME,
    findManualWorkFile,
    loadManualWorkFromDrive,
    saveManualWorkToDrive,
} = require("../manual-work-drive.js");

function governedFolder() {
    return {
        id: googleDrive.WORKBOOK_FOLDER_ID,
        name: googleDrive.DRIVE_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
        trashed: false,
    };
}

test("Manual Work Library keeps the existing limited Drive permission", () => {
    assert.equal(
        googleDrive.DRIVE_SCOPE,
        "https://www.googleapis.com/auth/drive.file",
    );
    assert.equal(DRIVE_MANUAL_WORK_NAME, "Free Map Router Manual Work.json");
});

test("Manual Work Library search is limited to one app-owned file", async () => {
    let requestedUrl = "";
    await findManualWorkFile("token", "folder-1", async (url) => {
        requestedUrl = url;
        return { ok: true, json: async () => ({ files: [] }) };
    });
    const request = new URL(requestedUrl);
    assert.match(request.searchParams.get("q"), /Free Map Router Manual Work\.json/);
    assert.match(request.searchParams.get("q"), /'folder-1' in parents/);
    assert.equal(request.searchParams.get("pageSize"), "2");

    await assert.rejects(
        () =>
            findManualWorkFile("token", "folder-1", async () => ({
                ok: true,
                json: async () => ({ files: [{ id: "one" }, { id: "two" }] }),
            })),
        /More than one Manual Work Library/,
    );
});

test("first Manual Work Library save creates the JSON file in the app folder", async () => {
    const requests = [];
    const result = await saveManualWorkToDrive(
        "token",
        {
            app: "free-map-router",
            manualWorkVersion: 1,
            updatedAt: "2026-08-22T12:00:00.000Z",
            properties: [],
        },
        async (url, options) => {
            requests.push({ url, options });
            if (requests.length === 1) {
                return { ok: true, json: async () => governedFolder() };
            }
            if (requests.length === 2) {
                return { ok: true, json: async () => ({ files: [] }) };
            }
            return { ok: true, json: async () => ({ id: "manual-work-1" }) };
        },
    );

    assert.equal(result.id, "manual-work-1");
    assert.equal(requests[2].options.method, "POST");
    assert.match(requests[2].options.body, /Free Map Router Manual Work\.json/);
    assert.match(requests[2].options.body, /manual-work-library/);
    assert.match(
        requests[2].options.body,
        new RegExp(googleDrive.WORKBOOK_FOLDER_ID),
    );
});

test("existing Manual Work Library is patched instead of duplicated", async () => {
    const requests = [];
    await saveManualWorkToDrive(
        "token",
        {
            app: "free-map-router",
            manualWorkVersion: 1,
            properties: [{ propertyId: "property-one", address: "100 Main St" }],
        },
        async (url, options) => {
            requests.push({ url, options });
            if (requests.length === 1) {
                return { ok: true, json: async () => governedFolder() };
            }
            if (requests.length === 2) {
                return { ok: true, json: async () => ({ files: [{ id: "manual-work-1" }] }) };
            }
            return { ok: true, json: async () => ({ id: "manual-work-1" }) };
        },
    );

    assert.equal(requests[2].options.method, "PATCH");
    assert.match(requests[2].url, /manual-work-1\?uploadType=media/);
});

test("Manual Work Library load returns null when no app file exists and reads the exact file when present", async () => {
    let missingCount = 0;
    const missing = await loadManualWorkFromDrive("token", async () => {
        missingCount += 1;
        if (missingCount === 1) {
            return { ok: true, json: async () => governedFolder() };
        }
        return { ok: true, json: async () => ({ files: [] }) };
    });
    assert.equal(missing, null);

    let count = 0;
    const loaded = await loadManualWorkFromDrive("token", async (url) => {
        count += 1;
        if (count === 1) {
            return { ok: true, json: async () => governedFolder() };
        }
        if (count === 2) {
            return { ok: true, json: async () => ({ files: [{ id: "manual-work-1" }] }) };
        }
        assert.match(url, /manual-work-1\?alt=media/);
        return { ok: true, text: async () => '{"app":"free-map-router"}' };
    });
    assert.equal(loaded, '{"app":"free-map-router"}');
});
