import { describe, expect, it } from "vitest";

import {
  AdminRejectNurseSchema,
  AdminSuspendNurseSchema,
  AdminVerifyNurseSchema,
  NurseStatusEnum,
} from "../../src/nurse-credential";

describe("nurse credential contracts", () => {
  it("accepts the approved credential lifecycle states", () => {
    const statuses = [
      "draft",
      "submitted",
      "under_review",
      "verified",
      "rejected",
      "suspended",
      "expired",
      "renewal_pending",
    ] as const;

    for (const status of statuses) {
      expect(NurseStatusEnum.parse(status)).toBe(status);
    }
  });

  it("requires licenseValidUntil when verifying a nurse", () => {
    const result = AdminVerifyNurseSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("allows rejection without a reason", () => {
    const result = AdminRejectNurseSchema.safeParse({});

    expect(result.success).toBe(true);
  });

  it("requires a suspension reason", () => {
    const result = AdminSuspendNurseSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});
