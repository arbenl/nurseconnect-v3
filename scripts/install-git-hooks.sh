#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$REPO_ROOT" ]]; then
  echo "[hooks-install] Not in a git repository."
  exit 1
fi

cd "$REPO_ROOT"

if [[ ! -d ".githooks" ]]; then
  echo "[hooks-install] Missing .githooks directory."
  exit 1
fi

git config core.hooksPath .githooks
chmod +x .githooks/pre-commit .githooks/post-commit .githooks/pre-push

echo "[hooks-install] Installed repo hooks via core.hooksPath=.githooks"
