"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    RouteAuthenticationError,
    bearerToken,
    verifyGoogleIdentityToken,
} = require("../google-route-auth.js");

const CLIENT_ID = "test-client.apps.googleusercontent.com";
const COMPANY_EMAIL = "inandoutinspections2026@gmail.com";

function fakeOAuthClient(payload, error = null) {
    return {
        async verifyIdToken(options) {
            assert.equal(options.audience, CLIENT_ID);
            assert.equal(options.idToken, "signed-token");
            if (error) throw error;
            return { getPayload: () => payload };
        },
    };
}

test("bearer token is required and parsed without exposing it", () => {
    assert.equal(
        bearerToken({ headers: { authorization: "Bearer signed-token" } }),
        "signed-token",
    );

    assert.throws(
        () => bearerToken({ headers: {} }),
        (error) =>
            error instanceof RouteAuthenticationError &&
            error.statusCode === 401 &&
            error.code === "SIGN_IN_REQUIRED",
    );
});

test("verified company Google account is accepted", async () => {
    const identity = await verifyGoogleIdentityToken("signed-token", {
        clientId: CLIENT_ID,
        allowedEmail: COMPANY_EMAIL,
        oauthClient: fakeOAuthClient({
            sub: "company-account-subject",
            email: COMPANY_EMAIL.toUpperCase(),
            email_verified: true,
        }),
    });

    assert.deepEqual(identity, {
        subject: "company-account-subject",
        email: COMPANY_EMAIL,
    });
    assert.equal(Object.isFrozen(identity), true);
});

test("a different Google account is rejected", async () => {
    await assert.rejects(
        verifyGoogleIdentityToken("signed-token", {
            clientId: CLIENT_ID,
            allowedEmail: COMPANY_EMAIL,
            oauthClient: fakeOAuthClient({
                sub: "personal-account-subject",
                email: "timbone72@gmail.com",
                email_verified: true,
            }),
        }),
        (error) =>
            error instanceof RouteAuthenticationError &&
            error.statusCode === 403 &&
            error.code === "ACCOUNT_NOT_ALLOWED",
    );
});

test("unverified or invalid Google tokens fail closed", async () => {
    await assert.rejects(
        verifyGoogleIdentityToken("signed-token", {
            clientId: CLIENT_ID,
            allowedEmail: COMPANY_EMAIL,
            oauthClient: fakeOAuthClient({
                sub: "company-account-subject",
                email: COMPANY_EMAIL,
                email_verified: false,
            }),
        }),
        (error) =>
            error instanceof RouteAuthenticationError &&
            error.statusCode === 401 &&
            error.code === "INVALID_SIGN_IN",
    );

    await assert.rejects(
        verifyGoogleIdentityToken("signed-token", {
            clientId: CLIENT_ID,
            allowedEmail: COMPANY_EMAIL,
            oauthClient: fakeOAuthClient(null, new Error("bad signature")),
        }),
        (error) =>
            error instanceof RouteAuthenticationError &&
            error.statusCode === 401 &&
            error.code === "INVALID_SIGN_IN",
    );
});

test("missing production authentication settings stop startup use", async () => {
    await assert.rejects(
        verifyGoogleIdentityToken("signed-token", {
            clientId: "",
            allowedEmail: COMPANY_EMAIL,
            oauthClient: fakeOAuthClient({}),
        }),
        /FMR_GOOGLE_CLIENT_ID is required/,
    );
});
