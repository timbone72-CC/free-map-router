const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
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

function runShaGate(githubReply, commitSha) {
  const start = config.indexOf('        latest_main="$$(');
  const end = config.indexOf('        actual_runtime_account="$$(', start);
  assert.ok(start !== -1 && end > start, "SHA check must precede Cloud Run calls");
  // Cloud Build substitutes '$$' with '$' before running the bash step.
  const gatedCommands = config.slice(start, end)
    .split("\n")
    .map((line) => line.replace(/^        /, ""))
    .join("\n")
    .replaceAll("$$", "$");
  const script = [
    "set -euo pipefail",
    "curl() {",
    "  case \" $* \" in",
    "    *'Accept: application/vnd.github.sha'*) ;;",
    "    *) return 40 ;;",
    "  esac",
    '  if [ "$FAKE_GITHUB_REPLY" = "@failure@" ]; then return 44; fi',
    '  printf "%s" "$FAKE_GITHUB_REPLY"',
    "}",
    gatedCommands,
    'printf "SAFE_TO_DEPLOY\\n"',
  ].join("\n");
  return spawnSync("bash", ["-c", script], {
    encoding: "utf8",
    env: {
      ...process.env,
      COMMIT_SHA: commitSha,
      FAKE_GITHUB_REPLY: githubReply,
    },
  });
}

test("Cloud Build SHA gate accepts an exact current-main SHA without Python", () => {
  assert.doesNotMatch(config, /python3/);
  assert.ok(config.includes("Accept: application/vnd.github.sha"));
  const sha = "a".repeat(40);
  const result = runShaGate(sha, sha);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /SAFE_TO_DEPLOY/);
});

test("Cloud Build SHA gate skips a stale commit without deploying", () => {
  const result = runShaGate("b".repeat(40), "a".repeat(40));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Skipping stale commit/);
  assert.doesNotMatch(result.stdout, /SAFE_TO_DEPLOY/);
});

test("Cloud Build SHA gate fails closed on malformed GitHub response", () => {
  const result = runShaGate('{"sha":"not-a-raw-hash"}', "a".repeat(40));
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /did not return a valid commit SHA/);
  assert.doesNotMatch(result.stdout, /SAFE_TO_DEPLOY/);
});

test("Cloud Build SHA gate stops on GitHub request failure", () => {
  const result = runShaGate("@failure@", "a".repeat(40));
  assert.equal(result.status, 44);
  assert.doesNotMatch(result.stdout, /SAFE_TO_DEPLOY/);
});
