"use strict";

class RouteAuthenticationError extends Error {
    constructor(statusCode, code, message) {
        super(message);
        this.name = "RouteAuthenticationError";
        this.statusCode = statusCode;
        this.code = code;
    }
}

function bearerToken(request) {
    const authorization = String(request?.headers?.authorization ?? "").trim();
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    const token = String(match?.[1] ?? "").trim();
    if (!token) {
        throw new RouteAuthenticationError(
            401,
            "SIGN_IN_REQUIRED",
            "Sign in with the approved company Google account.",
        );
    }
    return token;
}

function requiredSetting(value, name) {
    const normalized = String(value ?? "").trim();
    if (!normalized) {
        throw new Error(`${name} is required.`);
    }
    return normalized;
}

function defaultOAuthClient(clientId) {
    const { OAuth2Client } = require("google-auth-library");
    return new OAuth2Client(clientId);
}

async function verifyGoogleIdentityToken(
    idToken,
    {
        clientId = process.env.FMR_GOOGLE_CLIENT_ID,
        allowedEmail = process.env.FMR_ALLOWED_EMAIL,
        oauthClient,
    } = {},
) {
    const normalizedToken = String(idToken ?? "").trim();
    if (!normalizedToken) {
        throw new RouteAuthenticationError(
            401,
            "SIGN_IN_REQUIRED",
            "Sign in with the approved company Google account.",
        );
    }

    const normalizedClientId = requiredSetting(
        clientId,
        "FMR_GOOGLE_CLIENT_ID",
    );
    const normalizedAllowedEmail = requiredSetting(
        allowedEmail,
        "FMR_ALLOWED_EMAIL",
    ).toLowerCase();
    const verifier = oauthClient || defaultOAuthClient(normalizedClientId);

    let ticket;
    try {
        ticket = await verifier.verifyIdToken({
            idToken: normalizedToken,
            audience: normalizedClientId,
        });
    } catch {
        throw new RouteAuthenticationError(
            401,
            "INVALID_SIGN_IN",
            "Google sign-in could not be verified. Sign in again.",
        );
    }

    const payload = ticket?.getPayload?.() || {};
    const subject = String(payload.sub ?? "").trim();
    const email = String(payload.email ?? "").trim().toLowerCase();
    const emailVerified = payload.email_verified === true;

    if (!subject || !emailVerified) {
        throw new RouteAuthenticationError(
            401,
            "INVALID_SIGN_IN",
            "Google sign-in could not be verified. Sign in again.",
        );
    }

    if (email !== normalizedAllowedEmail) {
        throw new RouteAuthenticationError(
            403,
            "ACCOUNT_NOT_ALLOWED",
            "Use the approved company Google account for road optimization.",
        );
    }

    return Object.freeze({ subject, email });
}

async function authenticateRequest(request, options = {}) {
    return verifyGoogleIdentityToken(bearerToken(request), options);
}

module.exports = {
    RouteAuthenticationError,
    authenticateRequest,
    bearerToken,
    verifyGoogleIdentityToken,
};
