#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
# shellcheck disable=SC1090
source "$repo_root/scripts/lib/test-db-env.sh"

cd "$repo_root"
load_local_env_defaults
enforce_test_database_url

pnpm launch:rehearsal
pnpm db:from-clean
pnpm --filter @nurseconnect/contracts build
CI=1 pnpm --filter web test:e2e:m7-browser
