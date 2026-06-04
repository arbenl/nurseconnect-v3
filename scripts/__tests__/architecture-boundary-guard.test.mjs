import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import {
  LINE_LIMIT,
  checkLineGuard,
  checkPackageBoundaries,
  importSpecifiers,
} from "../check-architecture-boundaries.mjs";

const requiredAllowlistFiles = {
  "packages/domain-dispatch/src/assignment-policy.ts": 'import { appendRequestEvent } from "@nurseconnect/domain-request";',
  "packages/domain-admin-ops/src/ops-dashboard.ts": 'const nurse = await import("@nurseconnect/domain-nurse");',
  "packages/domain-identity/src/domain-user.db.test.ts": 'import { createNurseRecord } from "@nurseconnect/domain-nurse";',
};

function readFrom(files) {
  return (file) => files[file] ?? "";
}

function boundaryViolations(extraFiles = {}) {
  const files = { ...requiredAllowlistFiles, ...extraFiles };
  return checkPackageBoundaries(Object.keys(files), readFrom(files));
}

function textLines(count) {
  return Array.from({ length: count }, (_, index) => `export const line${index} = ${index};`).join("\n");
}

describe("architecture boundary guard", () => {
  it("passes the current transitional cross-domain allowlist", () => {
    expect(boundaryViolations()).toEqual([]);
  });

  it("fails a forbidden cross-domain import", () => {
    const violations = boundaryViolations({
      "packages/domain-nurse/src/bad.ts": 'import { appendRequestEvent } from "@nurseconnect/domain-request";',
    });

    expect(violations.join("\n")).toContain("illegal cross-domain import");
    expect(violations.join("\n")).toContain("@nurseconnect/domain-nurse -> @nurseconnect/domain-request");
  });

  it("fails a forbidden cross-domain re-export", () => {
    const violations = boundaryViolations({
      "packages/domain-request/src/index.ts": 'export { createNurseRecord } from "@nurseconnect/domain-nurse";',
    });

    expect(importSpecifiers('export * from "@nurseconnect/domain-nurse";')).toEqual([
      "@nurseconnect/domain-nurse",
    ]);
    expect(violations.join("\n")).toContain("illegal cross-domain import");
  });

  it("keeps the domain-identity to domain-nurse seam test-only", () => {
    const violations = checkPackageBoundaries(
      ["packages/domain-identity/src/domain-user.ts"],
      () => 'import { createNurseRecord } from "@nurseconnect/domain-nurse";'
    );

    expect(violations.join("\n")).toContain("illegal cross-domain import");
    expect(violations.join("\n")).toContain("unused required transitional allowlist entry");
  });

  it("fails a new non-exempt source file over the line limit", () => {
    const violations = checkLineGuard(
      [{ file: "packages/domain-request/src/too-large.ts", status: "A" }],
      () => textLines(LINE_LIMIT + 1)
    );

    expect(violations.join("\n")).toContain("new file has 151 lines");
  });

  it("allows an existing large source file when it does not grow", () => {
    const violations = checkLineGuard(
      [{ file: "packages/domain-request/src/legacy.ts", status: "M" }],
      () => textLines(LINE_LIMIT + 20),
      () => textLines(LINE_LIMIT + 20)
    );

    expect(violations).toEqual([]);
  });

  it("fails an existing large source file when it grows", () => {
    const violations = checkLineGuard(
      [{ file: "packages/domain-request/src/legacy.ts", status: "M" }],
      () => textLines(LINE_LIMIT + 21),
      () => textLines(LINE_LIMIT + 20)
    );

    expect(violations.join("\n")).toContain("grew from 170 to 171 lines");
  });

  it("exempts tests, route files, and app component files from the line guard", () => {
    const changes = [
      { file: "packages/domain-request/src/request-actions.test.ts", status: "A" },
      { file: "apps/web/src/app/api/requests/route.ts", status: "A" },
      { file: "apps/web/src/components/dashboard/large-card.tsx", status: "A" },
    ];

    expect(checkLineGuard(changes, () => textLines(LINE_LIMIT + 50))).toEqual([]);
  });

  it("fails closed when the configured base ref is missing", () => {
    expect(() =>
      execFileSync("node", ["scripts/check-architecture-boundaries.mjs"], {
        cwd: process.cwd(),
        env: { ...process.env, ARCH_BOUNDARY_BASE: "refs/heads/no-such-base-for-test" },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      })
    ).toThrow(/base ref is unavailable/);
  });
});
