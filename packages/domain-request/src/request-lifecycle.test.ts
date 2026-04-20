import { describe, expect, it } from "vitest";

import { canAdminTransition, canTransition } from "./request-lifecycle";

describe("canTransition", () => {
  it("moves assigned to accepted on accept", () => {
    expect(canTransition("assigned", "accept")).toBe("accepted");
  });

  it("throws on invalid open to accept", () => {
    expect(() => canTransition("open", "accept")).toThrow("Invalid transition");
  });
});

describe("canAdminTransition", () => {
  it("moves active requests into needs review", () => {
    expect(canAdminTransition("open", "needs_review")).toBe("needs_review");
    expect(canAdminTransition("assigned", "needs_review")).toBe("needs_review");
  });

  it("requires terminal exception transitions to come from open or needs review", () => {
    expect(canAdminTransition("needs_review", "decline")).toBe("declined");
    expect(canAdminTransition("assigned", "decline")).toBe("declined");
    expect(canAdminTransition("open", "unfulfilled")).toBe("unfulfilled");
    expect(() => canAdminTransition("completed", "decline")).toThrow("Invalid admin transition");
  });

  it("reopens exception requests back to open", () => {
    expect(canAdminTransition("needs_review", "reopen")).toBe("open");
    expect(canAdminTransition("declined", "reopen")).toBe("open");
    expect(canAdminTransition("unfulfilled", "reopen")).toBe("open");
  });
});
