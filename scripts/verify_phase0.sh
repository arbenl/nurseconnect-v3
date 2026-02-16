#!/bin/bash
set -euo pipefail

mkdir -p tmp/verify

echo "== tool versions ==" | tee tmp/verify/00-versions.txt
node -v 2>&1 | tee -a tmp/verify/00-versions.txt
pnpm -v 2>&1 | tee -a tmp/verify/00-versions.txt

echo "== install ==" | tee tmp/verify/01-install.txt
pnpm install --frozen-lockfile 2>&1 | tee -a tmp/verify/01-install.txt

echo "== type-check ==" | tee tmp/verify/02-typecheck.txt
pnpm type-check 2>&1 | tee -a tmp/verify/02-typecheck.txt

echo "== e2e smoke ==" | tee tmp/verify/03-e2e-smoke.txt
pnpm web:test:emu 2>&1 | tee -a tmp/verify/03-e2e-smoke.txt

echo "✅ Phase 0 verified"
