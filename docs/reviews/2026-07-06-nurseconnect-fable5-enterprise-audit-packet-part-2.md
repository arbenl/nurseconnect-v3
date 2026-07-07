## Existing Callable Path

NurseConnect already has a model-review callable path:

- script: `scripts/multi-agent/model-review.mjs`
- route registry: `scripts/multi-agent/lib/model-review-routes.mjs`
- prompt/sensitive scan: `scripts/multi-agent/lib/model-review-prompts.mjs`
- package command: `pnpm model-review`

The `claude48` route invokes:

```text
claude -p <prompt> --model <model> --tools "" --no-session-persistence
```

The model id is controlled by `CLAUDE_48_REVIEW_MODEL`. Prior repo evidence
shows Fable 5 was used successfully through this route for `NC-E2-04` by setting:

```bash
CLAUDE_48_REVIEW_MODEL=claude-fable-5
```

Recommended invocation for this audit:

```bash
RUN_ROOT=tmp/multi-agent/fable5-enterprise-audit/2026-07-06
PACKET_BUNDLE="$RUN_ROOT/nurseconnect-fable5-enterprise-audit-packet.bundle.md"
mkdir -p "$RUN_ROOT"
for suffix in "" -part-1 -part-2 -part-3 -part-4 -part-5 -part-6; do
  sed -n '1,220p' "docs/reviews/2026-07-06-nurseconnect-fable5-enterprise-audit-packet${suffix}.md"
done > "$PACKET_BUNDLE"
CLAUDE_48_REVIEW_MODEL=claude-fable-5 \
MODEL_REVIEW_TIMEOUT_MS=300000 \
pnpm model-review -- --preflight --run-root "$RUN_ROOT" --reviewers claude48

CLAUDE_48_REVIEW_MODEL=claude-fable-5 \
MODEL_REVIEW_TIMEOUT_MS=300000 \
pnpm model-review -- --access-check --run-root "$RUN_ROOT" --reviewers claude48

CLAUDE_48_REVIEW_MODEL=claude-fable-5 \
MODEL_REVIEW_TIMEOUT_MS=300000 \
pnpm model-review -- \
  --packet "$PACKET_BUNDLE" \
  --run-root "$RUN_ROOT" \
  --reviewers claude48 \
  --debate
```

Expected evidence paths:

- `$RUN_ROOT/reviews/model-review-preflight.md`
- `$RUN_ROOT/reviews/model-review-access.md`
- `$RUN_ROOT/reviews/claude48.md`
- `$RUN_ROOT/reviews/claude48.json`
- `$RUN_ROOT/reviews/debate.md`
- `$RUN_ROOT/reviews/model-review-manifest.json`

Durable evidence rule: `tmp/multi-agent/...` run roots are working evidence,
not durable adoption evidence. If any Fable 5 response is used downstream, copy
the sanitized receipt, manifest, debate, schema-validation output, and any
redaction-signoff file into a dated `docs/reviews/nc-ent-evidence-*.advisory/`
bundle before citing it from an advisory response. Do not wait until an adoption
commit to preserve evidence.

Current limitation: `pnpm model-review` records text receipts and debate
synthesis; it does not enforce a structured audit schema. Fable 5 should still
return the schema below so the response can be copied into an audit response,
transformation plan, `NC-ENT-*` register, week-1 packet, and reviewer intake.

Provenance note: `claude48` is the route name, not the model identity. Evidence
consumers must read `reviews/model-review-manifest.json` and each receipt's
`model` field to verify the resolved model id is `claude-fable-5`. Any
downstream response must cite the manifest path and resolved model id, not rely
on the filename `claude48.md` alone.

## Privacy Boundary

Do not send any of the following to Fable 5:

- PHI, patient details, care summaries, addresses, coordinates, DOB, MRN, or
  clinical notes.
- Secrets, credentials, tokens, cookies, provider console URLs, database URLs,
  payment identifiers, raw logs, raw production exports, screenshots with PHI,
  or production account identifiers.
- Real production rows or identifiers for patients, nurses, facilities, payment
  records, sessions, or organizations.

Allowed input is sanitized repository evidence only: docs, plans, ADRs,
runbooks, schema names, package names, command names, sanitized test/evidence
paths, and synthetic examples. If Fable 5 needs more evidence, it must request
sanitized file paths or redacted excerpts, not raw data.

Because the route disables model tools (`--tools ""`), evidence follow-up is a
human/Codex relay process. The relay owner must provide only redacted excerpts
in a new packet or review note, record the source path and redaction rationale,
record explicit human redaction sign-off for each excerpt, and rerun the
sensitive scan before sending the follow-up. Pattern scans are a backstop only;
they do not prove absence of PHI in names, free text, clinical narrative, or
care details.

## Input Context Bundle Shape

The callable payload should be this packet plus a compact context bundle:

```json
{
  "auditId": "NC-ENT-AUDIT-2026-07-06",
  "packetVersion": "2026-07-06.2",
  "schemaVersion": "nc-ent-fable5-output-v1",
  "project": "nurseconnect-v3",
  "artifactType": "target_state_enterprise_audit",
  "authorityBoundary": {
    "fableOutput": "advisory_only",
    "repoAuthority": [
      "docs/plans/current-program.md",
      "docs/plans/current-tracker.md",
      "docs/plans/ENTERPRISE_UPGRADE_TRACKER.md",
      "AGENTS.md"
    ],
    "activeNextSlice": "NC-TB-01 / tenant-expand"
  },
  "safeEvidencePaths": [
    "docs/plans/current-program.md",
    "docs/plans/current-tracker.md",
    "docs/plans/ENTERPRISE_UPGRADE_TRACKER.md",
    "docs/enterprise-readiness-report.md",
    "docs/adr/ADR-001-tenant-model.md",
    "docs/adr/ADR-002-identity-model.md",
    "docs/adr/ADR-003-authorization-model.md",
    "docs/adr/ADR-004-outbox-and-jobs.md",
    "docs/adr/ADR-005-slice-lifecycle-automation.md",
    "docs/runbooks/default-tenant-backfill-plan.md",
    "docs/runbooks/tenant-isolation-abuse-tests.md",
    "docs/payments/payment-automation-boundary-design.md",
    "docs/commercial/commercial-model-spec.md",
    "docs/runbooks/disaster-recovery.md",
    "code_review.md"
  ],
  "forbiddenInputs": [
    "PHI",
    "secrets",
    "credentials",
    "patient data",
    "production identifiers",
    "raw payment identifiers",
    "raw logs"
  ],
  "requestedOutputSchema": "see Required Output Schema"
}
```
