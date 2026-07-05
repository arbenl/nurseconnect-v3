import { describe, expect, it } from "vitest";

import {
  findNurseStatusWriteViolations,
  nurseStatusWriteAllowlist,
} from "../lib/service-request-status-guard.mjs";

describe("nurse status guard", () => {
  it("blocks raw nurses.status writes outside domain-nurse constructors", () => {
    const text = `
      import { nurses } from "@nurseconnect/database/schema";
      await tx.update(nurses).set({ status: "verified", updatedAt: now });
    `;

    expect(findNurseStatusWriteViolations("packages/domain-admin-ops/src/bad.ts", text))
      .toContain("packages/domain-admin-ops/src/bad.ts: raw nurses.status write must use domain-nurse VerifiedCredentialEvidence helpers");
  });

  it("keeps the owning constructor allowlist explicit", () => {
    expect([...nurseStatusWriteAllowlist.keys()].sort()).toEqual([
      "packages/domain-nurse/src/credential-lifecycle.ts",
      "packages/domain-nurse/src/nurse-record.ts",
      "packages/domain-nurse/src/self-service.ts",
    ]);
  });

  it("rejects non-constructor statuses inside allowlisted files", () => {
    const text = `
      import { nurses } from "@nurseconnect/database/schema";
      await tx.update(nurses).set({ status: "verified", updatedAt: now });
    `;

    expect(findNurseStatusWriteViolations("packages/domain-nurse/src/self-service.ts", text))
      .toHaveLength(1);
  });

  it("blocks raw SQL nurses.status writes", () => {
    const text = `
      import { sql } from "@nurseconnect/database";
      await tx.execute(sql\`update nurses set status = 'verified'\`);
    `;

    expect(findNurseStatusWriteViolations("packages/domain-admin-ops/src/bad.ts", text))
      .toHaveLength(1);
  });

  it("blocks indirect nurses.status update objects", () => {
    const text = `
      import { nurses } from "@nurseconnect/database/schema";
      const update = { status: "verified", updatedAt: now };
      await tx.update(nurses).set(update);
    `;

    expect(findNurseStatusWriteViolations("packages/domain-admin-ops/src/bad.ts", text))
      .toHaveLength(1);
  });

  it("allows only approved indirect constructor statuses", () => {
    const text = `
      import { nurses } from "@nurseconnect/database/schema";
      const insert = { status: "submitted", updatedAt: now };
      await tx.insert(nurses).values(insert);
    `;

    expect(findNurseStatusWriteViolations("packages/domain-nurse/src/self-service.ts", text))
      .toHaveLength(0);
  });
});
