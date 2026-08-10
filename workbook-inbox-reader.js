"use strict";

const { parseAddressInbox } = require("./inbox.js");

const DRIVE_READONLY_SCOPE =
    "https://www.googleapis.com/auth/drive.readonly";
const DRIVE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";
const WORKBOOK_FOLDER_ID = "1DEqVNh2-Z8RkzMftxd4vOxsahRwD3mvf";
const WORKBOOK_INBOX_NAME = "Free Map Router Address Inbox.json";
const MAX_INBOX_BYTES = 256 * 1024;

class WorkbookInboxError extends Error {
    constructor(statusCode, code, message) {
        super(message);
        this.name = "WorkbookInboxError";
        this.statusCode = statusCode;
        this.code = code;
    }
}

let driveClientPromise = null;

function defaultDriveClient() {
    if (!driveClientPromise) {
        const { GoogleAuth } = require("google-auth-library");
        const auth = new GoogleAuth({ scopes: [DRIVE_READONLY_SCOPE] });
        driveClientPromise = auth.getClient().catch((error) => {
            driveClientPromise = null;
            throw error;
        });
    }
    return driveClientPromise;
}

function exactInboxQuery() {
    const escapedName = WORKBOOK_INBOX_NAME.replace(/'/g, "\\'");
    return (
        `'${WORKBOOK_FOLDER_ID}' in parents and ` +
        `name = '${escapedName}' and trashed = false`
    );
}

async function findExactWorkbookInbox(driveClient) {
    let response;
    try {
        response = await driveClient.request({
            url: DRIVE_FILES_ENDPOINT,
            method: "GET",
            params: {
                q: exactInboxQuery(),
                spaces: "drive",
                fields: "files(id,name,mimeType,modifiedTime,parents)",
                orderBy: "modifiedTime desc",
                pageSize: 2,
            },
        });
    } catch {
        throw new WorkbookInboxError(
            502,
            "WORKBOOK_INBOX_LOOKUP_FAILED",
            "The workbook route inbox could not be located.",
        );
    }

    const files = Array.isArray(response?.data?.files)
        ? response.data.files
        : [];
    if (files.length === 0) {
        throw new WorkbookInboxError(
            404,
            "WORKBOOK_INBOX_NOT_FOUND",
            "The workbook route inbox was not found.",
        );
    }
    if (files.length > 1) {
        throw new WorkbookInboxError(
            409,
            "WORKBOOK_INBOX_AMBIGUOUS",
            "More than one workbook route inbox was found in the approved folder.",
        );
    }

    const file = files[0];
    if (
        !String(file?.id ?? "").trim() ||
        file?.name !== WORKBOOK_INBOX_NAME ||
        !Array.isArray(file?.parents) ||
        !file.parents.includes(WORKBOOK_FOLDER_ID)
    ) {
        throw new WorkbookInboxError(
            502,
            "WORKBOOK_INBOX_LOOKUP_FAILED",
            "The workbook route inbox lookup returned an unexpected file.",
        );
    }

    return file;
}

async function readWorkbookInbox({ driveClient } = {}) {
    const client = driveClient || (await defaultDriveClient());
    const file = await findExactWorkbookInbox(client);

    let response;
    try {
        response = await client.request({
            url: `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(file.id)}`,
            method: "GET",
            params: { alt: "media" },
        });
    } catch {
        throw new WorkbookInboxError(
            502,
            "WORKBOOK_INBOX_READ_FAILED",
            "The workbook route inbox could not be opened.",
        );
    }

    const rawText =
        typeof response?.data === "string"
            ? response.data
            : JSON.stringify(response?.data ?? null);
    if (Buffer.byteLength(rawText, "utf8") > MAX_INBOX_BYTES) {
        throw new WorkbookInboxError(
            413,
            "WORKBOOK_INBOX_TOO_LARGE",
            "The workbook route inbox is too large.",
        );
    }

    try {
        parseAddressInbox(rawText);
        return JSON.parse(rawText);
    } catch {
        throw new WorkbookInboxError(
            502,
            "WORKBOOK_INBOX_INVALID",
            "The workbook route inbox has an invalid structure.",
        );
    }
}

module.exports = {
    DRIVE_FILES_ENDPOINT,
    DRIVE_READONLY_SCOPE,
    MAX_INBOX_BYTES,
    WORKBOOK_FOLDER_ID,
    WORKBOOK_INBOX_NAME,
    WorkbookInboxError,
    exactInboxQuery,
    findExactWorkbookInbox,
    readWorkbookInbox,
};
