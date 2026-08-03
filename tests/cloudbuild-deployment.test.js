const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const configPath = path.join(__dirname, "..", "cloudbuild.yaml");
const config = fs.readFileSync(configPath, "utf8");

test("automatic deployment verifies before build and deploy", () => {
  const verify = config.indexOf("id: verify-contract-and-app");
  const build = config.indexOf("id: build-commit-image");
  const deploy = config.indexOf("id: deploy-and-verify");

  assert.ok(verify >= 0, "verification step must exist");
  assert.ok(build > verify, "image build must follow verification");
  assert.ok(deploy > build, "deployment must follow verification and build");
  assert.match(config, /npm test/);
  assert.match(config, /node --check/);
  assert.match(config, /set -euo pipefail/);
});

test("automatic deployment targets only the protected service and commit", () => {
  assert.match(config, /service="fmr-route-optimizer"/);
  assert.match(config, /region="us-central1"/);
  assert.match(
    config,
    /runtime_account="fmr-route-runtime@\$PROJECT_ID\.iam\.gserviceaccount\.com"/
  );
  assert.match(
    config,
    /cloud-run-source-deploy\/fmr-route-optimizer:\$COMMIT_SHA/
  );
  assert.match(
    config,
    /repos\/timbone72-CC\/free-map-router\/commits\/main/
  );
  assert.match(config, /Skipping stale commit/);
});

test("failed live health verification restores the prior revision safely", () => {
  assert.match(config, /previous_revision=/);
  assert.match(config, /rollback_needed=1/);
  assert.match(config, /current_revision.*deployed_revision/s);
  assert.match(
    config,
    /--to-revisions="\$\$previous_revision=100"/
  );
  assert.match(config, /\/health/);
  assert.match(config, /"ok"\[\[:space:\]\]\*:\[\[:space:\]\]\*true/);
});

test("deployment does not rewrite protected runtime configuration", () => {
  assert.doesNotMatch(config, /--set-env-vars/);
  assert.doesNotMatch(config, /--update-env-vars/);
  assert.doesNotMatch(config, /--allow-unauthenticated/);
  assert.doesNotMatch(config, /--service-account=/);
});
