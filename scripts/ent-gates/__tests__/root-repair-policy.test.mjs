import { describe, expect, it } from "vitest";
import { validatePromotionPolicy } from "../promotion-policy.mjs";
import { fileSetHash, REPAIR_BASE, REPAIR_BRANCH, REPAIR_FILES, REPAIR_SLICE } from "../root-repair-policy.mjs";
const nil = { status: "intentional-null" };
const states = { program: { base: nil, head: nil }, enterprise: { base: nil, head: nil } };
const manifest = { "promotion-mode": "governance-repair", branch: REPAIR_BRANCH, slice: REPAIR_SLICE,
  gates: Object.fromEntries(Object.entries({ "ent-tm": "threat-models", "ent-dlv": "data-lifecycle", "ent-perf": "performance" })
    .map(([g, folder]) => [g, { status: "required", evidence: `docs/${folder}/nc-gov-repair-01.md` }])) };
const record = { schemaVersion: 1, mode: "reviewed-governance-repair", baseSha: REPAIR_BASE, branch: REPAIR_BRANCH,
  slice: REPAIR_SLICE, allowedFiles: REPAIR_FILES, fileCount: REPAIR_FILES.length, fileSetSha256: fileSetHash(REPAIR_FILES) };
function check(overrides = {}) {
  return validatePromotionPolicy({ manifest, baseSha: REPAIR_BASE, sourceBranch: REPAIR_BRANCH,
    baseState: nil, headState: nil, trackerChanged: false, authorityStates: states,
    changedFiles: REPAIR_FILES, observedFiles: REPAIR_FILES, regularHeadFiles: REPAIR_FILES,
    repairRecord: record, repairContext: { mainSha: REPAIR_BASE, errors: [] }, ...overrides }).errors;
}
describe("owner-adopted fixed-base repair constraints, not owner adoption proof", () => {
  it("accepts the exact candidate context without changing prior modes", () => expect(check()).toEqual([]));
  it.each([
    ["missing record", { repairRecord: undefined }],
    ["unknown record key", { repairRecord: { ...record, bypass: true } }],
    ["altered record identity", { repairRecord: { ...record, schemaVersion: 2 } }],
    ["wrong file-set hash", { repairRecord: { ...record, fileSetSha256: "0".repeat(64) } }],
    ["duplicate record path", { repairRecord: { ...record, allowedFiles: [...REPAIR_FILES, REPAIR_FILES[0]] } }],
    ["wrong base/reuse", { baseSha: "b".repeat(40) }],
    ["main moved", { repairContext: { mainSha: "b".repeat(40), errors: [] } }],
    ["wrong branch", { sourceBranch: "codex/other" }],
    ["wrong slice", { manifest: { ...manifest, slice: "NC-TB-03A" } }],
    ["missing context", { repairContext: undefined }],
    ["context rejection", { repairContext: { mainSha: REPAIR_BASE, errors: ["fork rejected"] } }],
    ["changed tracker", { trackerChanged: true }],
    ["extra product source", { changedFiles: [...REPAIR_FILES, "apps/web/src/unsafe.ts"] }],
    ["incomplete enumeration", { observedFiles: REPAIR_FILES.slice(1) }],
    ["duplicate observed path", { observedFiles: [...REPAIR_FILES, REPAIR_FILES[0]] }],
    ["symlink/deletion", { regularHeadFiles: REPAIR_FILES.slice(1) }],
    ["unbound evidence", { manifest: { ...manifest, gates: { ...manifest.gates, "ent-dlv": { status: "required", evidence: "docs/other.md" } } } }],
    ["weakened required gate", { manifest: { ...manifest, gates: { ...manifest.gates, "ent-tm": { status: "n/a" } } } }],
  ])("rejects %s", (_name, input) => expect(check(input).length).toBeGreaterThan(0));
  it.each(["baseState", "headState"])("rejects a non-null %s", (key) => {
    expect(check({ [key]: { status: "promoted" } }).length).toBeGreaterThan(0);
  });
  it.each(["program", "enterprise"])("rejects each non-null %s record independently", (name) => {
    for (const side of ["base", "head"]) {
      expect(check({ authorityStates: { ...states, [name]: { ...states[name], [side]: { status: "promoted" } } } }).length).toBeGreaterThan(0);
    }
  });
});
