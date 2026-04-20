import { describe, expect, it } from "vitest";

import { ForbiddenError, UnauthorizedError } from "./errors";
import { requireAnyRole } from "./require-role";

describe("requireAnyRole", () => {
  it("throws UnauthorizedError when there is no resolved session user", async () => {
    await expect(requireAnyRole(["admin"], null)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws ForbiddenError when the user role is not allowed", async () => {
    await expect(
      requireAnyRole(["admin"], {
        session: {
          user: {
            id: "auth_patient_1",
            email: "patient@test.local",
          },
        },
        user: {
          id: "user_patient_1",
          authId: "auth_patient_1",
          email: "patient@test.local",
          role: "patient",
          name: "Patient User",
          firstName: null,
          lastName: null,
          phone: null,
          city: null,
          address: null,
          profileCompletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("returns the resolved session user when the role is allowed", async () => {
    const resolved = {
      session: {
        user: {
          id: "auth_admin_1",
          email: "admin@test.local",
        },
      },
      user: {
        id: "user_admin_1",
        authId: "auth_admin_1",
        email: "admin@test.local",
        role: "admin" as const,
        name: "Admin User",
        firstName: null,
        lastName: null,
        phone: null,
        city: null,
        address: null,
        profileCompletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    await expect(requireAnyRole(["admin"], resolved)).resolves.toBe(resolved);
  });
});
