# Automatic Cloud Run Deployment — Level 3 Impact Record

## Status and approval

- Status: implementation prepared on
  `agent/automatic-cloud-run-deployment`; no trigger or live deployment has
  been created by this branch.
- Operator request: **Automatic Cloud Run Deployment**, following the successful
  manual deployment of revision `fmr-route-optimizer-00004-9tg`.
- Implementation authorization: received for the scope recorded below.
- Explicit Level 3 pre-merge approval: recorded by the operator's request to
  proceed with **Automatic Cloud Run Deployment** for this exact scope.
- Baseline and rollback commit: `433443d`.

## Problem and evidence

GitHub Pages already publishes the browser app from `main`, but the private
Google optimizer backend does not redeploy when backend code is merged. The
operator had to run `gcloud run deploy --source=.` from an authenticated laptop
after PR #28 merged. That deployment succeeded, served revision
`fmr-route-optimizer-00004-9tg` at 100 percent traffic, and returned
`{"ok":true,"service":"fmr-route-optimizer"}` from `/health`.

The repository currently contains only the GitHub verification workflow. It has
no `cloudbuild.yaml` and no automatic Cloud Run deployment path.

## Approved behavior and scope

When the connected Cloud Build trigger receives a new commit on GitHub `main`:

1. run the complete repository test suite and root JavaScript syntax gate;
2. build one commit-tagged Node.js image with Google buildpacks;
3. stop without deployment when that commit is no longer GitHub `main`;
4. verify that the existing service still uses the protected runtime service
   account;
5. deploy only the image to the existing `fmr-route-optimizer` service in
   `us-central1`;
6. verify the live `/health` response; and
7. if that verification fails, return traffic to the preceding ready revision
   unless a newer revision has already replaced it.

Owning files:

- `cloudbuild.yaml`: owns automatic verification, image build, deployment,
  stale-commit rejection, health verification, and bounded rollback.
- `tests/cloudbuild-deployment.test.js`: protects the deployment sequence,
  target, fail-closed behavior, and configuration-preservation boundary.
- this impact record: owns the Level 3 scope, approval, and recovery record.

No browser runtime, route order, optimization request, address handling,
storage, Drive, workbook handoff, sign-in, Google Maps section, Android Auto,
Garmin, or user-facing behavior is changed.

No workbook/router integration impact.

## Read and write surfaces

Reads:

- the exact GitHub commit supplied by the `main` trigger;
- the repository tests and root JavaScript files;
- GitHub's public `main` commit SHA immediately before deployment;
- the existing Cloud Run runtime service account, latest ready revision, and
  service URL; and
- the live `/health` response.

Writes:

- one commit-tagged container image in the existing regional Artifact Registry
  repository;
- one new revision of the existing Cloud Run service; and
- Cloud Run traffic, first to the new ready revision and, only on a failed
  health check, back to the preceding revision.

The workflow does not write browser storage, saved addresses, Home, pins,
routes, Drive files, workbook data, OAuth data, API keys, or application
environment variables.

## Required and optional data

Required:

- project `free-map-router`;
- repository `timbone72-CC/free-map-router`;
- branch `main`;
- service and image name `fmr-route-optimizer`;
- region and Artifact Registry location `us-central1`;
- existing Artifact Registry repository `cloud-run-source-deploy`;
- runtime service account
  `fmr-route-runtime@free-map-router.iam.gserviceaccount.com`;
- build service account
  `fmr-route-build@free-map-router.iam.gserviceaccount.com`; and
- the existing service's protected environment and public-access settings.

No optional application data is introduced. The Cloud Build trigger itself is
a one-time cloud resource configured after this branch is approved and merged.

## Schema, permission, billing, and hard limits

- No app, backup, Drive, workbook, or API schema changes.
- No new end-user, OAuth, browser, Drive, Maps, Geocoding, or Route Optimization
  permission.
- The one-time trigger setup must allow the build service account to build and
  store images, deploy the existing Cloud Run service, write build logs, and act
  only as the protected runtime service account.
- GitHub access is read-only through the Cloud Build repository connection.
- Builds run only for the `main` branch trigger and have a 20-minute limit.
- Images are tagged with the exact GitHub commit SHA.
- Existing Google Cloud build, Artifact Registry storage, and Cloud Run usage
  can incur their normal project charges; no new paid API is enabled by the
  repository file itself.

## Protected behavior

- The existing GitHub pull-request review and verification path remains
  required before merge.
- A failed repository test or syntax check stops before image build and deploy.
- The service name, region, runtime identity, environment variables, IAM/public
  access, and application configuration remain unchanged.
- The existing Cloud Run service must already exist; the deployment does not
  create a replacement service.
- The browser app remains available through GitHub Pages independently.
- All route, address, storage, integration, and navigation contracts remain
  unchanged.

## Primary risks and stale-output behavior

Primary risks:

- an incorrect trigger could deploy a non-`main` branch;
- two close merges could allow an older build to finish after a newer build;
- insufficient IAM could stop deployment;
- an image could start successfully but fail the live health contract; or
- broad deploy flags could overwrite protected service configuration.

The trigger will be restricted to `^main$`. The deployment file independently
compares its commit to the current GitHub `main` SHA immediately before deploy;
an older build exits without changing Cloud Run. It deploys only `--image` and
does not set environment variables, runtime identity, or public access.

If the live health response does not contain `"ok":true`, the build fails. It
returns traffic to the captured preceding revision only when the failing
revision is still the newest ready revision. If a newer revision is already
ready, it fails without overwriting that newer release.

## Focused tests and safe validation

Focused command:

```bash
node --test tests/cloudbuild-deployment.test.js
```

The focused test reads the deployment file only. It creates no cloud resource,
image, revision, traffic change, or billed API request.

Final gate on the final branch head:

```bash
npm test
for file in *.js; do node --check "$file"; done
```

Safe cloud validation after explicit approval:

1. create the trigger disabled or use its manual test against the exact merged
   commit;
2. verify Cloud Build runs tests before the image and deployment steps;
3. verify the resulting revision reports ready and `/health` returns
   `{"ok":true,"service":"fmr-route-optimizer"}`;
4. verify the runtime service account and existing environment settings remain
   unchanged; and
5. verify the new revision receives 100 percent of traffic.

## Recovery and rollback

Before merge or trigger creation, abandon this branch to retain `433443d` and
the current manual deployment process.

If trigger setup fails, disable or delete only the new trigger. The live service
and manual deployment process remain unchanged.

If a deployment's live health check fails, the build attempts to return traffic
to the preceding ready revision and exits with failure. Confirm that revision
serves `/health`, then disable the trigger before investigating.

If the automatic path must be removed after merge:

1. disable the Cloud Build trigger;
2. revert the deployment-config commit through a pull request;
3. keep or restore traffic to the last verified Cloud Run revision; and
4. use the previously verified manual `gcloud run deploy --source=.` process
   until a corrected automatic path is approved.

No stored-data recovery or migration is required.
