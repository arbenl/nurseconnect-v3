#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUN_ROOT=""
BASE_REF="origin/main"

usage() {
  echo "Usage: bash scripts/multi-agent/sentinel-agent.sh --run-root <path> [--base <ref>]"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --)
      shift
      ;;
    --run-root)
      RUN_ROOT="$2"
      shift 2
      ;;
    --base)
      BASE_REF="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[sentinel] unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

[[ -n "$RUN_ROOT" ]] || { echo "[sentinel] --run-root is required" >&2; exit 1; }
[[ "$RUN_ROOT" = /* ]] || RUN_ROOT="$ROOT_DIR/$RUN_ROOT"
EVIDENCE_DIR="$RUN_ROOT/evidence/sentinel"
mkdir -p "$EVIDENCE_DIR"

git -C "$ROOT_DIR" fetch origin --prune >/dev/null 2>&1 || true
BASE_COMMIT="$(git -C "$ROOT_DIR" merge-base HEAD "$BASE_REF" 2>/dev/null || git -C "$ROOT_DIR" rev-parse HEAD)"
CHANGED="$EVIDENCE_DIR/changed-files.txt"
git -C "$ROOT_DIR" diff --name-only "$BASE_COMMIT"...HEAD >"$CHANGED"
git -C "$ROOT_DIR" ls-files --others --exclude-standard >>"$CHANGED"

SENSITIVE_PATHS="$EVIDENCE_DIR/sensitive-paths.txt"
SECRET_HITS="$EVIDENCE_DIR/secret-hits.txt"
PHI_HITS="$EVIDENCE_DIR/phi-hits.txt"
SECRET_PATTERN='(-----BEGIN [A-Z ]*PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{36,}|AKIA[0-9A-Z]{16}|sk_live_[A-Za-z0-9]{16,}|SUPABASE_SERVICE_ROLE_KEY[[:space:]]*[:=])'
PHI_PATTERN='((MRN|medical[[:space:]]*record[[:space:]]*number)[[:space:]]*[:=][[:space:]]*[A-Za-z0-9-]{6,}|(DOB|date[[:space:]]*of[[:space:]]*birth)[[:space:]]*[:=][[:space:]]*[0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}|[0-9]{3}-[0-9]{2}-[0-9]{4})'

rg -n '(^apps/web/src/(middleware\.ts|lib/auth|server/auth|app/api)/|^packages/database/|^packages/contracts/|auth|session|secret|PHI|phi)' "$CHANGED" >"$SENSITIVE_PATHS" || true
: >"$SECRET_HITS"
: >"$PHI_HITS"

while IFS= read -r file; do
  [[ -n "$file" && -f "$ROOT_DIR/$file" ]] || continue
  rg -n "$SECRET_PATTERN" "$ROOT_DIR/$file" >>"$SECRET_HITS" || true
  rg -n "$PHI_PATTERN" "$ROOT_DIR/$file" >>"$PHI_HITS" || true
done <"$CHANGED"

secret_count="$(wc -l <"$SECRET_HITS" | tr -d ' ')"
phi_count="$(wc -l <"$PHI_HITS" | tr -d ' ')"
status="PASS"
[[ "$secret_count" = "0" && "$phi_count" = "0" ]] || status="FAIL"

{
  echo "# Sentinel Summary"
  echo
  echo "- status: \`$status\`"
  echo "- base_commit: \`$BASE_COMMIT\`"
  echo "- secret_hits: \`$secret_count\`"
  echo "- phi_hits: \`$phi_count\`"
  echo "- sensitive_paths_evidence: \`$SENSITIVE_PATHS\`"
} >"$EVIDENCE_DIR/sentinel-summary.md"

echo "SENTINEL_STATUS: $status"
[[ "$status" = "PASS" ]] || exit 1
