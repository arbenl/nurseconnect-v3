#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export MCP_REPO_ROOT="$repo_root"

exec node "$repo_root/scripts/mcp/nurseconnect-qa-server.mjs"
