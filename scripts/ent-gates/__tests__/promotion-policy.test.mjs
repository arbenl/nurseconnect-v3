import { describe, expect, it } from "vitest";
import { parseManifest } from "../manifest.mjs";
import { AUTHORITY_CORE_FILES, BOOTSTRAP_FILES, parseEnterprisePromotionState, parseProgramPromotionState, parseTrackerPromotionState, resolveSourceBranch, validatePromotionPolicy } from "../promotion-policy.mjs";
const nullTracker = "# Tracker\n\n## Next Slice\n\nNo implementation slice is currently promoted while a gate is open.\n\n## Closeout\n";
const promotedTracker = "# Tracker\n\n## Next Slice\n\n```text\nNC-TB-03A / codex/tenant-enforce-rehearsal (ready)\n```\n\n## Closeout\n";
const nullState = parseTrackerPromotionState(nullTracker);
const promotedState = parseTrackerPromotionState(promotedTracker);
const target = { slice: "NC-EG-07", branch: "codex/gemini-review-route-repair" };
const authorityStates = { program: { base: { status: "intentional-null" }, head: { status: "promoted", target } }, enterprise: { base: { status: "intentional-null" }, head: { status: "promoted", target } } };
const bootstrapRecord = {
  schemaVersion: 3, authorizationVersion: 3, mode: "one-shot-null-promotion-installer",
  baseSha: "e8b3c5c38650ed3bcc0d64de538cc4247598f49a", branch: "codex/ent-gate-null-promotion-bootstrap", slice: "NC-EG-06", fileCount: 15,
  fileSetSha256: "a571089ec113f602ef046d14068648fdda5be70bde448dddfbac8adc6f340835",
  allowedFiles: BOOTSTRAP_FILES,
};
const authorityManifest = {
  "promotion-mode": "authority",
  "authority-files": "docs/plans/nc-eg-07-gemini-route-repair-design.md",
  slice: "NC-EG-07",
  branch: "codex/gemini-review-route-repair",
  gates: {
    "ent-tm": { status: "required", evidence: "docs/threat-models/nc-eg-07.md" },
    "ent-dlv": { status: "required", evidence: "docs/data-lifecycle/nc-eg-07.md" },
    "ent-perf": { status: "required", evidence: "docs/performance/nc-eg-07.md" },
  },
};
const authorityFiles = [...AUTHORITY_CORE_FILES, authorityManifest["authority-files"], ...Object.values(authorityManifest.gates).map((gate) => gate.evidence)];
function authority(overrides = {}) {
  return validatePromotionPolicy({
    manifest: authorityManifest,
    changedFiles: authorityFiles,
    observedFiles: authorityFiles,
    baseState: nullState,
    headState: { status: "promoted", target: { slice: authorityManifest.slice, branch: authorityManifest.branch } },
    trackerChanged: true,
    authorityStates,
    regularHeadFiles: authorityFiles,
    baseSha: "base",
    sourceBranch: authorityManifest.branch,
    ...overrides,
  });
}
function bootstrap(overrides = {}) {
  return validatePromotionPolicy({
    manifest: { "promotion-mode": "bootstrap", slice: "NC-EG-06", branch: "codex/ent-gate-null-promotion-bootstrap" },
    changedFiles: BOOTSTRAP_FILES,
    observedFiles: BOOTSTRAP_FILES,
    baseState: nullState,
    headState: nullState,
    trackerChanged: false,
    regularHeadFiles: BOOTSTRAP_FILES,
    baseSha: bootstrapRecord.baseSha,
    sourceBranch: bootstrapRecord.branch,
    bootstrapRecord,
    ...overrides,
  });
}
describe("strict tracker promotion states", () => {
  it("recognizes intentional null and one promoted target", () => {
    expect(nullState).toEqual({ status: "intentional-null" });
    expect(promotedState).toEqual({ status: "promoted", target: { slice: "NC-TB-03A", branch: "codex/tenant-enforce-rehearsal" } });
    expect(parseProgramPromotionState("No implementation slice is currently promoted.\n")).toEqual(nullState);
    expect(parseProgramPromotionState("NC-EG-07 / codex/gemini-review-route-repair (ready)\n")).toEqual({ status: "promoted", target });
    expect(parseEnterprisePromotionState("| `NC-EG-07` | `ready` | `gemini-review-route-repair` | work |\n")).toEqual({ status: "promoted", target });
    expect(parseProgramPromotionState("NC-EG-07 / codex/gemini-review-route-repair\n- NC-X / other/x\n")).toEqual({ status: "malformed" });
    expect(parseEnterprisePromotionState("| `NC-EG-07` | `ready` | `gemini-review-route-repair` | x |\n| `NC-X` | `ready` | `x` | x |\n")).toEqual({ status: "malformed" });
    expect(parseEnterprisePromotionState("| NC-X | ready | x | malformed |\n")).toEqual({ status: "malformed" });
    expect(parseEnterprisePromotionState("| `NC-EG-07` | `ready` | `gemini-review-route-repair` | x |\n `NC-X` | `ready` | `x` | x |\n")).toEqual({ status: "malformed" });
  });
  it.each([
    ["missing section", "# Tracker\n"],
    ["empty section", "## Next Slice\n\nNothing selected.\n"],
    ["duplicate sections", `${nullTracker}\n## Next Slice\nNo implementation slice is currently promoted.\n`],
    ["mixed null and target", `## Next Slice\nNo implementation slice is currently promoted.\nNC-X-01 / codex/x\n`],
    ["multiple targets", "## Next Slice\nNC-X-01 / codex/x\nNC-X-02 / codex/y\n"],
    ["invalid target mixed with valid", "## Next Slice\nNC-X-01 / codex/x\nNC-X-02 / other/y\n"],
    ["indented target", "## Next Slice\n  NC-X-01 / codex/x\n"],
    ["bulleted target", "## Next Slice\n- NC-X-01 / codex/x\n"],
    ["indented invalid target", "## Next Slice\nNC-X-01 / codex/x\n  NC-X-02 / other/y\n"],
    ["bulleted invalid target", "## Next Slice\nNC-X-01 / codex/x\n- NC-X-02 / other/y\n"],
    ["two targets on one line", "## Next Slice\nNC-X-01 / codex/x and NC-X-02 / codex/y\n"],
    ["inline target after null", "## Next Slice\nNo implementation slice is currently promoted except NC-X-01 / codex/x\n"],
    ["inline invalid target after null", "## Next Slice\nNo implementation slice is currently promoted except NC-X-01 / other/x\n"],
  ])("fails closed for %s", (_label, tracker) => {
    expect(parseTrackerPromotionState(tracker)).toEqual({ status: "malformed" });
  });
  it("resolves local and detached-head branch identity", () => {
    const ownedPr = { GITHUB_ACTIONS: "true", GITHUB_BASE_REF: "main", GITHUB_HEAD_REF: "codex/ci", GITHUB_REPOSITORY: "arbenl/nurseconnect-v3" };
    expect(resolveSourceBranch({}, "codex/local")).toBe("codex/local");
    expect(resolveSourceBranch(ownedPr, "", "arbenl/nurseconnect-v3")).toBe("codex/ci");
    expect(resolveSourceBranch(ownedPr, "", "attacker/nurseconnect-v3")).toBe("");
    expect(resolveSourceBranch(ownedPr, "", "")).toBe("");
    expect(resolveSourceBranch({ GITHUB_HEAD_REF: "codex/spoof" }, "")).toBe("");
    expect(resolveSourceBranch({ GITHUB_HEAD_REF: "codex/spoof" }, "codex/local")).toBe("");
  });
});
describe("authority promotion mode", () => {
  it("passes the manifest-bound Gemini repair promotion route", () => expect(authority().errors).toEqual([]));
  it.each([
    ["malformed base", { baseState: { status: "malformed" } }, "intentional-null base"],
    ["already promoted base", { baseState: promotedState }, "intentional-null base"],
    ["unresolved source", { sourceBranch: "" }, "resolved, non-conflicting source branch"],
    ["wrong source branch", { sourceBranch: "codex/unrelated" }, "does not match the manifest target branch"],
    ["missing head promotion", { headState: nullState }, "exactly one head promotion"],
    ["unchanged tracker", { trackerChanged: false }, "head tracker to change"],
    ["target mismatch", { manifest: { ...authorityManifest, slice: "NC-X", branch: "codex/x" } }, "target does not match"],
    ["unlisted path", { changedFiles: [...authorityFiles, "docs/plans/unlisted.md"], observedFiles: [...authorityFiles, "docs/plans/unlisted.md"] }, "exact authority set"],
    ["missing required path", { changedFiles: authorityFiles.slice(1), observedFiles: authorityFiles.slice(1) }, "exact authority set"],
    ["incomplete enumeration", { changedFiles: authorityFiles.slice(1) }, "enumeration is incomplete"],
    ["forbidden declaration", { manifest: { ...authorityManifest, "authority-files": "scripts/tool.mjs" } }, "not an approved design"], ["traversal declaration", { manifest: { ...authorityManifest, "authority-files": "docs/plans/../outside.md" } }, "not an approved design"], ["backslash declaration", { manifest: { ...authorityManifest, "authority-files": "docs\\plans\\outside.md" } }, "not an approved design"],
    ["missing program record", { authorityStates: { enterprise: authorityStates.enterprise } }, "base program record"],
    ["conflicting program target", { authorityStates: { ...authorityStates, program: { ...authorityStates.program, head: { status: "promoted", target: { ...target, slice: "NC-X" } } } } }, "program target does not match"],
    ["missing enterprise promotion", { authorityStates: { ...authorityStates, enterprise: { ...authorityStates.enterprise, head: nullState } } }, "head promotion in the enterprise record"],
    ["deleted declared artifact", { regularHeadFiles: authorityFiles.filter((file) => file !== authorityManifest["authority-files"]) }, "not a regular head file"],
  ])("rejects %s", (_label, overrides, message) => {
    expect(authority(overrides).errors.join("\n")).toContain(message);
  });
  it.each(["apps/web/runtime.ts", "packages/database/src/schema.ts", "packages/database/migrations/001.sql",
    "packages/auth/index.ts", "packages/database/src/tenant.ts", ".github/workflows/ci.yml",
    "scripts/ent-gates/check.mjs", "config/production.json", "package.json"])("rejects forbidden path %s", (file) => {
    expect(authority({ changedFiles: [...authorityFiles, file], observedFiles: [...authorityFiles, file] }).errors.join("\n"))
      .toContain("exact authority set");
  });
});
describe("one-shot bootstrap mode", () => {
  it("passes the exact installer identity", () => expect(bootstrap().errors).toEqual([]));
  it.each([["top-level", "promotion-mode: authority\npromotion-mode: bootstrap\n", "Duplicate manifest key: promotion-mode"], ["gate", "gates:\n  ent-tm:\n  ent-tm:\n", "Duplicate gate: ent-tm"], ["block field", "gates:\n  ent-tm:\n    status: required\n    status: n/a\n", "Duplicate ent-tm key: status"], ["inline field", "gates:\n  ent-tm: {status: required, status: n/a}\n", "Unsupported inline gate map"]])("rejects duplicate %s declarations", (_label, source, message) => expect(parseManifest(source).errors.join("\n")).toContain(message));
  it.each([
    ["missing record", { bootstrapRecord: undefined }, "record is missing"],
    ["wrong record identity", { bootstrapRecord: { ...bootstrapRecord, mode: "other" } }, "identity is invalid"],
    ["duplicate record file", { bootstrapRecord: { ...bootstrapRecord, allowedFiles: [...BOOTSTRAP_FILES, BOOTSTRAP_FILES[0]] } }, "file set is invalid"],
    ["wrong record file assertion", { bootstrapRecord: { ...bootstrapRecord, fileCount: 12 } }, "file-set assertion is invalid"],
    ["wrong record base", { bootstrapRecord: { ...bootstrapRecord, baseSha: "other" } }, "baseSha is invalid"],
    ["wrong record branch", { bootstrapRecord: { ...bootstrapRecord, branch: "codex/other" } }, "branch is invalid"],
    ["wrong record slice", { bootstrapRecord: { ...bootstrapRecord, slice: "NC-X" } }, "slice is invalid"],
    ["expired base", { baseSha: "other" }, "base SHA is invalid"],
    ["wrong branch", { sourceBranch: "codex/other" }, "source branch is invalid"],
    ["wrong manifest", { manifest: { "promotion-mode": "bootstrap", slice: "NC-X", branch: "codex/x" } }, "manifest identity is invalid"],
    ["promoted base", { baseState: promotedState }, "intentional-null base and head"],
    ["promoted head", { headState: promotedState }, "intentional-null base and head"],
    ["malformed base", { baseState: { status: "malformed" } }, "intentional-null base and head"],
    ["malformed head", { headState: { status: "malformed" } }, "intentional-null base and head"],
    ["changed tracker", { trackerChanged: true }, "must not change the tracker"],
    ["deleted bootstrap artifact", { regularHeadFiles: BOOTSTRAP_FILES.slice(1) }, "not a regular head file"],
    ["surplus path", { changedFiles: [...BOOTSTRAP_FILES, "package.json"], observedFiles: [...BOOTSTRAP_FILES, "package.json"] }, "one-shot set"],
    ["incomplete enumeration", { observedFiles: BOOTSTRAP_FILES.slice(1) }, "enumeration is incomplete"],
  ])("rejects %s", (_label, overrides, message) => {
    expect(bootstrap(overrides).errors.join("\n")).toContain(message);
  });
});
