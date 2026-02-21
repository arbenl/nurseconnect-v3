#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[pr-finalizer] %s\n' "$*"
}

fail() {
  FAILURES+=("$1")
}

print_failures() {
  if ((${#FAILURES[@]} > 0)); then
    printf '\n[pr-finalizer] Validation failed:\n'
    for issue in "${FAILURES[@]}"; do
      printf ' - %s\n' "$issue"
    done
    exit 1
  fi
}

log "Checking for required executable context"
if ! command -v gh >/dev/null 2>&1; then
  fail "gh CLI is required but not installed"
  print_failures
fi

if ! command -v pnpm >/dev/null 2>&1; then
  fail "pnpm is required but not installed"
  print_failures
fi

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || true)
if [[ -z "$REPO_ROOT" ]]; then
  fail "Not in a git repository"
  print_failures
fi
cd "$REPO_ROOT"

if [[ -n "$(git status --porcelain)" ]]; then
  fail "Git working tree is not clean"
  git status --short
fi

run_local_checks=("pnpm type-check" "pnpm test:ci")
for cmd in "${run_local_checks[@]}"; do
  log "Running local gate command: ${cmd}"
  if ! bash -lc "$cmd"; then
    fail "Local gate command failed: ${cmd}"
  fi
 done

pr_number="${PR_NUMBER:-}"
if [[ -z "$pr_number" ]]; then
  if [[ -n "${GITHUB_EVENT_PATH:-}" && -f "$GITHUB_EVENT_PATH" ]]; then
    pr_number=$(node -e "const e = JSON.parse(require('fs').readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')); console.log(e?.pull_request?.number || '');")
  fi
fi

if [[ -z "$pr_number" ]]; then
  branch_name=$(git rev-parse --abbrev-ref HEAD)
  if [[ "$branch_name" != "HEAD" ]]; then
    pr_number=$(gh pr view "$branch_name" --json number --jq '.number' 2>/dev/null || true)
  fi
fi

if [[ -z "$pr_number" || "$pr_number" == "null" ]]; then
  fail "Unable to resolve PR number. Set PR_NUMBER or run from a checked out PR branch."
  print_failures
fi

log "Resolving PR metadata for #$pr_number"
PR_JSON=$(gh pr view "$pr_number" --json number,title,body,statusCheckRollup,files 2>/dev/null || true)
if [[ -z "$PR_JSON" ]]; then
  fail "Failed to read PR metadata with gh pr view #$pr_number"
  print_failures
fi

REPO_OWNER=$(gh repo view --json owner --jq '.owner.login')
REPO_NAME=$(gh repo view --json name --jq '.name')
THREADS_JSON=$(PR_NUMBER="$pr_number" REPO_OWNER="$REPO_OWNER" REPO_NAME="$REPO_NAME" node - <<'NODE'
const { execSync } = require('child_process');
const { inspect } = require('util');

const prNumber = Number(process.env.PR_NUMBER);
const owner = process.env.REPO_OWNER;
const repo = process.env.REPO_NAME;

if (!Number.isFinite(prNumber) || !owner || !repo) {
  console.error('Missing PR number, repository owner, or repository name for review thread lookup.');
  process.exit(1);
}

const query = `query { repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(
  repo,
)} ) { pullRequest(number: ${prNumber}) { reviewThreads(first: 100) { nodes { id isResolved path comments(first: 1) { nodes { path } } } } } } }`;

const payload = JSON.stringify({ query });
let responseText;
try {
  responseText = execSync('gh api graphql --input -', { input: payload }).toString();
} catch (error) {
  console.error('Failed to query PR review threads from GitHub GraphQL API.');
  if (error?.stdout) {
    console.error(error.stdout.toString());
  }
  if (error?.stderr) {
    console.error(error.stderr.toString());
  }
  process.exit(1);
}

let response;
try {
  response = JSON.parse(responseText);
} catch (error) {
  console.error('Failed to parse review threads response from GitHub GraphQL API:', inspect(error));
  process.exit(1);
}

if (response.errors && response.errors.length) {
  const messages = response.errors.map((item) => item.message || 'Unknown GraphQL error');
  console.error('GraphQL errors:', messages.join('\\n'));
  process.exit(1);
}

const nodes = response?.data?.repository?.pullRequest?.reviewThreads?.nodes || [];
const unresolved = Array.isArray(nodes)
  ? nodes.filter((thread) => thread && thread.isResolved === false)
  : [];

const resolvedThreads = unresolved
  .map((thread) => ({
    id: thread?.id || 'unknown',
    path: thread?.path || thread?.comments?.nodes?.[0]?.path || 'unknown',
  }))
  .filter(Boolean);

console.log(JSON.stringify(resolvedThreads));
NODE
)
if [[ -z "$THREADS_JSON" ]]; then
  fail "Failed to resolve review threads for PR #$pr_number."
  print_failures
fi

REQUIRED_CHECKS=$'Type Check & Lint\nUnit Tests (jsdom)\nDB Integration Tests (node)\nE2E API Tests\nE2E UI Smoke Gate'
if [[ -n "${PR_FINALIZER_REQUIRED_CHECKS:-}" ]]; then
  REQUIRED_CHECKS="$PR_FINALIZER_REQUIRED_CHECKS"
fi

if ! CI_GUARD_OUTPUT=$(PR_JSON="$PR_JSON" REQUIRED_CHECKS="$REQUIRED_CHECKS" UNRESOLVED_THREADS="$THREADS_JSON" node - <<'NODE'
const data = JSON.parse(process.env.PR_JSON || '{}');
const required = (process.env.REQUIRED_CHECKS || '')
  .split('\n')
  .map((v) => v.trim())
  .filter(Boolean);
const errors = [];

const checks = Array.isArray(data.statusCheckRollup) ? data.statusCheckRollup : [];
for (const checkName of required) {
  const entry = checks.find((item) => item && item.name === checkName);
  if (!entry) {
    errors.push(`Missing required check: ${checkName}`);
    continue;
  }
  if (entry.status !== 'COMPLETED') {
    errors.push(`Required check not completed yet: ${checkName} (${entry.status})`);
    continue;
  }
  if (!['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(entry.conclusion)) {
    errors.push(`Required check did not pass: ${checkName} (${entry.conclusion})`);
  }
}

const unresolvedThreads = JSON.parse(process.env.UNRESOLVED_THREADS || '[]');
if (unresolvedThreads.length > 0) {
  errors.push(`Unresolved review conversations: ${unresolvedThreads.length}`);
  for (const thread of unresolvedThreads) {
    const location = thread.path || 'unknown location';
    const threadId = thread.id ? `[${thread.id}]` : '';
    errors.push(`  - ${location} ${threadId}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
NODE
); then
  fail "GitHub checks/review validation failed:\n${CI_GUARD_OUTPUT}"
fi

if ! BODY_OUTPUT=$(PR_JSON="$PR_JSON" node - <<'NODE'
const data = JSON.parse(process.env.PR_JSON || '{}');
const body = data.body || '';

function extractSection(markdown, heading) {
  const lines = String(markdown).split(/\r?\n/);
  const titleRegex = new RegExp(`^#{2,6}\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
  let start = -1;
  let startLevel = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (titleRegex.test(lines[i])) {
      start = i + 1;
      startLevel = (lines[i].match(/^#+/)[0] || '').length;
      break;
    }
  }
  if (start < 0) return '';

  const out = [];
  for (let i = start; i < lines.length; i += 1) {
    const levelMatch = lines[i].match(/^(#{2,6})\s+/);
    if (levelMatch && levelMatch[1].length <= startLevel) break;
    out.push(lines[i]);
  }
  return out.join('\n').trim();
}

function extractSubsection(markdown, heading) {
  const lines = String(markdown).split(/\r?\n/);
  const titleRegex = new RegExp(`^#{3,6}\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
  let start = -1;
  let startLevel = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (titleRegex.test(lines[i])) {
      start = i + 1;
      startLevel = (lines[i].match(/^(#{2,6})/)[0] || '').length;
      break;
    }
  }
  if (start < 0) return '';
  const out = [];
  for (let i = start; i < lines.length; i += 1) {
    const match = lines[i].match(/^(#{2,6})\s+/);
    if (match && match[1].length <= startLevel) break;
    out.push(lines[i]);
  }
  return out.join('\n').trim();
}

function hasPathLine(text) {
  return /(https?:\/\/\S+|`[^`]+`|\[[^\]]+\]\([^\)]+\))/i.test(text);
}

function hasCheckedItem(section, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^\\s*[-*]\\s*\\[[xX]\\]\\s*.*${escaped}.*$`, 'im').test(section || '');
}

const errors = [];

const evidenceSection = extractSection(body, 'Evidence');
if (!evidenceSection) {
  errors.push('PR body missing required "Evidence" section.');
} else {
  const logs = extractSubsection(evidenceSection, 'Logs');
  const screenshots = extractSubsection(evidenceSection, 'Screenshots');
  const runbook = extractSubsection(evidenceSection, 'Runbook');

  if (!logs || !hasPathLine(logs)) {
    errors.push('Evidence section missing Logs item with a path/link.');
  }
  if (!screenshots || !hasPathLine(screenshots)) {
    errors.push('Evidence section missing Screenshots item with a path/link.');
  }
  if (!runbook || !hasPathLine(runbook)) {
    errors.push('Evidence section missing Runbook item with a path/link.');
  }
}

const guardrailsSection = extractSection(body, 'Pilot guardrails');
if (!guardrailsSection) {
  errors.push('PR body missing required "Pilot guardrails" section.');
}

const files = Array.isArray(data.files)
  ? data.files.map((entry) => (typeof entry === 'string' ? entry : entry.path)).filter(Boolean)
  : [];
const protectedPatterns = [
  /^apps\/web\/src\/app\/api\/auth\//,
  /^apps\/web\/src\/app\/.*\/route\.ts$/,
  /^apps\/web\/src\/middleware\.ts$/,
  /\/proxy\//,
  /^packages\/contracts\//,
  /^apps\/contracts\//,
  /^contracts\//,
];

const protectedChanges = files.filter((file) =>
  protectedPatterns.some((pattern) => pattern.test(file))
);

if (!guardrailsSection) {
  if (protectedChanges.length === 0) {
    errors.push('Pilot guardrails could not be validated because the section is missing.');
  }
} else {
  if (protectedChanges.length === 0) {
    if (!hasCheckedItem(guardrailsSection, 'no protected auth/routing/proxy/api contract files were changed')) {
      errors.push('Pilot guardrails: confirm no protected auth/routing/proxy/API contract files were changed.');
    }
  } else {
    if (!hasCheckedItem(guardrailsSection, 'protected files are explicitly allowed')) {
      errors.push('Pilot guardrails requires explicit approval for protected file changes.');
    }
    const missingAllowlist = [];
    for (const file of protectedChanges) {
      if (!guardrailsSection.includes(file)) {
        missingAllowlist.push(file);
      }
    }
    if (missingAllowlist.length > 0) {
      errors.push(`Pilot guardrails missing explicit listing for: ${missingAllowlist.join(', ')}`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
NODE
); then
  fail "PR body and pilot guardrails validation failed:\n${BODY_OUTPUT}"
fi

print_failures
log "All PR-finalizer checks passed"
