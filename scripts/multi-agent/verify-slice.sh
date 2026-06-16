#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_REF="origin/main"
RUN_ID=""
RUN_ROOT=""
ALLOW_MAIN=0
RUN_STATIC=0
RUN_REQUIRED=0
MODEL_REVIEW_PACKET=""
MODEL_REVIEWERS="sonnet46,gemini"
MODEL_REVIEW_DRY_RUN=0
MODEL_REVIEW_DEBATE=0
MODEL_REVIEW_STATUS="not-run"
MODEL_REVIEW_COMPLETED="none"
MODEL_REVIEW_DRY_RUN_ROUTES="none"
MODEL_REVIEW_BLOCKED="none"
FETCH_STATUS="ok"
BRANCH_STATUS="ok"
NURSECONNECT_QA_STATUS="not-run"
QA_ALLOWED_PATHS=()
QA_FORBIDDEN_PATHS=()

source "$(dirname "$0")/verify-slice-support.sh"
source "$(dirname "$0")/verify-slice-subagents.sh"

usage() {
  cat <<'USAGE'
Usage: pnpm verify-slice -- [options]

Creates a NurseConnect diff-scoped reviewer plan for the current branch.

Options:
  --base <ref>             Base ref for diff classification (default: origin/main)
  --run-id <id>            Override run id
  --run-root <path>        Override output root
  --allow-main             Allow running on main/master
  --model-review-packet    Minimized design packet to send to model reviewers
  --model-reviewers        Comma list for model-review routes (default: sonnet46,gemini; escalate only when warranted)
  --model-review-debate    Write model debate synthesis receipts
  --model-review-dry-run   Write model review receipts without calling model CLIs
  --qa-allowed-path <path>  Optional allowed changed-file path prefix for NurseConnect QA scope audit; repeatable
  --qa-forbidden-path <p>   Optional forbidden changed-file path prefix for NurseConnect QA scope audit; repeatable
  --static                 Run static local gates
  --required-gates         Run required local release gates
  -h, --help               Show this help

Default behavior writes the reviewer plan and prompts only; no gates are run.
USAGE
}

fail() {
  printf '[verify-slice] FAIL: %s\n' "$1" >&2
  exit 1
}

iso_utc() {
  date -u +%Y-%m-%dT%H:%M:%SZ
}

redact_stream() {
  sed -E \
    -e 's/(better-auth\.session_token[[:space:]]*[:=][[:space:]]*)[^",[:space:]]+/\1<REDACTED>/g' \
    -e 's/(Authorization:[[:space:]]*Bearer[[:space:]]+)[A-Za-z0-9._-]+/\1<REDACTED>/g' \
    -e 's/([Ss]et-[Cc]ookie:[[:space:]]*[^=]+=)[^;[:space:]]+/\1<REDACTED>/g' \
    -e 's/([Cc]ookie:[[:space:]]*[^=]+=)[^;[:space:]]+/\1<REDACTED>/g' \
    -e 's/((access|refresh|session|id)_token[[:space:]]*[:=][[:space:]]*)[^",[:space:]]+/\1<REDACTED>/g' \
    -e 's/(OPS_ALERT_WEBHOOK_URL[[:space:]]*[:=][[:space:]]*)[^[:space:]]+/\1<REDACTED>/g' \
    -e 's/(DATABASE_URL[[:space:]]*[:=][[:space:]]*)[^[:space:]]+/\1<REDACTED>/g' \
    -e 's/(BETTER_AUTH_SECRET[[:space:]]*[:=][[:space:]]*)[^[:space:]]+/\1<REDACTED>/g' \
    -e 's/\bgh[pousr]_[A-Za-z0-9]{36,}\b/gh_<REDACTED>/g'
}

run_gate() {
  local label="$1"
  local command="$2"
  local log_file="$RUN_ROOT/evidence/gates/${label}.log"

  mkdir -p "$(dirname "$log_file")"
  printf '[verify-slice] running %s\n' "$label"

  set +e
  (
    set -o pipefail
    cd "$ROOT_DIR"
    bash -lc "$command" 2>&1 | redact_stream | tee "$log_file"
  )
  local status=$?
  set -e
  return "$status"
}

run_untracked_diff_check() {
  local label="git-diff-check-untracked"
  local log_file="$RUN_ROOT/evidence/gates/${label}.log"
  local git_index
  local temp_dir
  local status

  mkdir -p "$(dirname "$log_file")"
  printf '[verify-slice] running %s\n' "$label"

  if [[ ! -s "$UNTRACKED_FILES" ]]; then
    printf 'No untracked files to check.\n' | tee "$log_file"
    return 0
  fi

  temp_dir="$(mktemp -d)"
  git_index="$(git -C "$ROOT_DIR" rev-parse --git-path index)"
  if [[ -f "$git_index" ]]; then
    cp "$git_index" "$temp_dir/index"
  else
    GIT_INDEX_FILE="$temp_dir/index" git -C "$ROOT_DIR" read-tree HEAD
  fi

  set +e
  (
    set -o pipefail
    cd "$ROOT_DIR"
    while IFS= read -r file; do
      [[ -f "$file" ]] || continue
      GIT_INDEX_FILE="$temp_dir/index" git add -N -- "$file"
    done <"$UNTRACKED_FILES"
    GIT_INDEX_FILE="$temp_dir/index" git diff --check
  ) 2>&1 | redact_stream | tee "$log_file"
  status=${PIPESTATUS[0]}
  set -e
  rm -rf "$temp_dir"
  return "$status"
}

matches_changed_file() {
  local pattern="$1"
  rg -q "$pattern" "$CHANGED_FILES" >/dev/null 2>&1
}

all_changed_files_match() {
  local pattern="$1"
  if [[ ! -s "$CHANGED_FILES" ]]; then
    return 1
  fi
  while IFS= read -r file; do
    [[ -n "$file" ]] || continue
    if [[ ! "$file" =~ $pattern ]]; then
      return 1
    fi
  done <"$CHANGED_FILES"
  return 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --)
      shift
      ;;
    --base)
      [[ $# -ge 2 ]] || fail 'missing value for --base'
      BASE_REF="$2"
      shift 2
      ;;
    --run-id)
      [[ $# -ge 2 ]] || fail 'missing value for --run-id'
      RUN_ID="$2"
      shift 2
      ;;
    --run-root)
      [[ $# -ge 2 ]] || fail 'missing value for --run-root'
      RUN_ROOT="$2"
      shift 2
      ;;
    --allow-main)
      ALLOW_MAIN=1
      shift
      ;;
    --model-review-packet)
      [[ $# -ge 2 ]] || fail 'missing value for --model-review-packet'
      MODEL_REVIEW_PACKET="$2"
      shift 2
      ;;
    --model-reviewers)
      [[ $# -ge 2 ]] || fail 'missing value for --model-reviewers'
      MODEL_REVIEWERS="$2"
      shift 2
      ;;
    --model-review-dry-run)
      MODEL_REVIEW_DRY_RUN=1
      shift
      ;;
    --model-review-debate)
      MODEL_REVIEW_DEBATE=1
      shift
      ;;
    --qa-allowed-path)
      [[ $# -ge 2 ]] || fail 'missing value for --qa-allowed-path'
      QA_ALLOWED_PATHS+=("$2")
      shift 2
      ;;
    --qa-forbidden-path)
      [[ $# -ge 2 ]] || fail 'missing value for --qa-forbidden-path'
      QA_FORBIDDEN_PATHS+=("$2")
      shift 2
      ;;
    --static)
      RUN_STATIC=1
      shift
      ;;
    --required-gates)
      RUN_REQUIRED=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown argument: $1"
      ;;
  esac
done

command -v node >/dev/null 2>&1 || fail 'node is required'
command -v pnpm >/dev/null 2>&1 || fail 'pnpm is required'
node -e 'const major = Number(process.versions.node.split(".")[0]); if (!Number.isFinite(major) || major < 20) process.exit(1);' \
  || fail 'node >=20 is required'

if [[ -z "$RUN_ID" ]]; then
  RUN_ID="verify-slice-$(date -u +%Y%m%dT%H%M%SZ)-$(node -e 'process.stdout.write(require("node:crypto").randomBytes(3).toString("hex"))')"
fi

if [[ -z "$RUN_ROOT" ]]; then
  RUN_ROOT="$ROOT_DIR/tmp/multi-agent/verify-slice/$RUN_ID"
elif [[ "$RUN_ROOT" != /* ]]; then
  RUN_ROOT="$ROOT_DIR/$RUN_ROOT"
fi

mkdir -p "$RUN_ROOT/prompts" "$RUN_ROOT/evidence/gates"

branch="$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD)"
if [[ "$ALLOW_MAIN" -ne 1 && ( "$branch" == "main" || "$branch" == "master" ) ]]; then
  fail 'refusing to run slice verification on main/master; create or switch to a slice branch'
fi
if [[ "$branch" != codex/* ]]; then
  BRANCH_STATUS="warning: branch does not use codex/<slice-name> prefix"
  printf '[verify-slice] warning: branch does not use codex/<slice-name> prefix\n' >&2
fi

if ! git -C "$ROOT_DIR" fetch origin --prune >/dev/null 2>&1; then
  FETCH_STATUS="warning: failed to refresh origin; using local $BASE_REF"
  printf '[verify-slice] warning: failed to refresh origin; using local %s\n' "$BASE_REF" >&2
fi

if ! git -C "$ROOT_DIR" rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
  fail "base ref not found: $BASE_REF"
fi

BASE_COMMIT="$(git -C "$ROOT_DIR" merge-base HEAD "$BASE_REF")"
CHANGED_FILES="$RUN_ROOT/changed-files.txt"
COMMITTED_CHANGED_FILES="$RUN_ROOT/changed-files.committed.txt"
WORKTREE_CHANGED_FILES="$RUN_ROOT/changed-files.worktree.txt"
UNTRACKED_FILES="$RUN_ROOT/changed-files.untracked.txt"
DIFF_STAT="$RUN_ROOT/diff-stat.txt"

git -C "$ROOT_DIR" diff --name-only "$BASE_COMMIT"...HEAD | sort -u >"$COMMITTED_CHANGED_FILES"
{
  git -C "$ROOT_DIR" diff --name-only
  git -C "$ROOT_DIR" diff --name-only --cached
} | sed '/^$/d' | sort -u >"$WORKTREE_CHANGED_FILES"
git -C "$ROOT_DIR" ls-files --others --exclude-standard | sort -u >"$UNTRACKED_FILES"
cat "$COMMITTED_CHANGED_FILES" "$WORKTREE_CHANGED_FILES" "$UNTRACKED_FILES" | sed '/^$/d' | sort -u >"$CHANGED_FILES"

{
  echo "# Committed Diff Stat"
  git -C "$ROOT_DIR" diff --stat "$BASE_COMMIT"...HEAD
  echo
  echo "# Working Tree Diff Stat"
  git -C "$ROOT_DIR" diff --stat
  echo
  echo "# Staged Diff Stat"
  git -C "$ROOT_DIR" diff --cached --stat
  echo
  echo "# Untracked File Inventory"
  sed 's/^/- /' "$UNTRACKED_FILES"
} >"$DIFF_STAT"

changed_count="$(wc -l <"$CHANGED_FILES" | tr -d ' ')"
committed_changed_count="$(wc -l <"$COMMITTED_CHANGED_FILES" | tr -d ' ')"
worktree_changed_count="$(wc -l <"$WORKTREE_CHANGED_FILES" | tr -d ' ')"
untracked_count="$(wc -l <"$UNTRACKED_FILES" | tr -d ' ')"

ui_touched="no"
performance_touched="no"
contracts_touched="no"
ops_touched="no"
security_touched="no"
database_touched="no"
docs_only="no"

if matches_changed_file '(^apps/web/src/(app|components|dashboard|lib)/|^packages/ui/)'; then
  ui_touched="yes"
fi

if matches_changed_file '(^apps/web/src/(app/api|server)/|^packages/domain-(admin-ops|dispatch|request|nurse|payments|visit)/|^packages/database/|candidate-selection|ops-dashboard|queue|location|poll|monitor)'; then
  performance_touched="yes"
fi

if matches_changed_file '(^packages/contracts/|^packages/database/src/schema/|^packages/database/drizzle/|^apps/web/src/app/api/|^scripts/|^\.github/|package\.json$|pnpm-lock\.yaml$|turbo\.json$|\.env\.example$|config/)'; then
  contracts_touched="yes"
fi

if matches_changed_file '(^docs/runbooks/|^docs/superpowers/|^scripts/launch|^scripts/.*monitor|^scripts/.*readiness|^\.github/workflows/|^AGENTS\.md$|^\.codex/)'; then
  ops_touched="yes"
fi

if matches_changed_file '(^apps/web/src/(middleware\.ts|lib/auth|lib/proxy-logic\.ts|server/auth|app/api/)|^packages/database/|^packages/contracts/|auth|session|webhook|payment|payout|admin|PHI|phi|secret)'; then
  security_touched="yes"
fi

if matches_changed_file '(^packages/database/|^apps/web/src/server/.*\.db\.test\.ts|drizzle)'; then
  database_touched="yes"
fi

if all_changed_files_match '^(AGENTS\.md|README\.md|HANDOVER\.md|GEMINI\.md|IMPORTANT_RULES\.md|project_architecture\.md|contributing\.md|docs/.*|\.github/PULL_REQUEST_TEMPLATE\.md)$'; then
  docs_only="yes"
fi

run_nurseconnect_qa_evidence

reviewers=(security_reviewer architecture_reviewer qa_reviewer ops_reviewer)
if [[ "$performance_touched" == "yes" ]]; then
  reviewers+=(performance_reviewer)
fi
if [[ "$contracts_touched" == "yes" ]]; then
  reviewers+=(contracts_reviewer)
fi

write_manifest() {
  cat >"$RUN_ROOT/run-manifest.md" <<EOF
# Verify Slice Manifest

- run_id: \`$RUN_ID\`
- generated_utc: \`$(iso_utc)\`
- branch: \`$branch\`
- branch_status: \`$BRANCH_STATUS\`
- base_ref: \`$BASE_REF\`
- authoritative_base_commit: \`$BASE_COMMIT\`
- base_refresh_status: \`$FETCH_STATUS\`
- nurseconnect_qa_status: \`$NURSECONNECT_QA_STATUS\`
- model_review_status: \`$MODEL_REVIEW_STATUS\`
- model_review_completed: \`$MODEL_REVIEW_COMPLETED\`
- model_review_dry_run: \`$MODEL_REVIEW_DRY_RUN_ROUTES\`
- model_review_blocked: \`$MODEL_REVIEW_BLOCKED\`
- changed_file_count: \`$changed_count\`
- committed_changed_file_count: \`$committed_changed_count\`
- worktree_changed_file_count: \`$worktree_changed_count\`
- untracked_file_count: \`$untracked_count\`
- ui_touched: \`$ui_touched\`
- performance_touched: \`$performance_touched\`
- contracts_touched: \`$contracts_touched\`
- ops_touched: \`$ops_touched\`
- security_touched: \`$security_touched\`
- database_touched: \`$database_touched\`
- docs_only: \`$docs_only\`
- selected_reviewers: \`${reviewers[*]}\`
- reusable_reviewer_config_dir: \`$ROOT_DIR/config/reviewers\`
- reusable_reviewer_prompt_dir: \`$ROOT_DIR/prompts/reviewers\`

## Changed Files

See \`$CHANGED_FILES\`.

## Diff Stat

See \`$DIFF_STAT\`.

## NurseConnect QA Evidence

- Summary: \`$RUN_ROOT/evidence/nurseconnect-qa.md\`
- Raw JSON: \`$RUN_ROOT/evidence/nurseconnect-qa.json\`

## Model Review Evidence

- Access: \`$RUN_ROOT/reviews/model-review-access.md\`
- Summary: \`$RUN_ROOT/evidence/model-review.md\`
- Raw JSON: \`$RUN_ROOT/evidence/model-review.json\`
EOF
}

write_reviewer_prompt() {
  local reviewer="$1"
  local title="$2"
  local focus="$3"
  cat >"$RUN_ROOT/prompts/${reviewer}.md" <<EOF
# ${title}

Review the current NurseConnect slice before PR.

## Scope
- Base: \`$BASE_COMMIT...HEAD\` from \`$BASE_REF\`
- Changed-file inventory: \`$CHANGED_FILES\`
- Diff stat: \`$DIFF_STAT\`
- NurseConnect QA evidence: \`$RUN_ROOT/evidence/nurseconnect-qa.md\`
- Model review evidence: \`$RUN_ROOT/evidence/model-review.md\`
- Include committed branch changes plus staged, unstaged, and untracked local files from the changed-file inventory.
- Review only the slice diff and directly impacted execution paths.
- Do not request unrelated refactors or documentation churn.
- Preserve NurseConnect repo-scoped MCP policy in \`AGENTS.md\`.
- Do not suggest Interdomestik-specific MCP servers, ports, tenants, or workflows.
- Treat protected auth, routing, proxy, and API contract files as high-risk.
- Patient/nurse/referral partner/admin data boundaries must fail closed.

## Focus
$focus

## Output Contract
Return only actionable findings:
- \`MUST_FIX\`: correctness, security, PHI/privacy, auth boundary, broken contract, or failing gate risk.
- \`SHOULD_FIX\`: maintainability or coverage risk that should be handled before PR if practical.
- \`NICE_TO_HAVE\`: optional, non-blocking cleanup.

End with exactly one verdict:
- \`READY FOR PR\`
- \`READY FOR PR AFTER MUST-FIX ITEMS\`
- \`NOT READY FOR PR\`

If there are no material findings, say that plainly and list residual test risk.
EOF
}

summarize_model_review_evidence
write_manifest
write_reviewer_prompt "security_reviewer" "Security Reviewer" "Find auth/session, role, admin API, patient/nurse/referral partner boundary, PHI/privacy, webhook, secret, and payment/payout regressions introduced by this slice."
write_reviewer_prompt "architecture_reviewer" "Architecture Reviewer" "Find package-boundary drift, apps/web leakage, domain ownership mistakes, route/access-control bypasses, overbroad refactors, and scope creep introduced by this slice."
write_reviewer_prompt "qa_reviewer" "QA Reviewer" "Find missing or weak unit/API/E2E coverage, launch rehearsal impact, broken deterministic gates, regression paths, and test flakiness risk introduced by this slice."
write_reviewer_prompt "ops_reviewer" "Ops Reviewer" "Find launch runbook, monitor, alerting, Notion/program sync, branch lifecycle, release evidence, and operator workflow gaps introduced by this slice."
write_reviewer_prompt "performance_reviewer" "Performance Reviewer" "Find query, dispatch, queue, polling, hot path, unbounded work, cache, rendering, and bundle-cost regressions introduced by this slice."
write_reviewer_prompt "contracts_reviewer" "Contracts Reviewer" "Find API, contract schema, database migration, script, workflow, environment, and package boundary drift introduced by this slice."
write_orchestration_prompt
write_subagent_handoff
write_reviewer_plan

if [[ -n "$MODEL_REVIEW_PACKET" ]]; then
  if [[ "$MODEL_REVIEW_DRY_RUN" != "1" ]]; then
    run_gate "model-review-preflight" "pnpm model-review -- --preflight --run-root \"$RUN_ROOT\" --reviewers \"$MODEL_REVIEWERS\""
    run_gate "model-review-access-check" "pnpm model-review -- --access-check --run-root \"$RUN_ROOT\" --reviewers \"$MODEL_REVIEWERS\""
  fi
  model_review_cmd="pnpm model-review -- --packet \"$MODEL_REVIEW_PACKET\" --run-root \"$RUN_ROOT\" --reviewers \"$MODEL_REVIEWERS\""
  [[ "$MODEL_REVIEW_DRY_RUN" -ne 1 ]] || model_review_cmd="$model_review_cmd --dry-run"
  [[ "$MODEL_REVIEW_DEBATE" -ne 1 ]] || model_review_cmd="$model_review_cmd --debate"
  run_gate "model-review" "$model_review_cmd"
  summarize_model_review_evidence
  write_manifest
  write_reviewer_plan
fi

if [[ "$RUN_STATIC" -eq 1 ]]; then
  run_gate "mcp-preflight" "pnpm mcp:preflight"
  run_gate "env-check" "pnpm env:check"
  run_gate "repo-hygiene" "pnpm repo:hygiene"
  run_gate "modularity-guard" "pnpm modularity:guard -- --base \"$BASE_COMMIT\""
  run_gate "git-diff-check-committed" "git diff --check $BASE_COMMIT...HEAD"
  run_gate "git-diff-check-staged" "git diff --cached --check"
  run_gate "git-diff-check-worktree" "git diff --check"
  run_untracked_diff_check
  run_gate "sentinel" "bash scripts/multi-agent/sentinel-agent.sh --run-root \"$RUN_ROOT\" --base \"$BASE_REF\""
  sentry_flags="--strict"
  [[ "${SENTRY_ADVISORY_MODE:-strict}" == "advisory" ]] && sentry_flags=""
  run_gate "sentry-advisory" "node scripts/multi-agent/sentry-advisory.mjs --run-root \"$RUN_ROOT\" $sentry_flags"
  run_gate "slice-evidence" "pnpm slice:evidence -- --run-root \"$RUN_ROOT\""; run_gate "ent-gates-static" "node scripts/ent-gates/check.mjs --run-root \"$RUN_ROOT\" --base \"$BASE_COMMIT\" --policy-base \"$BASE_REF\""
  if [[ "$docs_only" == "yes" ]]; then
    printf '[verify-slice] docs-only static path: skipping type-check, lint, web build, sonar advisory, and launch readiness\n'
  else
    run_gate "sonar-agent" "bash scripts/multi-agent/sonar-agent.sh --run-root \"$RUN_ROOT\""
    run_gate "type-check" "pnpm -w type-check"
    run_gate "lint" "pnpm lint"
    run_gate "web-build" "pnpm --filter web build"
    run_gate "launch-readiness" "pnpm launch:readiness"
  fi
fi

if [[ "$RUN_REQUIRED" -eq 1 ]]; then run_gate "ent-gates-required" "node scripts/ent-gates/check.mjs --run-root \"$RUN_ROOT\" --base \"$BASE_COMMIT\" --policy-base \"$BASE_REF\""
  if [[ "$docs_only" == "yes" ]]; then
    run_gate "required-docs-mcp-preflight" "pnpm mcp:preflight"
    run_gate "required-docs-env-check" "pnpm env:check"
    run_gate "required-docs-repo-hygiene" "pnpm repo:hygiene"
    run_gate "required-docs-diff-check" "git diff --check $BASE_COMMIT...HEAD && git diff --cached --check && git diff --check"
  else
    run_gate "gate-release" "pnpm gate:release"
  fi
fi

printf '[verify-slice] PASS\n'
printf '[verify-slice] run_root=%s\n' "$RUN_ROOT"
printf '[verify-slice] selected_reviewers=%s\n' "${reviewers[*]}"
printf '[verify-slice] follow_up_static=pnpm verify-slice -- --run-root %q --static\n' "$RUN_ROOT"
printf '[verify-slice] follow_up_required=pnpm verify-slice -- --run-root %q --required-gates\n' "$RUN_ROOT"
