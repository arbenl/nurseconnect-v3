#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUN_ROOT="${1:-}"
if [[ "$RUN_ROOT" == "--" ]]; then
  shift
  RUN_ROOT="${1:-}"
fi
if [[ "$RUN_ROOT" == "--run-root" ]]; then
  RUN_ROOT="${2:-}"
fi
[[ -n "$RUN_ROOT" ]] || RUN_ROOT="$ROOT_DIR/tmp/multi-agent/sonar-agent"
[[ "$RUN_ROOT" = /* ]] || RUN_ROOT="$ROOT_DIR/$RUN_ROOT"
EVIDENCE_DIR="$RUN_ROOT/evidence/sonar"
mkdir -p "$EVIDENCE_DIR"

missing=()
for name in SONAR_TOKEN SONAR_HOST_URL SONAR_PROJECT_KEY; do
  [[ -n "${!name:-}" ]] || missing+=("$name")
done

if [[ "${SONAR_HOST_URL:-}" == *"sonarcloud.io"* && -z "${SONAR_ORGANIZATION:-}" ]]; then
  missing+=("SONAR_ORGANIZATION")
fi

if (( ${#missing[@]} > 0 )); then
  {
    echo "# Sonar Agent Summary"
    echo
    echo "- status: \`MISSING_CONFIG\`"
    echo "- missing: \`${missing[*]}\`"
    echo "- note: PR Sonar Quality Gate remains enforced by .github/workflows/ci.yml when configured."
  } >"$EVIDENCE_DIR/sonar-summary.md"
  echo "SONAR_AGENT_STATUS: MISSING_CONFIG"
  exit 0
fi

SONAR_ENFORCEMENT="${SONAR_ENFORCEMENT:-warn}" \
SONAR_RUN_COVERAGE="${SONAR_RUN_COVERAGE:-false}" \
EVIDENCE_DIR="$EVIDENCE_DIR" \
bash "$ROOT_DIR/scripts/sonar-gate.sh"
