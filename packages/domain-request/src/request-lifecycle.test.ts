import { describe, expect, it } from "vitest";

import { canAdminTransition, canTransition, transitionStatus } from "./request-lifecycle";

const context = { requestId: "request-1", actorUserId: "actor-1" };

describe("canTransition", () => {
  it("moves assigned to accepted on accept", () => {
    const transition = canTransition("assigned", "accept", context);

    expect(transitionStatus(transition)).toBe("accepted");
    expect(transition).toMatchObject({
      requestId: "request-1",
      actorUserId: "actor-1",
      fromStatus: "assigned",
      toStatus: "accepted",
    });
  });

  it("throws on invalid open to accept", () => {
    expect(() => canTransition("open", "accept", context)).toThrow("Invalid transition");
  });

  it("rejects plain or serialized transition-shaped objects", () => {
    const transition = canTransition("assigned", "accept", context);
    expect(Object.isFrozen(transition)).toBe(true);
    const forged = {
      requestId: "request-1",
      actorUserId: "actor-1",
      action: "accept",
      fromStatus: "assigned",
      toStatus: "accepted",
    };
    const spread = { ...transition };
    spread.toStatus = "completed";

    expect(() => transitionStatus(forged as typeof transition)).toThrow("Invalid AuthorizedTransition");
    expect(() => transitionStatus(spread as typeof transition)).toThrow("Invalid AuthorizedTransition");
    expect(() => transitionStatus(JSON.parse(JSON.stringify(transition)))).toThrow("Invalid AuthorizedTransition");
  });
});

describe("canAdminTransition", () => {
  it("moves active requests into needs review", () => {
    expect(transitionStatus(canAdminTransition("open", "needs_review", context))).toBe("needs_review");
    expect(transitionStatus(canAdminTransition("assigned", "needs_review", context))).toBe("needs_review");
  });

  it("requires terminal exception transitions to come from open or needs review", () => {
    expect(transitionStatus(canAdminTransition("needs_review", "decline", context))).toBe("declined");
    expect(transitionStatus(canAdminTransition("assigned", "decline", context))).toBe("declined");
    expect(transitionStatus(canAdminTransition("open", "unfulfilled", context))).toBe("unfulfilled");
    expect(transitionStatus(canAdminTransition("assigned", "unfulfilled", context))).toBe("unfulfilled");
    expect(() => canAdminTransition("completed", "decline", context)).toThrow("Invalid admin transition");
  });

  it("reopens exception requests back to open", () => {
    expect(transitionStatus(canAdminTransition("needs_review", "reopen", context))).toBe("open");
    expect(transitionStatus(canAdminTransition("declined", "reopen", context))).toBe("open");
    expect(transitionStatus(canAdminTransition("unfulfilled", "reopen", context))).toBe("open");
  });
});
