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

  it("maps referral partners to the partner portal", () => {
    expect(getCanonicalRouteForRole("referral_partner")).toBe("/partner");
  });

  it("returns null for unknown roles", () => {
    expect(getCanonicalRouteForRole("guest")).toBeNull();
    expect(getCanonicalRouteForRole(null)).toBeNull();
  });

  it("checks canonical ownership for a pathname", () => {
    expect(isCanonicalRouteForRole("admin", "/admin")).toBe(true);
    expect(isCanonicalRouteForRole("admin", "/dashboard")).toBe(false);
    expect(isCanonicalRouteForRole("patient", "/dashboard/profile")).toBe(true);
    expect(isCanonicalRouteForRole("referral_partner", "/partner/requests")).toBe(true);
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
    expect(normalizeCallbackUrlForRole("referral_partner", "/dashboard")).toBe("/partner");
  });

  it("keeps safe in-portal partner callback URLs", () => {
    expect(
      normalizeCallbackUrlForRole("referral_partner", "/partner/requests/123?tab=timeline"),
    ).toBe("/partner/requests/123?tab=timeline");
  });
});
