run_nurseconnect_qa_evidence() {
  local qa_allowed_paths=""
  local qa_forbidden_paths=""
  if [[ "${#QA_ALLOWED_PATHS[@]}" -gt 0 ]]; then
    qa_allowed_paths="$(printf '%s\n' "${QA_ALLOWED_PATHS[@]}")"
  fi
  if [[ "${#QA_FORBIDDEN_PATHS[@]}" -gt 0 ]]; then
    qa_forbidden_paths="$(printf '%s\n' "${QA_FORBIDDEN_PATHS[@]}")"
  fi

  printf '[verify-slice] collecting nurseconnect_qa evidence\n'
  set +e
  RUN_ROOT="$RUN_ROOT" BASE_REF="$BASE_REF" QA_ALLOWED_PATHS="$qa_allowed_paths" QA_FORBIDDEN_PATHS="$qa_forbidden_paths" \
    node scripts/multi-agent/nurseconnect-qa-evidence.mjs
  local status=$?
  set -e
  case "$status" in
    0) NURSECONNECT_QA_STATUS="success" ;;
    1) NURSECONNECT_QA_STATUS="error" ;;
    *) NURSECONNECT_QA_STATUS="blocked" ;;
  esac
}

summarize_model_review_evidence() {
  local status_file="$RUN_ROOT/evidence/model-review.status"
  set +e
  RUN_ROOT="$RUN_ROOT" node scripts/multi-agent/model-review-summary.mjs >"$status_file"
  local status=$?
  set -e
  if [[ "$status" -ne 0 ]]; then
    MODEL_REVIEW_STATUS="error"
    MODEL_REVIEW_COMPLETED="none"
    MODEL_REVIEW_DRY_RUN_ROUTES="none"
    MODEL_REVIEW_BLOCKED="summary failed"
    return
  fi
  {
    IFS= read -r MODEL_REVIEW_STATUS || MODEL_REVIEW_STATUS="error"
    IFS= read -r MODEL_REVIEW_COMPLETED || MODEL_REVIEW_COMPLETED="none"
    IFS= read -r MODEL_REVIEW_DRY_RUN_ROUTES || MODEL_REVIEW_DRY_RUN_ROUTES="none"
    IFS= read -r MODEL_REVIEW_BLOCKED || MODEL_REVIEW_BLOCKED="none"
  } <"$status_file"
}

write_reviewer_plan() {
  {
  echo "# Verify Slice Reviewer Plan"
  echo
  echo "- run_root: \`$RUN_ROOT\`"
  echo "- branch_status: \`$BRANCH_STATUS\`"
  echo "- base_refresh_status: \`$FETCH_STATUS\`"
  echo "- nurseconnect_qa_status: \`$NURSECONNECT_QA_STATUS\`"
  echo "- model_review_status: \`$MODEL_REVIEW_STATUS\`"
  echo "- model_review_completed: \`$MODEL_REVIEW_COMPLETED\`"
  echo "- model_review_dry_run: \`$MODEL_REVIEW_DRY_RUN_ROUTES\`"
  echo "- model_review_blocked: \`$MODEL_REVIEW_BLOCKED\`"
  echo "- selected_reviewers: \`${reviewers[*]}\`"
  echo "- changed_file_count: \`$changed_count\`"
  echo "- committed_changed_file_count: \`$committed_changed_count\`"
  echo "- worktree_changed_file_count: \`$worktree_changed_count\`"
  echo "- untracked_file_count: \`$untracked_count\`"
  echo
  echo "## Recommended Dispatch"
  echo
  for reviewer in "${reviewers[@]}"; do echo "- \`$reviewer\`: \`$RUN_ROOT/prompts/$reviewer.md\`"; done
  echo
  echo "## Reusable Reviewer Assets"
  echo
  echo "- Config: \`$ROOT_DIR/config/reviewers\`"
  echo "- Prompts: \`$ROOT_DIR/prompts/reviewers\`"
  echo
  echo "## Deterministic Gate Options"
  echo
  echo "- Static: \`pnpm verify-slice -- --run-root \"$RUN_ROOT\" --static\`"
  echo "- Required local gates: \`pnpm verify-slice -- --run-root \"$RUN_ROOT\" --required-gates\`"
  echo "- Model route preflight: \`pnpm model-review -- --preflight --run-root \"$RUN_ROOT\" --reviewers \"$MODEL_REVIEWERS\"\`"
  echo "- Model access check: \`pnpm model-review -- --access-check --run-root \"$RUN_ROOT\" --reviewers \"$MODEL_REVIEWERS\"\`"
  echo "- Model review: \`pnpm model-review -- --packet <design-packet.md> --run-root \"$RUN_ROOT\" --reviewers \"$MODEL_REVIEWERS\" --debate\`"
  echo "- Subagent results: \`pnpm subagent-results -- --run-root \"$RUN_ROOT\" --must-fix-disposition \"none\"\`"
  echo "- Evidence check: \`pnpm slice:evidence -- --run-root \"$RUN_ROOT\"\`"
  echo "- Tier 3 / AI external-route evidence check: \`pnpm slice:evidence -- --run-root \"$RUN_ROOT\" --require-reviewers \"$MODEL_REVIEWERS\" --require-model-preflight --require-model-access --require-model-review --require-subagent-results --require-debate --must-fix-disposition \"none\"\`"
  echo "- NurseConnect QA evidence: \`$RUN_ROOT/evidence/nurseconnect-qa.md\`"
  echo "- Model access evidence: \`$RUN_ROOT/reviews/model-review-access.md\`"
  echo "- Model review evidence: \`$RUN_ROOT/evidence/model-review.md\`"
  echo "- Subagent reviewer handoff: \`$RUN_ROOT/reviews/subagent-handoff.md\`"
  echo "- Subagent reviewer results: \`$RUN_ROOT/reviews/subagent-results.md\`"
  [[ "$docs_only" != "yes" ]] || echo "- Docs-only required gates: required-gates uses docs/static hygiene checks instead of \`pnpm gate:release\`."
  } >"$RUN_ROOT/reviewer-plan.md"
}

write_orchestration_prompt() {
  cat >"$RUN_ROOT/prompts/orchestrator.md" <<EOF
# Pre-PR Reviewer Pool Orchestrator

Use this run root: \`$RUN_ROOT\`

Spawn the selected reviewers in parallel:
$(printf -- '- `%s`\n' "${reviewers[@]}")

Rules:
- reviewers are read-only and must not modify product code
- reviewers read only \`$BASE_COMMIT...HEAD\` and directly impacted paths
- reviewers must include staged, unstaged, and untracked local files listed in \`$CHANGED_FILES\`
- collect MUST_FIX / SHOULD_FIX / NICE_TO_HAVE findings
- deduplicate overlapping findings
- produce one final verdict: \`READY FOR PR\`, \`READY FOR PR AFTER MUST-FIX ITEMS\`, or \`NOT READY FOR PR\`
- any MUST_FIX finding must be fixed or explicitly rejected with technical reasoning before PR

Conditional signals:
- ui_touched: \`$ui_touched\`
- performance_touched: \`$performance_touched\`
- contracts_touched: \`$contracts_touched\`
- ops_touched: \`$ops_touched\`
- security_touched: \`$security_touched\`
- database_touched: \`$database_touched\`
- docs_only: \`$docs_only\`
EOF
}
