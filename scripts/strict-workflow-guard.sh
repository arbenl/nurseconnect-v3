#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-pre-push}"

log() {
  printf '[strict-guard] %s\n' "$*"
}

require_clean_tree() {
  local phase="$1"
  local status
  status="$(git status --porcelain)"
  if [[ -n "$status" ]]; then
    log "Working tree must be clean during ${phase}."
    git status --short
    exit 1
  fi
}

require_no_unstaged_or_untracked() {
  local unstaged
  local untracked
  unstaged="$(git diff --name-only)"
  untracked="$(git ls-files --others --exclude-standard)"
  if [[ -n "$unstaged" || -n "$untracked" ]]; then
    log "Commit blocked: stage all tracked files and remove untracked files first."
    if [[ -n "$unstaged" ]]; then
      printf '[strict-guard] Unstaged files:\n%s\n' "$unstaged"
    fi
    if [[ -n "$untracked" ]]; then
      printf '[strict-guard] Untracked files:\n%s\n' "$untracked"
    fi
    exit 1
  fi
}

resolve_pr_number() {
  local pr_number="${PR_NUMBER:-}"
  if [[ -n "$pr_number" ]]; then
    printf '%s' "$pr_number"
    return 0
  fi

  local branch
  branch="$(git rev-parse --abbrev-ref HEAD)"
  if [[ "$branch" == "HEAD" ]]; then
    return 1
  fi

  pr_number="$(gh pr view "$branch" --json number --jq '.number' 2>/dev/null || true)"
  if [[ -z "$pr_number" || "$pr_number" == "null" ]]; then
    return 1
  fi

  printf '%s' "$pr_number"
}

run_pr_comment_gate() {
  if ! command -v gh >/dev/null 2>&1; then
    log "Skipping PR comment gate: gh CLI not found."
    return 0
  fi

  if ! gh auth status >/dev/null 2>&1; then
    log "Skipping PR comment gate: gh is not authenticated."
    return 0
  fi

  local pr_number
  if ! pr_number="$(resolve_pr_number)"; then
    log "Skipping PR comment gate: no PR detected for current branch."
    return 0
  fi

  log "Checking Copilot/Sentry review threads for PR #${pr_number}."
  PR_NUMBER="$pr_number" node scripts/check-pr-bot-comments.mjs
}

main() {
  local repo_root
  repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  if [[ -z "$repo_root" ]]; then
    log "Not in a git repository."
    exit 1
  fi
  cd "$repo_root"

  case "$MODE" in
    pre-commit)
      require_no_unstaged_or_untracked
      ;;
    post-commit)
      require_clean_tree "post-commit"
      ;;
    pre-push)
      require_clean_tree "pre-push (before gate)"
      log "Running strict release gate (pnpm gate:release)."
      pnpm gate:release
      require_clean_tree "pre-push (after gate)"
      run_pr_comment_gate
      ;;
    *)
      log "Unknown mode: ${MODE}"
      exit 1
      ;;
  esac
}

main "$@"
