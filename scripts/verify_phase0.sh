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

echo "== tests ==" | tee tmp/verify/03-tests.txt
pnpm test:ci 2>&1 | tee -a tmp/verify/03-tests.txt

echo "== web build ==" | tee tmp/verify/04-web-build.txt
pnpm --filter web build 2>&1 | tee -a tmp/verify/04-web-build.txt

echo "✅ Phase 0 verified"
