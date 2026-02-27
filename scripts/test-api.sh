#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
# shellcheck disable=SC1090
source "$repo_root/scripts/lib/test-db-env.sh"

cd "$repo_root"
load_local_env_defaults
enforce_test_database_url

pnpm db:from-clean
pnpm --filter @nurseconnect/contracts build
pnpm --filter web test:api
