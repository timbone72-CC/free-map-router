# Google Route Optimization Security and Billing Contract

## Purpose

This contract protects account ownership, credentials, route data, Cloud
resources, and billing for the optional Google Route Optimization feature.

The feature must remain safe even though Free Map Router is publicly hosted on
GitHub Pages.

## Account ownership

The recommended ownership model is:

### Business account

`InandOutInspections2026@gmail.com` is the permanent business control account.
It should:

- create or permanently control the Google Cloud project;
- control the Cloud Billing account and payment method;
- remain a Project Owner;
- remain a Billing Account Administrator;
- receive budget and billing alerts;
- remain the recovery path if the daily operator account becomes unavailable.

### Daily operator account

`timbone72@gmail.com` is the normal working account. It may:

- administer and deploy the approved backend;
- inspect logs and failures;
- test the app and workbook workflow;
- view project costs and quota use;
- operate the app through an approved identity allowlist.

The daily operator account must not be the only owner of the project or billing
account.

### Runtime service account

The backend uses a dedicated service account. It must:

- have only the minimum permissions needed to call Route Optimization and run
  the backend;
- have no Gmail permission;
- have no Google Drive permission;
- have no workbook or Apps Script permission;
- have no billing-administration permission;
- have no GitHub permission;
- not use a downloadable long-lived key when a platform-managed identity can be
  used instead.

## Existing account compatibility

The app and workbook may continue to be opened and operated through
`timbone72@gmail.com`. Their existing Google Drive login does not have to match
the Cloud Billing owner.

The routing backend must authorize both approved operator accounts without
forcing migration of the workbook, Drive folders, or app data to the business
account.

## Public-client rule

Free Map Router is a public static web application. Therefore:

- no unrestricted Google API key may be embedded in JavaScript;
- no service-account credential may be embedded in JavaScript;
- no secret may be stored in localStorage, IndexedDB, Drive backup files, route
  inboxes, HTML, CSS, tests, screenshots, documentation examples, or Git history;
- the browser may call only the private backend endpoint;
- the backend, not the browser, calls Route Optimization.

Any credential accidentally committed is considered compromised and must be
revoked before further development.

## Operator authentication

The private backend must reject anonymous use.

The first production version must:

- authenticate the signed-in Google user;
- allow only explicitly approved operator email accounts;
- reject expired, missing, malformed, or untrusted identity tokens;
- verify token audience and issuer server-side;
- avoid trusting an email address supplied in ordinary request JSON;
- log only the minimum account identifier necessary for security auditing.

The approved initial operator allowlist is:

- `InandOutInspections2026@gmail.com`
- `timbone72@gmail.com`

Adding another operator requires a documented access change.

## Backend exposure

The backend must:

- use HTTPS only;
- accept requests only from the approved app origin where origin checks are
  applicable;
- enforce authentication independently of browser-origin controls;
- reject unsupported HTTP methods;
- enforce request-size and stop-count limits before calling Google;
- validate every field and reject unknown or malformed structures;
- apply rate limiting or conservative Cloud quotas;
- return sanitized errors without credentials, stack traces, internal project
  details, or raw provider responses.

CORS is not authentication and must never be the only protection.

## Data minimization

The browser sends only:

- opaque stop IDs;
- Home latitude and longitude;
- selected-stop latitude and longitude;
- the approved one-vehicle optimization objective;
- a request ID used for safe response matching.

The browser does not send job notes, customer names, InspectorADE data, Gmail
content, Drive files, workbook history, payment information, or unrelated saved
addresses.

The backend must not permanently store route coordinates unless a separately
approved operational need is documented.

## Logging

Production logs may include:

- timestamp;
- authenticated operator identifier in a minimized form;
- request ID;
- stop count;
- latency;
- success, rejection, fallback, or provider-error category;
- shipment usage needed for billing review.

Production logs must not include:

- complete addresses;
- latitude/longitude values;
- route order;
- job notes;
- OAuth tokens;
- API keys;
- service-account data;
- payment details;
- full Google provider responses containing route data.

Debug logging containing route data is prohibited in production.

## Billing controls

Billing must be enabled only on the dedicated Cloud project.

Before the app can call the service in production:

- a monthly budget must be configured;
- budget alerts must reach the business account and daily operator;
- Route Optimization quotas must be set conservatively;
- backend request limits must prevent accidental loops;
- the app must require an explicit button click for every request;
- automatic retries must be bounded;
- the service must expose enough usage information to compare Google-reported
  use with actual operator actions.

Budget alerts are warnings, not guaranteed spending caps. Quotas and backend
limits are the hard operational controls.

## Initial cost-safety limits

The first production version uses these app-owned limits:

- one vehicle per request;
- maximum 100 jobs per request;
- maximum one active request per browser session;
- no automatic optimization after import, restore, edit, page load, or Drive
  connection;
- no background or scheduled requests;
- no unbounded retry;
- one manual retry after an operator-visible failure;
- conservative daily project quota sized for normal use plus testing, not for
  public traffic.

Exact Cloud quota values must be recorded during setup because provider quota
controls may change independently of the repository.

## Billing ownership and access

The company account controls the billing account. The daily operator should
receive only the billing access needed to view costs and operate the project,
unless broader access is deliberately chosen and recorded.

The payment method, billing-account ID, invoices, and payment profile details
must not be stored in GitHub.

A repository record may store only:

- Cloud project ID;
- deployment region;
- service name;
- approved account-role descriptions;
- budget and quota verification date;
- nonsecret rollback instructions.

## API enablement

Only APIs required by the approved architecture may be enabled.

The initial expected set is:

- Route Optimization API;
- Cloud Run and its required deployment/build dependencies;
- identity and logging services required by the chosen authenticated backend.

Enabling additional Maps, Gmail, Drive, Firebase, database, or analytics APIs
requires separate review.

## Route data and Google terms

The implementation must comply with current Google Maps Platform terms,
attribution rules, and restrictions on Google-generated content.

Before production release, the impact record must identify:

- which Google-derived values are displayed;
- which values, if any, are stored;
- required attribution;
- retention limits;
- whether Google Maps must be the display surface for any restricted content.

The app should store its own original stop records and final operator-approved
order, not unnecessary provider geometry or proprietary response data.

## Incident response

If a credential, endpoint, account, or billing problem is suspected:

1. Disable the backend or Route Optimization API.
2. Preserve the existing free optimizer and app route data.
3. Revoke affected credentials or sessions.
4. Review Cloud audit and billing logs.
5. Restore the last known-good app version when necessary.
6. Confirm that the workbook and Drive inbox remain unchanged.
7. Resume only after ownership, authentication, quota, and billing controls are
   verified.

## Account loss recovery

Before production release:

- both approved accounts must be tested for project access;
- the company account must be able to recover project and billing control;
- the daily operator must not be able to remove the only business recovery path
  accidentally;
- recovery codes and account security are handled outside the repository;
- no single browser profile or laptop may be the only access path.

## Change classification

Any runtime, permission, billing, authentication, or deployment change under
this contract is Level 3 and requires explicit operator approval before merge or
production enablement.