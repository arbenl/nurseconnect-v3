import { describe, expect, it } from "vitest";

import { canTransition } from "./request-lifecycle";
import { requestStatusUpdate } from "./request-status-update";

const context = { requestId: "request-1", actorUserId: "actor-1" };

describe("requestStatusUpdate", () => {
  it("binds transition proof to persistence context", () => {
    const transition = canTransition("assigned", "accept", context);
    const update = requestStatusUpdate(transition, {
      ...context,
      fromStatus: "assigned",
      toStatus: "accepted",
    });

    expect(update).toMatchObject({ status: "accepted" });
    expect(Object.isFrozen(update)).toBe(true);
  });

  it("prevents post-proof status mutation", () => {
    const transition = canTransition("assigned", "accept", context);
    const update = requestStatusUpdate(transition, {
      ...context,
      fromStatus: "assigned",
      toStatus: "accepted",
    });

    expect(() => {
      (update as { status: string }).status = "completed";
    }).toThrow();
    expect(update.status).toBe("accepted");
  });

  it("rejects proof mismatches before persistence", () => {
    const transition = canTransition("assigned", "accept", context);
    const expected = { ...context, fromStatus: "assigned" as const };

    expect(() => requestStatusUpdate(transition, {
      ...expected,
      requestId: "request-2",
    })).toThrow("proof does not match");
    expect(() => requestStatusUpdate(transition, {
      ...expected,
      actorUserId: "actor-2",
    })).toThrow("proof does not match");
    expect(() => requestStatusUpdate(transition, {
      ...expected,
      fromStatus: "open",
    })).toThrow("proof does not match");
    expect(() => requestStatusUpdate(transition, {
      ...expected,
      toStatus: "completed",
    })).toThrow("proof does not match");
  });
});
