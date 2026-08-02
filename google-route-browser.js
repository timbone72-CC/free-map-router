(function attachGoogleRouteBrowser(root, factory) {
    const contract =
        typeof module === "object" && module.exports
            ? require("./google-route-contract.js")
            : root?.FMRGoogleRouteContract;
    const browser = factory(contract);

    if (typeof module === "object" && module.exports) {
        module.exports = browser;
    }

    if (root) {
        root.FMRGoogleRouteBrowser = browser;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildBrowser(contract) {
    "use strict";

    if (!contract) {
        throw new Error("Google route contract failed to load.");
    }

    const CLIENT_ID =
        "170117881136-v1k2p78ukleac3ep22b9rc3mpnsut4i8.apps.googleusercontent.com";
    const BACKEND_URL =
        "https://fmr-route-optimizer-nigrg27taq-uc.a.run.app";

    class GoogleRouteBrowserError extends Error {
        constructor(code, message, statusCode = null) {
            super(message);
            this.name = "GoogleRouteBrowserError";
            this.code = code;
            this.statusCode = statusCode;
        }
    }

    function requestId(now = new Date()) {
        const stamp = now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
        const random = Math.random().toString(16).slice(2, 10);
        return `browser-${stamp}-${random}`;
    }

    function coordinateKey(stop) {
        if (
            stop?.latitude === null ||
            stop?.latitude === undefined ||
            stop?.latitude === "" ||
            stop?.longitude === null ||
            stop?.longitude === undefined ||
            stop?.longitude === ""
        ) {
            return "";
        }
        const latitude = Number(stop?.latitude);
        const longitude = Number(stop?.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "";
        return `${latitude.toFixed(7)},${longitude.toFixed(7)}`;
    }

    function duplicateCoordinateGroups(stops) {
        const groups = new Map();
        for (const stop of Array.isArray(stops) ? stops : []) {
            if (stop?.pinStatus !== "manual") continue;
            const key = coordinateKey(stop);
            if (!key) continue;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(stop);
        }
        return Array.from(groups.values()).filter((group) => group.length > 1);
    }

    function duplicateCoordinateMessage(groups) {
        const addresses = groups
            .flat()
            .map((stop) => String(stop?.address || stop?.id || "").trim())
            .filter(Boolean);
        const shown = addresses.slice(0, 6).join("; ");
        const extra = addresses.length > 6 ? `; plus ${addresses.length - 6} more` : "";
        return (
            "Google optimization stopped because different selected jobs share the same saved coordinates. " +
            `Remove those jobs from this route or correct their pins: ${shown}${extra}`
        );
    }

    function buildBrowserRequest(snapshot, id = requestId()) {
        const stops = Array.isArray(snapshot?.stops) ? snapshot.stops : [];
        const duplicateGroups = duplicateCoordinateGroups(stops);
        if (duplicateGroups.length > 0) {
            throw new GoogleRouteBrowserError(
                "DUPLICATE_COORDINATES",
                duplicateCoordinateMessage(duplicateGroups),
            );
        }

        return contract.buildBackendRequest({
            requestId: id,
            home: snapshot?.home,
            stops: stops.map((stop) =>
                stop?.pinStatus === "manual"
                    ? {
                          id: stop?.id,
                          latitude: stop?.latitude,
                          longitude: stop?.longitude,
                      }
                    : {
                          id: stop?.id,
                          address: stop?.address,
                      },
            ),
        });
    }

    async function responseJson(response) {
        try {
            return await response.json();
        } catch {
            return null;
        }
    }

    async function optimizeWithGoogle({
        snapshot,
        idToken,
        fetchImpl = globalThis.fetch,
        backendUrl = BACKEND_URL,
        id = requestId(),
    }) {
        const token = String(idToken ?? "").trim();
        if (!token) {
            throw new GoogleRouteBrowserError(
                "SIGN_IN_REQUIRED",
                "Sign in with the company Google account first.",
                401,
            );
        }
        if (typeof fetchImpl !== "function") {
            throw new Error("A fetch implementation is required.");
        }

        const request = buildBrowserRequest(snapshot, id);
        const response = await fetchImpl(`${backendUrl}/optimize`, {
            method: "POST",
            headers: {
                authorization: `Bearer ${token}`,
                "content-type": "application/json",
            },
            body: JSON.stringify(request),
        });
        const body = await responseJson(response);

        if (!response.ok) {
            throw new GoogleRouteBrowserError(
                String(body?.code || "GOOGLE_ROUTE_FAILED"),
                String(
                    body?.message ||
                        "Google road optimization could not be completed.",
                ),
                response.status,
            );
        }

        return {
            request,
            response: contract.validateBackendResponse(request, body),
        };
    }

    async function prepareSnapshotForGoogle(bridge) {
        if (typeof bridge?.prepareSelectedRouteSnapshot !== "function") {
            throw new Error("Google route preparation is unavailable. Refresh the app.");
        }
        return bridge.prepareSelectedRouteSnapshot();
    }

    function formatMetrics(response) {
        const meters = Number(response?.totalDistanceMeters);
        const seconds = Number(response?.totalDurationSeconds);
        const parts = [];

        if (Number.isFinite(meters)) {
            parts.push(`${(meters / 1609.344).toFixed(1)} road miles`);
        }
        if (Number.isFinite(seconds)) {
            const hours = seconds / 3600;
            parts.push(`${hours.toFixed(1)} hours estimated driving`);
        }

        return parts.join(" · ");
    }

    function initializeBrowserUi(root = globalThis) {
        const document = root?.document;
        const bridge = root?.FMRRouteBridge;
        const signInContainer = document?.getElementById("googleRouteSignIn");
        const optimizeButton = document?.getElementById("googleOptimizeRoute");
        const authStatus = document?.getElementById("googleRouteAuthStatus");

        if (!document || !bridge || !signInContainer || !optimizeButton) return false;

        let idToken = "";
        let identityInitialized = false;

        function setStatus(message) {
            bridge.setRouteStatus(String(message || ""));
        }

        function initializeIdentity() {
            if (identityInitialized) return;
            const identity = root?.google?.accounts?.id;
            if (!identity) {
                if (authStatus) {
                    authStatus.textContent =
                        "Google sign-in did not load. Refresh the app and try again.";
                }
                return;
            }

            identityInitialized = true;
            identity.initialize({
                client_id: CLIENT_ID,
                auto_select: false,
                cancel_on_tap_outside: true,
                callback: (credentialResponse) => {
                    idToken = String(credentialResponse?.credential ?? "").trim();
                    optimizeButton.disabled = !idToken;
                    if (authStatus) {
                        authStatus.textContent = idToken
                            ? "Signed in for this browser session. The server will verify the company account."
                            : "Google sign-in was not completed.";
                    }
                },
            });
            identity.renderButton(signInContainer, {
                type: "standard",
                theme: "outline",
                size: "large",
                text: "signin_with",
                shape: "rectangular",
            });
            if (authStatus) {
                authStatus.textContent =
                    "Sign in with InandOutInspections2026@gmail.com to test Google road optimization.";
            }
        }

        optimizeButton.disabled = true;
        optimizeButton.addEventListener("click", async () => {
            if (!idToken) {
                setStatus("Sign in with the company Google account first.");
                return;
            }

            optimizeButton.disabled = true;
            setStatus("Preparing selected addresses for Google…");

            try {
                const snapshot = await prepareSnapshotForGoogle(bridge);
                setStatus("Google is calculating a road-aware route…");
                const result = await optimizeWithGoogle({
                    snapshot,
                    idToken,
                });
                bridge.applyGoogleRouteResult(result.request, result.response);
                const metrics = formatMetrics(result.response);
                setStatus(
                    `Google road route applied to ${result.response.orderedStopIds.length} jobs.` +
                        (metrics ? ` ${metrics}.` : ""),
                );
            } catch (error) {
                setStatus(error?.message || "Google road optimization failed.");
                if (error?.statusCode === 401 || error?.statusCode === 403) {
                    idToken = "";
                    if (authStatus) {
                        authStatus.textContent =
                            "Sign-in expired or the account was not approved. Sign in again with the company account.";
                    }
                }
            } finally {
                optimizeButton.disabled = !idToken;
            }
        });

        if (document.readyState === "complete") {
            initializeIdentity();
        } else {
            root.addEventListener("load", initializeIdentity, { once: true });
        }

        return true;
    }

    return {
        BACKEND_URL,
        CLIENT_ID,
        GoogleRouteBrowserError,
        buildBrowserRequest,
        coordinateKey,
        duplicateCoordinateGroups,
        formatMetrics,
        initializeBrowserUi,
        optimizeWithGoogle,
        prepareSnapshotForGoogle,
        requestId,
    };
});

if (typeof window !== "undefined") {
    window.FMRGoogleRouteBrowser?.initializeBrowserUi(window);
}
