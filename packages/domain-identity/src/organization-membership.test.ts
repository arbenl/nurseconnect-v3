import { describe, expect, it } from "vitest";

import { boundedMembershipListLimit, isActiveOrganizationMembership } from "./organization-membership";

describe("organization membership predicates", () => {
  it("whitelists only active membership status", () => {
    expect(isActiveOrganizationMembership({ status: "active" })).toBe(true);
    expect(isActiveOrganizationMembership({ status: "invited" })).toBe(false);
    expect(isActiveOrganizationMembership({ status: "disabled" })).toBe(false);
    expect(isActiveOrganizationMembership(null)).toBe(false);
  });

  it("bounds list limits to a safe range", () => {
    expect(boundedMembershipListLimit()).toBe(50);
    expect(boundedMembershipListLimit(Number.NaN)).toBe(50);
    expect(boundedMembershipListLimit(0)).toBe(1);
    expect(boundedMembershipListLimit(12.9)).toBe(12);
    expect(boundedMembershipListLimit(500)).toBe(100);
  });
});
