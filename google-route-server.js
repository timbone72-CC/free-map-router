"use strict";

const http = require("node:http");
const {
    RouteContractError,
    buildBackendRequest,
} = require("./google-route-contract.js");
const {
    buildGoogleOptimizeToursRequest,
    interpretGoogleOptimizeToursResponse,
} = require("./google-route-provider.js");

const DEFAULT_MAX_BODY_BYTES = 256 * 1024;
const METADATA_TOKEN_URL =
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

class HttpError extends Error {
    constructor(statusCode, code, message) {
        super(message);
        this.name = "HttpError";
        this.statusCode = statusCode;
        this.code = code;
    }
}

function writeJson(response, statusCode, payload) {
    const body = JSON.stringify(payload);
    response.writeHead(statusCode, {
        "content-type": "application/json; charset=utf-8",
        "content-length": Buffer.byteLength(body),
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
    });
    response.end(body);
}

async function readJsonBody(request, maxBytes = DEFAULT_MAX_BODY_BYTES) {
    const chunks = [];
    let size = 0;

    for await (const chunk of request) {
        size += chunk.length;
        if (size > maxBytes) {
            throw new HttpError(413, "REQUEST_TOO_LARGE", "Request body is too large.");
        }
        chunks.push(chunk);
    }

    if (chunks.length === 0) {
        throw new HttpError(400, "EMPTY_REQUEST", "A JSON request body is required.");
    }

    try {
        return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
        throw new HttpError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
}

async function metadataAccessToken(fetchImpl = globalThis.fetch) {
    if (typeof fetchImpl !== "function") {
        throw new Error("A fetch implementation is required.");
    }

    const response = await fetchImpl(METADATA_TOKEN_URL, {
        headers: { "Metadata-Flavor": "Google" },
    });

    if (!response.ok) {
        throw new Error(`Metadata token request failed with status ${response.status}.`);
    }

    const tokenResponse = await response.json();
    const accessToken = String(tokenResponse?.access_token ?? "").trim();
    if (!accessToken) {
        throw new Error("Metadata token response did not include an access token.");
    }

    return accessToken;
}

async function callGoogleOptimizeTours(
    backendRequest,
    {
        fetchImpl = globalThis.fetch,
        projectId = process.env.GOOGLE_CLOUD_PROJECT,
    } = {},
) {
    const request = buildBackendRequest(backendRequest);
    const normalizedProjectId = String(projectId ?? "").trim();
    if (!normalizedProjectId) {
        throw new Error("GOOGLE_CLOUD_PROJECT is required.");
    }

    const accessToken = await metadataAccessToken(fetchImpl);
    const googleRequest = buildGoogleOptimizeToursRequest(request);
    const endpoint =
        "https://routeoptimization.googleapis.com/v1/projects/" +
        encodeURIComponent(normalizedProjectId) +
        ":optimizeTours";

    const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
        },
        body: JSON.stringify(googleRequest),
    });

    if (!response.ok) {
        throw new HttpError(
            502,
            "GOOGLE_ROUTE_FAILED",
            `Google Route Optimization failed with status ${response.status}.`,
        );
    }

    const googleResponse = await response.json();
    return interpretGoogleOptimizeToursResponse(request, googleResponse);
}

function createRequestHandler({ optimize = callGoogleOptimizeTours } = {}) {
    return async function requestHandler(request, response) {
        try {
            const url = new URL(request.url, "http://localhost");

            if (request.method === "GET" && url.pathname === "/health") {
                writeJson(response, 200, { ok: true, service: "fmr-route-optimizer" });
                return;
            }

            if (url.pathname !== "/optimize") {
                throw new HttpError(404, "NOT_FOUND", "Route not found.");
            }

            if (request.method !== "POST") {
                throw new HttpError(405, "METHOD_NOT_ALLOWED", "Use POST for optimization.");
            }

            const contentType = String(request.headers["content-type"] ?? "");
            if (!contentType.toLowerCase().startsWith("application/json")) {
                throw new HttpError(
                    415,
                    "JSON_REQUIRED",
                    "Content-Type must be application/json.",
                );
            }

            const body = await readJsonBody(request);
            const validatedRequest = buildBackendRequest(body);
            const result = await optimize(validatedRequest);
            writeJson(response, 200, result);
        } catch (error) {
            if (error instanceof RouteContractError) {
                writeJson(response, 400, {
                    ok: false,
                    code: error.code,
                    message: error.message,
                });
                return;
            }

            if (error instanceof HttpError) {
                writeJson(response, error.statusCode, {
                    ok: false,
                    code: error.code,
                    message: error.message,
                });
                return;
            }

            console.error("Route optimization request failed:", error?.message || error);
            writeJson(response, 500, {
                ok: false,
                code: "INTERNAL_ERROR",
                message: "Route optimization could not be completed.",
            });
        }
    };
}

function startServer({ port = Number(process.env.PORT) || 8080 } = {}) {
    const server = http.createServer(createRequestHandler());
    server.listen(port, "0.0.0.0", () => {
        console.log(`Free Map Router optimizer listening on port ${port}.`);
    });
    return server;
}

if (require.main === module) {
    startServer();
}

module.exports = {
    DEFAULT_MAX_BODY_BYTES,
    HttpError,
    METADATA_TOKEN_URL,
    callGoogleOptimizeTours,
    createRequestHandler,
    metadataAccessToken,
    readJsonBody,
    startServer,
    writeJson,
};
