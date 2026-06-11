# NC-EG-01 — `ent-gate-framework` Slice Design

**Status:** draft for design review (SOP Step 1)
**Date:** 2026-06-10
**Tracker:** `docs/plans/ENTERPRISE_UPGRADE_TRACKER.md` (band NC-EG)
**Depends on:** NC-EG-00 (governing docs merged)

## 1. Goal

Add a fail-closed **ent-gate stage** to the `verify-slice` execution contract
and PR Finalizer so no PR can be opened without explicit, evidenced
`ent-tm` / `ent-dlv` / `ent-perf` declarations. This slice builds the
*framework* (manifest, validator, wiring, finalizer check). The deterministic
*content* checks land in NC-EG-02/03/04.

## 2. Mechanism (grounded in current `verify-slice.sh`)

Observed wiring points (`scripts/multi-agent/verify-slice.sh`):
gates execute via `run_gate "<name>" "<cmd>"`; the `--static` lane runs
mcp-preflight → env-check → repo-hygiene → modularity-guard → diff checks →
sentinel → sentry-advisory → slice-evidence (+ type-check/lint/build when not
docs-only); the `--required-gates` lane runs `pnpm gate:release`, or a reduced
docs path when `docs_only=yes`.

### 2.1 Manifest: `slice-gates.yaml` (repo root, tracked)

```yaml
slice: NC-EG-01            # must match promoted slice in current-tracker.md
branch: codex/ent-gate-framework
gates:
  ent-tm:   { status: required, evidence: docs/threat-models/nc-eg-01.md }
  ent-dlv:  { status: n/a, justification: "no schema or PHI-surface changes" }
  ent-perf: { status: n/a, justification: "no critical-route or bundle changes" }
```

Rules (enforced by validator, all fail-closed):
- File must exist and parse; unknown keys/statuses fail.
- `status` ∈ `required | n/a`. `required` ⇒ `evidence` path must exist and be
  in the slice diff. `n/a` ⇒ non-empty `justification` (≥ 20 chars).
- `slice` must equal the promoted slice ID in `docs/plans/current-tracker.md`
  (parsed deterministically from the Next Slice block) — blocks rogue slices.
- **Guarded-path overrides** (`config/ent-gate-paths.json`): if the diff
  (`$BASE_COMMIT...HEAD` + staged/worktree, same inventory verify-slice already
  computes) touches a guarded pattern, `n/a` is illegal for the mapped gate:
  - `ent-tm`: `apps/web/src/server/auth/**`, `packages/domain-identity/**`,
    `packages/database/src/tenant-context*`, `packages/database/src/schema/**`,
    `packages/domain-payments/**`, `apps/web/src/app/api/**`
  - `ent-dlv`: `packages/database/src/schema/**`, `packages/database/drizzle/**`
  - `ent-perf`: `apps/web/src/server/requests/**`, `packages/domain-dispatch/**`
- Until NC-EG-02/03/04 land, `required` is satisfied by evidence-file existence
  + template-section presence (headings check). The deeper deterministic checks
  ratchet in via those slices without changing this framework.

### 2.2 Wiring (three insertion points)

1. `--static` lane: `run_gate "ent-gates-manifest" "node scripts/ent-gates/check.mjs --mode manifest --run-root \"$RUN_ROOT\" --base \"$BASE_COMMIT\""`
   — inserted after `slice-evidence`, **before** the `docs_only` branch so the
   docs-only path cannot skip it.
2. `--required-gates` lane: `run_gate "ent-gates-required" "node scripts/ent-gates/check.mjs --mode full ..."`
   — added to **both** branches of the `docs_only` conditional (the reduced
   docs path currently runs only mcp-preflight/env/hygiene/diff; the ent-gate
   joins it).
3. PR Finalizer (`scripts/multi-agent/finalizer.mjs`): reject unless the PR
   body contains the gate-evidence block (`ent-gates: PASS @ <run_root>` +
   manifest sha) and the manifest in HEAD matches that sha.

Validator writes `"$RUN_ROOT"/evidence/ent-gates.md` (+ `.json`) — declaration
table, diff-classifier hits, verdict — so reviewer prompts and the PR body can
reference it like existing model-review evidence.

### 2.3 New files (each ≤ 150 lines, modularity guard)

| File | Purpose |
|---|---|
| `scripts/ent-gates/check.mjs` | CLI entry; arg parse; exit non-zero on any violation |
| `scripts/ent-gates/manifest.mjs` | YAML load + schema validation (no new deps; reuse existing yaml dep if present, else minimal parser) |
| `scripts/ent-gates/diff-classifier.mjs` | changed-file inventory → guarded-path hits |
| `scripts/ent-gates/evidence.mjs` | write evidence md/json into run_root |
| `scripts/ent-gates/__tests__/*.test.mjs` | unit + negative tests (node lane) |
| `config/ent-gate-paths.json` | guarded-path → gate map (single source) |
| `docs/threat-models/_template.md` | STRIDE-lite template (consumed properly in NC-EG-02) |
| `docs/threat-models/nc-eg-01.md` | this slice's own threat model (first consumer) |
| `slice-gates.yaml` | this slice's manifest |

`package.json`: add `"ent:gates": "node scripts/ent-gates/check.mjs"`.

## 3. Falsifiable exit criteria (from tracker, expanded)

1. `--required-gates` with no `slice-gates.yaml` → non-zero exit (negative test).
2. `n/a` with empty/short justification → fail (negative test).
3. Diff touching `packages/database/src/schema/**` with `ent-dlv: n/a` → fail
   (fixture-diff negative test).
4. `slice:` mismatching the promoted tracker slice → fail (negative test).
5. Docs-only `--required-gates` still executes `ent-gates-required` (assert gate
   name appears in run log).
6. Finalizer rejects a PR body missing the ent-gates evidence block (unit test
   against finalizer with fixture body).
7. Happy path: this slice's own manifest + threat model pass end-to-end;
   `run_root` evidence committed to PR body.

## 4. Threat surface (ent-tm for this slice itself)

- **Gate self-tampering:** a future diff editing `scripts/ent-gates/**`,
  `config/ent-gate-paths.json`, or `verify-slice.sh` is itself a guarded path
  ⇒ add these to the `ent-tm` guarded list so gate changes always require a
  threat model. (Self-protecting.)
- **Manifest drift:** finalizer pins manifest sha from the evidence block to
  HEAD, preventing post-evidence manifest edits.
- **Branch spoofing:** slice/branch cross-check against the tracker's promoted
  slice; mismatch fails.
- **Docs-only escape hatch:** closed by wiring point 2.
- Residual risk: an agent could rewrite the tracker's Next Slice block to match
  a rogue manifest — mitigated by CODEOWNERS on `docs/plans/**` and PR review;
  accepted for this slice.

## 5. Test plan

Unit (vitest node lane, `scripts/ent-gates/__tests__`): manifest schema cases,
classifier fixtures, justification rules, tracker-parse cases. Integration:
bash-level run of `check.mjs` against fixture run_root + fixture diffs
(committed under `__tests__/fixtures/`). Negative tests are first-class
acceptance evidence (constitution: falsifiable slices).

## 6. Rollout / sequencing

1. NC-EG-00 merges (this design rides in that docs-only PR).
2. NC-EG-01 implements per this design on `codex/ent-gate-framework`.
3. First enforcement consumers: NC-EG-02/03/04, then amended NC-E2-03.
4. Rollback: gate stage is a single `run_gate` line per lane; revert = remove
   lines + script dir. No schema, no runtime impact.

## 7. Open questions for design review

1. YAML vs JSON for the manifest (JSON avoids a parser dependency; YAML is
   friendlier for justifications). Default: YAML if a yaml dep already exists
   in the workspace, else JSON.
2. Should `ent-perf` guarded paths include `apps/web/src/app/**` page routes
   now, or wait for NC-EG-04's budget definitions? Default: wait.
3. Manifest location: repo root vs `docs/gates/<slice>.yaml`. Root chosen for
   discoverability; review may prefer the namespaced dir.
