import { describe, expect, it } from "vitest";

import {
  getCanonicalRouteForRole,
  isCanonicalRouteForRole,
  normalizeCallbackUrlForRole,
} from "@/lib/canonical-routes";

describe("canonical-routes", () => {
  it("maps patient and nurse users to the dashboard", () => {
    expect(getCanonicalRouteForRole("patient")).toBe("/dashboard");
    expect(getCanonicalRouteForRole("nurse")).toBe("/dashboard");
  });

  it("maps admin users to the admin portal", () => {
    expect(getCanonicalRouteForRole("admin")).toBe("/admin");
  });

  it("returns null for unknown roles", () => {
    expect(getCanonicalRouteForRole("guest")).toBeNull();
    expect(getCanonicalRouteForRole(null)).toBeNull();
  });

  it("checks canonical ownership for a pathname", () => {
    expect(isCanonicalRouteForRole("admin", "/admin")).toBe(true);
    expect(isCanonicalRouteForRole("admin", "/dashboard")).toBe(false);
    expect(isCanonicalRouteForRole("patient", "/dashboard/profile")).toBe(true);
  });

  it("keeps safe in-portal callback URLs", () => {
    expect(normalizeCallbackUrlForRole("patient", "/dashboard/profile?tab=account")).toBe(
      "/dashboard/profile?tab=account",
    );
  });

  it("rejects external or wrong-portal callback URLs", () => {
    expect(normalizeCallbackUrlForRole("admin", "https://evil.example/admin")).toBe("/admin");
    expect(normalizeCallbackUrlForRole("admin", "/dashboard")).toBe("/admin");
    expect(normalizeCallbackUrlForRole("patient", "/admin")).toBe("/dashboard");
  });
});
