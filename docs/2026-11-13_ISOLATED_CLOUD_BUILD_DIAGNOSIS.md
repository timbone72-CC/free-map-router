# FMR — Isolated Cloud Build diagnosis (2026-11-13)

**Purpose:** Determine independently which of the three existing Cloud Build stages fails when releasing the unshipped Avoid tolls change (PR #140).  
**Status:** Prepared but NOT executed. The original `cloudbuild.yaml`, production `main`, Cloud Run traffic, routes, backups and workbook handoff are unchanged.  
**Tracking:** #141.  
**Reproduction source:** `feature/remember-avoid-tolls-safe-refresh-20261111` at `b0852b183e6ff35c99e6d05211631e18ed26cba4` (the previously tested unshipped feature), not the rolled-back production `main`.

## Independent diagnostics

1. **Test and syntax** — `cloudbuild-diagnostic-test.yaml`: executes the same `npm test` and root JavaScript `node --check` commands as the production config. It writes `FMR DIAGNOSTIC TEST: PASS` or `FAIL` in the Cloud Build logs. No image publishing and no deploy.
2. **Build image** — `cloudbuild-diagnostic-image.yaml`: runs the same Cloud Native Buildpacks builder and Node version as production, but publishes a uniquely tagged `diagnostic-$BUILD_ID` image to the existing Artifact Registry repository. Does not deploy anything. The last step records the full exact image URI on success.
3. **Deploy and health check** — `cloudbuild-diagnostic-deploy.yaml`: defaults to `_OPERATOR_APPROVED=NO` and `_DIAGNOSTIC_IMAGE=UNSET`, so a default run immediately refuses to deploy. After explicit operator approval and separate passing evidence from stages 1 and 2, an operator can provide the exact produced image URI and approval flag, which deploys a **tagged Cloud Run revision with `--no-traffic`**. It checks the runtime service account, prints its own failure in Cloud Build logs, and probes the tagged `/health` endpoint. This is a real Cloud Run configuration change, though it does not route production traffic to the new revision. No automatic traffic cutover is included.

These are **three separate manual Cloud Build runs**, not steps automatically triggered by a push or a pull request. Each has its own Build ID, result and logs. A failure in one does not hide the result of an earlier one. Run stages in order, stopping on the first failed stage. Stage 3 is not an unrestricted deployment authorization.

## Execution governance

- **Do not use** the original main-connected `cloudbuild.yaml` to diagnose by blind resubmission; it includes an automatic live deploy on success.
- The original `cloudbuild.yaml` and active trigger stay untouched.
- The default branch stays on working rollback `03a6a63bc115964f64ecdd760364fcff515a504d`.
- This isolated diagnostic branch is based on the unpublished toll-feature head, so it tests the same feature rather than an unrelated current-main revision.
- Run each diagnostic only against this exact diagnostic branch's source revision; do not use a different checkout accidentally.
- **No automatic triggering, no merging without Level 3 approval.** Manual invocation may require access to the private Google Cloud project. Build image stage publishes an Artifact Registry image and may incur normal Cloud Build/storage cost.
- For stage 3, inspect prior PASS evidence, approve the exact image explicitly, and then confirm Cloud Run traffic remains on the prior ready production revision. Even a healthy zero-traffic revision is not a release. Promote only in a separate, explicitly authorized change after appropriate checks.
- If a stage fails, copy its exact Cloud Build error and step ID to #141. Diagnose the actual failure before modifying the pipeline or feature.
- No paid Google route optimization API call is performed by these diagnostic configurations.

## Known evidence and limits

PR #140 reported 561/561 automated tests passing on its feature head and a failing Cloud Build ID `53382c2c-b60d-473c-974c-7eaf6613c03d`. That record does not identify the failed Cloud Build stage. The old build log remains the fastest evidence if accessible, and should be inspected before spending time or money repeating builds.

**No FMR app runtime or Google Cloud service has been changed by preparing these files.**
