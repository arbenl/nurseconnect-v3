import { describe, expect, it } from "vitest";

import { canTransition } from "./request-lifecycle";

describe("canTransition", () => {
  it("moves assigned to accepted on accept", () => {
    expect(canTransition("assigned", "accept")).toBe("accepted");
  });

  it("throws on invalid open to accept", () => {
    expect(() => canTransition("open", "accept")).toThrow("Invalid transition");
  });
});
