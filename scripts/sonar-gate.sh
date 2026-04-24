#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RUN_ID="${GITHUB_RUN_ID:-local-$(date +%Y%m%d%H%M%S)}"
EVIDENCE_DIR="${EVIDENCE_DIR:-tmp/sonar-evidence/${RUN_ID}}"
LOG_DIR="${EVIDENCE_DIR}/logs"
NOTES_DIR="${EVIDENCE_DIR}/notes"
SCAN_LOG="${LOG_DIR}/sonar-scan.log"
QG_JSON="${LOG_DIR}/sonar-qualitygate.json"
SUMMARY_MD="${NOTES_DIR}/sonar-summary.md"

mkdir -p "$LOG_DIR" "$NOTES_DIR"

required_vars=(SONAR_TOKEN SONAR_HOST_URL SONAR_PROJECT_KEY)
missing=()
for name in "${required_vars[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    missing+=("$name")
  fi
done

if (( ${#missing[@]} > 0 )); then
  echo "Missing required Sonar configuration: ${missing[*]}" | tee "$SUMMARY_MD"
  exit 2
fi

SONAR_ENFORCEMENT="${SONAR_ENFORCEMENT:-enforce}"
SONAR_RUN_COVERAGE="${SONAR_RUN_COVERAGE:-true}"
SONAR_PULLREQUEST_KEY="${SONAR_PULLREQUEST_KEY:-}"

if [[ -z "${SONAR_PULLREQUEST_KEY}" && -n "${GITHUB_EVENT_PATH:-}" && -f "${GITHUB_EVENT_PATH}" ]]; then
  SONAR_PULLREQUEST_KEY="$(
    node -e "const fs=require('node:fs');const event=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(String(event?.pull_request?.number || '').trim());" "${GITHUB_EVENT_PATH}" 2>/dev/null || true
  )"
fi

if [[ "$SONAR_RUN_COVERAGE" == "true" ]]; then
  echo "Running coverage before Sonar scan..."
  pnpm test:coverage
else
  echo "Skipping coverage run (SONAR_RUN_COVERAGE=${SONAR_RUN_COVERAGE})"
fi

set +e
pnpm sonar:scan 2>&1 | tee "$SCAN_LOG"
scan_status=${PIPESTATUS[0]}
set -e

if (( scan_status != 0 )); then
  {
    echo "# Sonar Summary"
    echo
    echo "- scan_status: FAIL (${scan_status})"
    echo "- enforcement: ${SONAR_ENFORCEMENT}"
    echo "- host: ${SONAR_HOST_URL}"
    echo "- project: ${SONAR_PROJECT_KEY}"
  } >"$SUMMARY_MD"

  if [[ "$SONAR_ENFORCEMENT" == "warn" ]]; then
    echo "::warning::Sonar scan failed (status ${scan_status}) in warn mode"
    exit 0
  fi

  exit "$scan_status"
fi

QG_URL="${SONAR_HOST_URL%/}/api/qualitygates/project_status?projectKey=${SONAR_PROJECT_KEY}"
DASHBOARD_URL="${SONAR_HOST_URL%/}/dashboard?id=${SONAR_PROJECT_KEY}"

if [[ -n "${SONAR_PULLREQUEST_KEY}" ]]; then
  QG_URL="${QG_URL}&pullRequest=${SONAR_PULLREQUEST_KEY}"
  DASHBOARD_URL="${DASHBOARD_URL}&pullRequest=${SONAR_PULLREQUEST_KEY}"
fi

set +e
node - "$QG_URL" "$QG_JSON" <<'NODE'
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const { URL } = require("node:url");

const [, , qgUrl, outPath] = process.argv;
const token = process.env.SONAR_TOKEN || "";
const url = new URL(qgUrl);
const client = url.protocol === "https:" ? https : http;
const authorization = `Basic ${Buffer.from(`${token}:`).toString("base64")}`;

const req = client.request(
  url,
  {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: authorization,
    },
  },
  res => {
    let body = "";
    res.setEncoding("utf8");
    res.on("data", chunk => {
      body += chunk;
    });
    res.on("end", () => {
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
        fs.writeFileSync(outPath, body);
        process.exit(0);
        return;
      }

      process.stderr.write(`Sonar quality gate HTTP ${res.statusCode ?? "unknown"}\n`);
      process.exit(1);
    });
  }
);

req.on("error", error => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});

req.end();
NODE
qg_fetch_status=$?
set -e

if (( qg_fetch_status != 0 )); then
  {
    echo "# Sonar Summary"
    echo
    echo "- scan_status: PASS"
    echo "- quality_gate: UNKNOWN (failed to query API)"
    echo "- enforcement: ${SONAR_ENFORCEMENT}"
    echo "- host: ${SONAR_HOST_URL}"
    echo "- project: ${SONAR_PROJECT_KEY}"
  } >"$SUMMARY_MD"

  if [[ "$SONAR_ENFORCEMENT" == "warn" ]]; then
    echo "::warning::Could not fetch Sonar quality gate in warn mode"
    exit 0
  fi

  echo "Failed to fetch Sonar quality gate from ${QG_URL}"
  exit 3
fi

qg_status="$(node -e "const fs=require('node:fs');const d=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write((d?.projectStatus?.status)||'UNKNOWN');" "$QG_JSON")"

{
  echo "# Sonar Summary"
  echo
  echo "- scan_status: PASS"
  echo "- quality_gate: ${qg_status}"
  echo "- enforcement: ${SONAR_ENFORCEMENT}"
  echo "- host: ${SONAR_HOST_URL}"
  echo "- project: ${SONAR_PROJECT_KEY}"
  if [[ -n "${SONAR_PULLREQUEST_KEY}" ]]; then
    echo "- pull_request: ${SONAR_PULLREQUEST_KEY}"
  fi
  echo "- dashboard: ${DASHBOARD_URL}"
} >"$SUMMARY_MD"

if [[ "$qg_status" != "OK" ]]; then
  if [[ "$SONAR_ENFORCEMENT" == "warn" ]]; then
    echo "::warning::Sonar quality gate is ${qg_status} (warn mode)"
    exit 0
  fi

  echo "Sonar quality gate is ${qg_status}"
  exit 4
fi

echo "Sonar quality gate passed"
