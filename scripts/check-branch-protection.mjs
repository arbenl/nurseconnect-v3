import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const next = argv[i + 1];
    args[key.slice(2)] = next && !next.startsWith("--") ? next : true;
    if (args[key.slice(2)] === next) i += 1;
  }
  return args;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function boolEnabled(value) {
  if (typeof value === "boolean") return value;
  if (value && typeof value.enabled === "boolean") return value.enabled;
  return false;
}

function statusContexts(statusChecks = {}) {
  if (Array.isArray(statusChecks.contexts)) return statusChecks.contexts;
  if (Array.isArray(statusChecks.checks)) return statusChecks.checks.map((item) => item?.context).filter(Boolean);
  return [];
}

export function auditBranchProtection({ expectedConfig, observedProtection }) {
  const expected = expectedConfig.payload || {};
  const observed = observedProtection || {};
  const errors = [];

  const expectedChecks = expected.required_status_checks || {};
  const observedChecks = observed.required_status_checks || {};
  if (Boolean(observedChecks.strict) !== Boolean(expectedChecks.strict)) errors.push(`required_status_checks.strict must be ${Boolean(expectedChecks.strict)}`);

  const observedContexts = new Set(statusContexts(observedChecks));
  for (const context of statusContexts(expectedChecks)) {
    if (!observedContexts.has(context)) errors.push(`missing required status check: ${context}`);
  }

  if (boolEnabled(observed.enforce_admins) !== Boolean(expected.enforce_admins)) {
    errors.push(`enforce_admins must be ${Boolean(expected.enforce_admins)}`);
  }

  const expectedReviews = expected.required_pull_request_reviews || {};
  const observedReviews = observed.required_pull_request_reviews || {};
  if (Boolean(observedReviews.dismiss_stale_reviews) !== Boolean(expectedReviews.dismiss_stale_reviews)) {
    errors.push("required_pull_request_reviews.dismiss_stale_reviews is not enforced");
  }
  if (Boolean(observedReviews.require_code_owner_reviews) !== Boolean(expectedReviews.require_code_owner_reviews)) {
    errors.push("required_pull_request_reviews.require_code_owner_reviews is not enforced");
  }
  if ((observedReviews.required_approving_review_count || 0) < (expectedReviews.required_approving_review_count || 0)) {
    errors.push(`required_approving_review_count must be at least ${expectedReviews.required_approving_review_count}`);
  }

  if (boolEnabled(observed.required_conversation_resolution) !== Boolean(expected.required_conversation_resolution)) {
    errors.push("required_conversation_resolution is not enforced");
  }
  if (boolEnabled(observed.allow_force_pushes) !== Boolean(expected.allow_force_pushes)) {
    errors.push(`allow_force_pushes must be ${Boolean(expected.allow_force_pushes)}`);
  }
  if (boolEnabled(observed.allow_deletions) !== Boolean(expected.allow_deletions)) {
    errors.push(`allow_deletions must be ${Boolean(expected.allow_deletions)}`);
  }

  return {
    status: errors.length === 0 ? "pass" : "fail",
    errors,
    expectedChecks: statusContexts(expectedChecks),
    observedChecks: [...observedContexts],
  };
}

function ghJson(args, input) {
  return execFileSync("gh", args, { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
}

function resolveRepo(args) {
  if (args.owner && args.repo) return { owner: args.owner, repo: args.repo };
  const text = ghJson(["repo", "view", "--json", "owner,name"]);
  const data = JSON.parse(text);
  return { owner: data.owner.login, repo: data.name };
}

function fetchProtection({ owner, repo, branch }) {
  if (process.env.BRANCH_PROTECTION_AUDIT_RESPONSE) {
    if (process.env.NODE_ENV !== "test" && process.env.CI_AUDIT_TEST_MODE !== "1") {
      throw new Error("BRANCH_PROTECTION_AUDIT_RESPONSE is only allowed in test mode");
    }
    return JSON.parse(process.env.BRANCH_PROTECTION_AUDIT_RESPONSE);
  }
  const path = `repos/${owner}/${repo}/branches/${branch}/protection`;
  try {
    return JSON.parse(ghJson(["api", path]));
  } catch (error) {
    const stdout = String(error.stdout || "").trim();
    let message = stdout;
    try {
      message = JSON.parse(stdout).message || stdout;
    } catch {
      message = String(error.stderr || stdout || error.message).trim();
    }
    throw new Error(`failed to read branch protection for ${owner}/${repo}:${branch}: ${message}`);
  }
}

const isIntegrationAccessError = (error) => /resource not accessible by integration/i.test(String(error?.message || ""));

export function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const expectedConfig = readJson(args.config || ".github/branch-protection.json");
  const branch = args.branch || expectedConfig.branch || "main";
  const { owner, repo } = resolveRepo(args);
  let observedProtection;
  try {
    observedProtection = fetchProtection({ owner, repo, branch });
  } catch (error) {
    if (args["allow-inaccessible"] && isIntegrationAccessError(error)) {
      console.warn(`[branch-protection] blocked ${owner}/${repo}:${branch}`);
      console.warn(` - ${error.message}`);
      return 0;
    }
    console.error(`[branch-protection] fail ${owner}/${repo}:${branch}`);
    console.error(` - ${error.message}`);
    return 1;
  }
  const result = auditBranchProtection({ expectedConfig, observedProtection });

  if (result.status === "pass") {
    console.log(`[branch-protection] pass ${owner}/${repo}:${branch}`);
    return 0;
  }

  console.error(`[branch-protection] fail ${owner}/${repo}:${branch}`);
  for (const error of result.errors) console.error(` - ${error}`);
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = runCli();
}
