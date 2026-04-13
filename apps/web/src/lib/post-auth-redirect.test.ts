import { afterEach, describe, expect, it, vi } from "vitest";

import { resolvePostAuthRedirectTarget } from "./post-auth-redirect";

describe("resolvePostAuthRedirectTarget", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("routes admins to the admin portal", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ user: { role: "admin" } }),
    } as Response);

    await expect(resolvePostAuthRedirectTarget()).resolves.toBe("/admin");
  });

  it("keeps safe in-portal callbacks", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ user: { role: "patient" } }),
    } as Response);

    await expect(resolvePostAuthRedirectTarget("/dashboard/profile")).resolves.toBe(
      "/dashboard/profile",
    );
  });

  it("rejects wrong-portal callbacks", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ user: { role: "admin" } }),
    } as Response);

    await expect(resolvePostAuthRedirectTarget("/dashboard/profile")).resolves.toBe("/admin");
  });

  it("throws when the signed-in user cannot be resolved", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);

    await expect(resolvePostAuthRedirectTarget()).rejects.toThrow(
      "Failed to resolve signed-in user",
    );
  });
});
