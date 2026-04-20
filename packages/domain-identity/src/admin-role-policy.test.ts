import { schema } from "@nurseconnect/database";
import { describe, expect, it } from "vitest";

import { RoleChangeValidationError } from "./errors";
import { planUserRoleChange } from "./admin-role-policy";

type DomainUser = typeof schema.users.$inferSelect;

function userFixture(overrides: Partial<DomainUser> = {}): DomainUser {
  return {
    id: "user_1",
    authId: "auth_1",
    email: "user@test.local",
    role: "patient",
    name: "Test User",
    firstName: null,
    lastName: null,
    phone: null,
    city: null,
    address: null,
    profileCompletedAt: null,
    createdAt: new Date("2026-04-17T00:00:00.000Z"),
    updatedAt: new Date("2026-04-17T00:00:00.000Z"),
    ...overrides,
  };
}

describe("planUserRoleChange", () => {
  it("returns unchanged when the requested role already matches the target user", () => {
    const result = planUserRoleChange({
      targetUser: userFixture({ role: "patient" }),
      nextRole: "patient",
    });

    expect(result.unchanged).toBe(true);
    expect(result.sideEffects).toEqual([]);
  });

  it("returns a patch and audit side effect for a valid role change", () => {
    const result = planUserRoleChange({
      targetUser: userFixture({ role: "patient", email: "patient@test.local" }),
      nextRole: "nurse",
    });

    if (result.unchanged) {
      throw new Error("Expected role change to produce a patch");
    }

    expect(result.unchanged).toBe(false);
    expect(result.patch).toMatchObject({ role: "nurse" });
    expect(result.sideEffects).toEqual([
      {
        type: "admin-audit",
        action: "user.role.changed",
        targetUserId: "user_1",
        details: {
          previousRole: "patient",
          nextRole: "nurse",
          targetEmail: "patient@test.local",
        },
      },
    ]);
  });

  it("rejects invalid role input", () => {
    expect(() =>
      planUserRoleChange({
        targetUser: userFixture(),
        nextRole: "not-a-real-role",
      }),
    ).toThrow(RoleChangeValidationError);
  });
});
