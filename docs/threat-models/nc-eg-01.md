# NC-EG-01 Ent Gate Framework Threat Model

## Slice

NC-EG-01 adds fail-closed enterprise gate declarations to `verify-slice
--required-gates` and PR Finalizer. It does not change product, auth, tenant,
schema, clinical, PHI, or notification behavior.

## Scope

In scope: `slice-gates.yaml`, guarded path classification, ent-gate evidence
generation, required-gates wiring, and PR body evidence validation.

Out of scope: the deeper NC-EG-02/03/04 threat-model, data-lifecycle, and
performance-budget content checks.

## Assets

- Slice promotion integrity in `docs/plans/current-tracker.md`.
- Required local gate evidence under `tmp/multi-agent/verify-slice/**`.
- PR Finalizer enforcement before merge.
- The root `slice-gates.yaml` manifest and its sha256 evidence.

## Trust Boundaries

- Local agents can edit working-tree files, but CI and PR Finalizer must verify
  the final pushed manifest and evidence.
- `verify-slice` computes changed-file inventory from git plus staged,
  unstaged, and untracked files.
- PR Finalizer treats PR body evidence as untrusted until it validates required
  markers and the manifest sha.

## STRIDE Findings

- Spoofing: a PR could cite a different slice. The manifest must match the
  promoted tracker slice on non-main branches.
- Tampering: a PR could edit the manifest after evidence is generated. PR
  Finalizer checks the cited manifest sha against `HEAD`.
- Repudiation: missing ent-gate evidence would make gate decisions ambiguous.
  Required gates write `evidence/ent-gates.{md,json}`.
- Information disclosure: no PHI or secrets are read or emitted by this slice.
- Denial of service: malformed or missing manifests fail fast with actionable
  errors.
- Elevation of privilege: guarded gate or protected path changes cannot mark
  their mapped gate `n/a`.

## Residual Risk

NC-EG-01 validates declarations and evidence presence. The richer deterministic
content checks land in NC-EG-02, NC-EG-03, and NC-EG-04.

## Verification

- Missing `slice-gates.yaml` fails.
- `n/a` without a written justification fails.
- Guarded-path changes with mapped gate `n/a` fail.
- PR evidence without ent-gate PASS and manifest sha fails.
- Follow-up policy repairs must keep this evidence file in the PR diff when
  they rely on NC-EG-01 ent-gate finalizer evidence.
- Playbook closeout updates must record the same NC-EG-01 evidence path until
  lifecycle automation promotes per-slice manifests.
