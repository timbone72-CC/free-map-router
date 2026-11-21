# FMR Cloud Build Python-free commit gate — Level 3 impact record

**Date:** 2026-11-20
**Status:** Implemented on an isolated branch; required pre-merge operator approval pending.
**Baseline and rollback:** `main` commit `535bbf8eab61bac80114fd28a8ad433e3b47b5e1`.

## Evidence and exact problem

Google Cloud Build `eb9d148d-a194-413e-a8a8-4ac7a7ddf8c1`, triggered by merged PR #151, passed the test stage and successfully built/published its container image. The deploy-and-verify stage then stopped at `bash: line 16: python3: command not found`, exit 127. Its `google-cloud-cli:slim` container does not provide the Python command required by the SHA-extraction pipeline. The following curl error is secondary. The stage failed before `gcloud run deploy`.

This is evidence of the specific latest failure; it does not establish the root cause of every earlier Cloud Build failure.

## Authorized scope and owner

One bounded deployment-config repair in `cloudbuild.yaml`: ask the existing GitHub commit endpoint for its documented raw SHA response (`Accept: application/vnd.github.sha`) rather than JSON piped to an unavailable `python3` process. Require exactly 40 lowercase hexadecimal characters before comparing with the triggered `COMMIT_SHA`. Empty/malformed/error responses stop the build; mismatched valid SHA retains the pre-existing safe stale-build skip.

Existing `tests/cloudbuild-deployment.test.js` exercises the *actual extracted Cloud Build SHA guard* with matching, stale, malformed, and failed-response cases. No new command-line dependencies.

**Reads:** GitHub `main` commit SHA through the pre-existing API, Cloud Build's triggered `COMMIT_SHA`.
**Writes:** none within the changed guard. The unchanged downstream Cloud Run deploy flow still runs only after all existing gates pass.

## Protected behavior and constraints

- `set -euo pipefail`, branch/commit freshness check, expected runtime service-account check, unchanged Cloud Run service and region, prior-revision rollback, and `/health` verification are retained.
- `cloudbuild.yaml` stages, builder, image tag, runtime service account, and rollback logic are unchanged outside this single SHA command and its input validation.
- No browser code, route algorithms, optimization requests, user route/order state, Google Drive files, workbook handoff, authentication, network permissions, IAM roles, secrets, or storage schema change.
- The same GitHub endpoint is queried once, but its content negotiation now requires a raw SHA response. Unsupported response formats must fail closed instead of silently deploying a stale build.
- Existing Cloud Build deployment triggers use `main`. After merge, a matching main-triggered build could reach the *already existing* Cloud Run deploy stage; therefore merge is deployment-sensitive and requires operator approval.
- **No workbook/router integration impact.**

## Verification and release boundaries

1. Focused tests: run `node --test tests/cloudbuild-deployment.test.js`; assert matching SHA proceeds, stale SHA skips, malformed response fails, and network failure fails. Other existing deployment protection tests remain intact.
2. Final branch verification: complete `npm test` and root JavaScript syntax checks, with successful exact-head CI accepted as evidence. Review the PR diff and verify no unrelated changes.
3. **Pre-merge Level 3 approval:** explicitly required and not yet granted.
4. After an approved merge, inspect the resulting Google Cloud Build log. Confirm the Python error is gone and the commit identity is checked *before* any Cloud Run deployment. Inspect Cloud Run revision and `/health`; do not declare the backend deployment fixed without that actual evidence.
5. If deployment or health fails, stop and capture the exact new failed step and error. The existing built-in traffic rollback remains in effect for post-deploy health failure. Revert the narrow commit through the governed recovery process if necessary; avoid blind retries.

**Hard limits:** no test sends a request to Google Cloud or deploys a service. A passing GitHub CI suite is not a substitute for the actual future Google Cloud deployment log.
