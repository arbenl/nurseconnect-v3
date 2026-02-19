import { describe, expect, it } from "vitest";

import { canTransition } from "./request-lifecycle";

describe("canTransition", () => {
  it("allows assigned -> accepted", () => {
    expect(canTransition("assigned", "accept")).toBe("accepted");
  });

  it("allows accepted -> enroute -> completed", () => {
    expect(canTransition("accepted", "enroute")).toBe("enroute");
    expect(canTransition("enroute", "complete")).toBe("completed");
  });

  it("allows patient cancel from open/assigned/accepted", () => {
    expect(canTransition("open", "cancel")).toBe("canceled");
    expect(canTransition("assigned", "cancel")).toBe("canceled");
    expect(canTransition("accepted", "cancel")).toBe("canceled");
  });

  it("reject action returns request back to open", () => {
    expect(canTransition("assigned", "reject")).toBe("open");
    expect(canTransition("accepted", "reject")).toBe("open");
  });

  it("throws on invalid transition", () => {
    expect(() => canTransition("open", "accept")).toThrow(/Invalid transition/i);
    expect(() => canTransition("completed", "cancel")).toThrow(/Invalid transition/i);
  });
});
