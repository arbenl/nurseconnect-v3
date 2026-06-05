write_subagent_handoff() {
  SELECTED_REVIEWERS="${reviewers[*]}" BASE_COMMIT="$BASE_COMMIT" CHANGED_FILES="$CHANGED_FILES" RUN_ROOT="$RUN_ROOT" \
    node scripts/multi-agent/subagent-handoff.mjs
}
