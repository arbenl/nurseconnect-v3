import { describe, expect, it } from "vitest";

import { canTransition, transitionStatus } from "./request-lifecycle";

const context = { requestId: "request-1", actorUserId: "actor-1" };

describe("canTransition", () => {
  it("allows assigned -> accepted", () => {
    expect(transitionStatus(canTransition("assigned", "accept", context))).toBe("accepted");
  });

  it("allows accepted -> enroute -> completed", () => {
    expect(transitionStatus(canTransition("accepted", "enroute", context))).toBe("enroute");
    expect(transitionStatus(canTransition("enroute", "complete", context))).toBe("completed");
  });

  it("allows patient cancel from open/assigned/accepted", () => {
    expect(transitionStatus(canTransition("open", "cancel", context))).toBe("canceled");
    expect(transitionStatus(canTransition("assigned", "cancel", context))).toBe("canceled");
    expect(transitionStatus(canTransition("accepted", "cancel", context))).toBe("canceled");
  });

  it("reject action returns request back to open", () => {
    expect(transitionStatus(canTransition("assigned", "reject", context))).toBe("open");
    expect(transitionStatus(canTransition("accepted", "reject", context))).toBe("open");
  });

  it("throws on invalid transition", () => {
    expect(() => canTransition("open", "accept", context)).toThrow(/Invalid transition/i);
    expect(() => canTransition("completed", "cancel", context)).toThrow(/Invalid transition/i);
  });
});
