const test = require("node:test");
const assert = require("node:assert/strict");

const googleDrive = require("../google-drive.js");
const {
    DRIVE_GIG_HANDOFF_NAME,
    GIG_HANDOFF_VERSION,
    buildGigHandoff,
    findGigHandoffFile,
    saveGigHandoffToDrive,
} = require("../gig-handoff.js");

test("gig handoff keeps immutable Gig_ID and only approved workbook fields", () => {
    const handoff = buildGigHandoff(
        [
            {
                id: "gig-one",
                stopId: "stop-one",
                source: "HNP",
                workOrderId: "WO-77",
                expectedPay: 60,
                dueDate: "2026-08-25",
                completedDate: null,
                notes: "Lockbox 3633",
                routeIncluded: true,
                createdAt: "2026-08-24T18:00:00.000Z",
                updatedAt: "2026-08-24T19:00:00.000Z",
            },
        ],
        [{ id: "stop-one", address: "413 NW 57TH ST, LAWTON, OK 73505" }],
        new Date("2026-08-25T01:00:00.000Z"),
    );

    assert.equal(handoff.app, "free-map-router");
    assert.equal(handoff.gigHandoffVersion, GIG_HANDOFF_VERSION);
    assert.equal(handoff.updatedAt, "2026-08-25T01:00:00.000Z");
    assert.deepEqual(handoff.gigs, [
        {
            gigId: "gig-one",
            source: "HNP",
            address: "413 NW 57TH ST, LAWTON, OK 73505",
            workOrderId: "WO-77",
            expectedPay: 60,
            dueDate: "2026-08-25",
            completedDate: null,
            notes: "Lockbox 3633",
            updatedAt: "2026-08-24T19:00:00.000Z",
        },
    ]);
    const serialized = JSON.stringify(handoff);
    assert.doesNotMatch(serialized, /routeIncluded|createdAt|orderIds|Source_ID|templateId/);
});

test("gig handoff preserves blank optional values without inventing pay or dates", () => {
    const handoff = buildGigHandoff(
        [
            {
                id: "gig-two",
                stopId: "stop-two",
                source: "OTHER",
                expectedPay: null,
                dueDate: null,
                completedDate: null,
                updatedAt: "2026-08-24T20:00:00.000Z",
            },
        ],
        [{ id: "stop-two", address: "100 Main St" }],
        new Date("2026-08-25T01:00:00.000Z"),
    );

    assert.equal(handoff.gigs[0].expectedPay, null);
    assert.equal(handoff.gigs[0].dueDate, null);
    assert.equal(handoff.gigs[0].completedDate, null);
    assert.equal(handoff.gigs[0].workOrderId, "");
    assert.equal(handoff.gigs[0].notes, "");
});

test("gig handoff fails closed for duplicate Gig_ID, orphan address, bad date, or bad timestamp", () => {
    const base = {
        id: "gig-one",
        stopId: "stop-one",
        source: "HNP",
        expectedPay: 10,
        updatedAt: "2026-08-24T19:00:00.000Z",
    };
    const stops = [{ id: "stop-one", address: "100 Main St" }];

    assert.throws(
        () => buildGigHandoff([base, { ...base }], stops),
        /appears more than once/,
    );
    assert.throws(
        () => buildGigHandoff([{ ...base, stopId: "missing" }], stops),
        /not attached to a saved address/,
    );
    assert.throws(
        () => buildGigHandoff([{ ...base, dueDate: "2026-02-30" }], stops),
        /valid local calendar date/,
    );
    assert.throws(
        () => buildGigHandoff([{ ...base, updatedAt: "bad" }], stops),
        /valid timestamp/,
    );
});

test("gig handoff uses existing drive.file permission and exact governed folder", async () => {
    assert.equal(
        googleDrive.DRIVE_SCOPE,
        "https://www.googleapis.com/auth/drive.file",
    );
    assert.equal(DRIVE_GIG_HANDOFF_NAME, "Free Map Router Gig Handoff.json");

    const requests = [];
    await saveGigHandoffToDrive(
        "token",
        {
            app: "free-map-router",
            gigHandoffVersion: 1,
            updatedAt: "2026-08-25T01:00:00.000Z",
            gigs: [],
        },
        async (url, options = {}) => {
            requests.push({ url, options });
            if (requests.length === 1) {
                assert.match(url, new RegExp(googleDrive.WORKBOOK_FOLDER_ID));
                return {
                    ok: true,
                    json: async () => ({
                        id: googleDrive.WORKBOOK_FOLDER_ID,
                        name: "Free Map Router",
                        mimeType: "application/vnd.google-apps.folder",
                        trashed: false,
                    }),
                };
            }
            if (requests.length === 2) {
                return { ok: true, json: async () => ({ files: [] }) };
            }
            return { ok: true, json: async () => ({ id: "gig-handoff-1" }) };
        },
    );

    assert.equal(requests[2].options.method, "POST");
    assert.match(requests[2].options.body, /Free Map Router Gig Handoff\.json/);
    assert.match(requests[2].options.body, /gig-handoff/);
    assert.match(requests[2].options.body, new RegExp(googleDrive.WORKBOOK_FOLDER_ID));
});

test("duplicate gig handoff files stop the save instead of choosing one", async () => {
    await assert.rejects(
        () =>
            findGigHandoffFile("token", "folder-1", async () => ({
                ok: true,
                json: async () => ({ files: [{ id: "one" }, { id: "two" }] }),
            })),
        /More than one Free Map Router gig handoff file/,
    );
});
