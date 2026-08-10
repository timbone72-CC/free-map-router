"use strict";

const http = require("node:http");
const {
    RouteContractError,
    buildBackendRequest,
    buildCoordinateRequest,
} = require("./google-route-contract.js");
const {
    buildGoogleOptimizeToursRequest,
    interpretGoogleOptimizeToursResponse,
} = require("./google-route-provider.js");
const {
    RouteAuthenticationError,
    authenticateRequest,
} = require("./google-route-auth.js");
const {
    WorkbookInboxError,
    readWorkbookInbox,
} = require("./workbook-inbox-reader.js");

const DEFAULT_MAX_BODY_BYTES = 256 * 1024;
const METADATA_TOKEN_URL =
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
const GOOGLE_GEOCODE_ENDPOINT =
    "https://geocode.googleapis.com/v4/geocode/address";

class HttpError extends Error {
    constructor(statusCode, code, message) {
        super(message);
        this.name = "HttpError";
        this.statusCode = statusCode;
        this.code = code;
    }
}

function writeJson(response, statusCode, payload, extraHeaders = {}) {
    const body = JSON.stringify(payload);
    response.writeHead(statusCode, {
        "content-type": "application/json; charset=utf-8",
        "content-length": Buffer.byteLength(body),
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        ...extraHeaders,
    });
    response.end(body);
}

function writeNoContent(response, extraHeaders = {}) {
    response.writeHead(204, {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        ...extraHeaders,
    });
    response.end();
}

function corsHeaders(request, allowedOrigin) {
    const configuredOrigin = String(allowedOrigin ?? "").trim();
    if (!configuredOrigin) {
        throw new Error("FMR_ALLOWED_ORIGIN is required.");
    }

    const requestOrigin = String(request?.headers?.origin ?? "").trim();
    if (requestOrigin !== configuredOrigin) {
        throw new HttpError(
            403,
            "ORIGIN_NOT_ALLOWED",
            "This route request did not come from Free Map Router.",
        );
    }

    return {
        "access-control-allow-origin": configuredOrigin,
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "Authorization, Content-Type",
        "access-control-max-age": "3600",
        vary: "Origin",
    };
}

function safeCorsHeaders(request, allowedOrigin) {
    const configuredOrigin = String(allowedOrigin ?? "").trim();
    const requestOrigin = String(request?.headers?.origin ?? "").trim();
    return configuredOrigin && requestOrigin === configuredOrigin
        ? {
              "access-control-allow-origin": configuredOrigin,
              "access-control-allow-methods": "GET, POST, OPTIONS",
              "access-control-allow-headers": "Authorization, Content-Type",
              vary: "Origin",
          }
        : {};
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

async function geocodeAddressWithGoogle(
    address,
    {
        fetchImpl = globalThis.fetch,
        accessToken,
    } = {},
) {
    if (typeof fetchImpl !== "function") {
        throw new Error("A fetch implementation is required.");
    }

    const token = String(accessToken ?? "").trim();
    if (!token) {
        throw new Error("A Google access token is required for address lookup.");
    }

    const normalizedAddress = String(address ?? "").trim();
    const endpoint =
        `${GOOGLE_GEOCODE_ENDPOINT}/${encodeURIComponent(normalizedAddress)}` +
        "?regionCode=us&languageCode=en";
    const response = await fetchImpl(endpoint, {
        headers: {
            authorization: `Bearer ${token}`,
            accept: "application/json",
        },
    });

    if (!response.ok) {
        throw new HttpError(
            502,
            "GOOGLE_GEOCODE_FAILED",
            `Google address lookup failed for ${normalizedAddress}.`,
        );
    }

    const body = await response.json();
    const location = body?.results?.[0]?.location;
    if (!location) {
        throw new HttpError(
            422,
            "ADDRESS_NOT_FOUND",
            `Google could not locate ${normalizedAddress}.`,
        );
    }

    try {
        const point = buildCoordinateRequest({
            requestId: "google-geocode-result",
            home: { latitude: 0, longitude: 0 },
            stops: [
                {
                    id: "google-geocode-result",
                    latitude: location.latitude,
                    longitude: location.longitude,
                },
            ],
        }).stops[0];
        return {
            latitude: point.latitude,
            longitude: point.longitude,
        };
    } catch (error) {
        if (error instanceof RouteContractError) {
            throw new HttpError(
                502,
                "INVALID_GEOCODE_RESULT",
                `Google returned an invalid location for ${normalizedAddress}.`,
            );
        }
        throw error;
    }
}

async function resolveGoogleRouteRequest(
    backendRequest,
    {
        fetchImpl = globalThis.fetch,
        accessToken,
        geocode = geocodeAddressWithGoogle,
    } = {},
) {
    const request = buildBackendRequest(backendRequest);
    const resolvedStops = await Promise.all(
        request.stops.map(async (stop) => {
            if (!stop.address) return stop;
            const location = await geocode(stop.address, {
                fetchImpl,
                accessToken,
            });
            return {
                id: stop.id,
                latitude: location.latitude,
                longitude: location.longitude,
            };
        }),
    );

    return buildCoordinateRequest({
        requestId: request.requestId,
        home: request.home,
        stops: resolvedStops,
    });
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
    const resolvedRequest = await resolveGoogleRouteRequest(request, {
        fetchImpl,
        accessToken,
    });
    const googleRequest = buildGoogleOptimizeToursRequest(resolvedRequest);
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

function createRequestHandler({
    optimize = callGoogleOptimizeTours,
    readInbox = readWorkbookInbox,
    authenticate = null,
    allowedOrigin = "",
} = {}) {
    return async function requestHandler(request, response) {
        try {
            const url = new URL(request.url, "http://localhost");

            if (request.method === "GET" && url.pathname === "/health") {
                writeJson(response, 200, { ok: true, service: "fmr-route-optimizer" });
                return;
            }

            if (!["/optimize", "/workbook-inbox"].includes(url.pathname)) {
                throw new HttpError(404, "NOT_FOUND", "Route not found.");
            }

            let responseCorsHeaders = {};
            if (typeof authenticate === "function") {
                responseCorsHeaders = corsHeaders(request, allowedOrigin);
                if (request.method === "OPTIONS") {
                    writeNoContent(response, responseCorsHeaders);
                    return;
                }
                await authenticate(request);
            }

            if (url.pathname === "/workbook-inbox") {
                if (request.method !== "GET") {
                    throw new HttpError(
                        405,
                        "METHOD_NOT_ALLOWED",
                        "Use GET for the workbook inbox.",
                    );
                }
                const inbox = await readInbox();
                writeJson(response, 200, inbox, responseCorsHeaders);
                return;
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
            writeJson(response, 200, result, responseCorsHeaders);
        } catch (error) {
            const responseCorsHeaders = safeCorsHeaders(request, allowedOrigin);

            if (error instanceof RouteContractError) {
                writeJson(
                    response,
                    400,
                    {
                        ok: false,
                        code: error.code,
                        message: error.message,
                    },
                    responseCorsHeaders,
                );
                return;
            }

            if (
                error instanceof HttpError ||
                error instanceof WorkbookInboxError ||
                error instanceof RouteAuthenticationError
            ) {
                writeJson(
                    response,
                    error.statusCode,
                    {
                        ok: false,
                        code: error.code,
                        message: error.message,
                    },
                    responseCorsHeaders,
                );
                return;
            }

            console.error("Free Map Router backend request failed:", error?.message || error);
            writeJson(
                response,
                500,
                {
                    ok: false,
                    code: "INTERNAL_ERROR",
                    message: "Route optimization could not be completed.",
                },
                responseCorsHeaders,
            );
        }
    };
}

function startServer({ port = Number(process.env.PORT) || 8080 } = {}) {
    const allowedOrigin = String(process.env.FMR_ALLOWED_ORIGIN ?? "").trim();
    if (!allowedOrigin) {
        throw new Error("FMR_ALLOWED_ORIGIN is required.");
    }

    const server = http.createServer(
        createRequestHandler({
            authenticate: authenticateRequest,
            allowedOrigin,
        }),
    );
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
    GOOGLE_GEOCODE_ENDPOINT,
    HttpError,
    METADATA_TOKEN_URL,
    callGoogleOptimizeTours,
    corsHeaders,
    createRequestHandler,
    geocodeAddressWithGoogle,
    metadataAccessToken,
    readJsonBody,
    readWorkbookInbox,
    resolveGoogleRouteRequest,
    safeCorsHeaders,
    startServer,
    writeJson,
    writeNoContent,
};
