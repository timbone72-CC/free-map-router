"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
    DRIVE_FILES_ENDPOINT,
    DRIVE_READONLY_SCOPE,
    WORKBOOK_FOLDER_ID,
    WORKBOOK_INBOX_NAME,
    WorkbookInboxError,
    exactInboxQuery,
    readWorkbookInbox,
} = require("../workbook-inbox-reader.js");

function validInbox() {
    return {
        app: "free-map-router",
        inboxVersion: 1,
        source: "InspectorADE Repeat Job Predictor - LIVE",
        updatedAt: "2026-08-10T18:00:00.000Z",
        addresses: [
            { address: "300 Third St, Elk City, OK 73644", source: "GIS" },
            { address: "100 First St, Weatherford, OK 73096", source: "DCFS" },
        ],
    };
}

function fakeDriveClient({ files, inbox = validInbox(), readError = null }) {
    const calls = [];
    return {
        calls,
        async request(options) {
            calls.push(options);
            if (options.url === DRIVE_FILES_ENDPOINT) {
                return { data: { files } };
            }
            if (readError) throw readError;
            return { data: inbox };
        },
    };
}

test("reader uses the service account's narrow read-only Drive scope", () => {
    assert.equal(
        DRIVE_READONLY_SCOPE,
        "https://www.googleapis.com/auth/drive.readonly",
    );
});

test("reader targets only the approved folder and exact inbox filename", async () => {
    const driveClient = fakeDriveClient({
        files: [{
            id: "inbox-file-id",
            name: WORKBOOK_INBOX_NAME,
            parents: [WORKBOOK_FOLDER_ID],
        }],
    });

    const inbox = await readWorkbookInbox({ driveClient });

    assert.deepEqual(inbox, validInbox());
    assert.match(exactInboxQuery(), new RegExp(WORKBOOK_FOLDER_ID));
    assert.match(exactInboxQuery(), /Free Map Router Address Inbox\.json/);
    assert.equal(driveClient.calls.length, 2);
    assert.equal(driveClient.calls[0].method, "GET");
    assert.equal(driveClient.calls[0].params.pageSize, 2);
    assert.equal(driveClient.calls[1].method, "GET");
    assert.equal(driveClient.calls[1].params.alt, "media");
});

test("missing or duplicate exact inbox files fail closed", async () => {
    await assert.rejects(
        readWorkbookInbox({ driveClient: fakeDriveClient({ files: [] }) }),
        (error) =>
            error instanceof WorkbookInboxError &&
            error.code === "WORKBOOK_INBOX_NOT_FOUND",
    );

    await assert.rejects(
        readWorkbookInbox({
            driveClient: fakeDriveClient({
                files: [{ id: "one" }, { id: "two" }],
            }),
        }),
        (error) =>
            error instanceof WorkbookInboxError &&
            error.code === "WORKBOOK_INBOX_AMBIGUOUS",
    );
});

test("damaged inbox data is rejected without changing Drive", async () => {
    const driveClient = fakeDriveClient({
        files: [{
            id: "inbox-file-id",
            name: WORKBOOK_INBOX_NAME,
            parents: [WORKBOOK_FOLDER_ID],
        }],
        inbox: { app: "wrong-app", addresses: [] },
    });

    await assert.rejects(
        readWorkbookInbox({ driveClient }),
        (error) =>
            error instanceof WorkbookInboxError &&
            error.code === "WORKBOOK_INBOX_INVALID",
    );
    assert.deepEqual(
        driveClient.calls.map((call) => call.method),
        ["GET", "GET"],
    );
});
