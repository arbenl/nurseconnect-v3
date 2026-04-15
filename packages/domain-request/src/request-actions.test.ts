import { describe, expect, it } from "vitest";

import type { RequestSideEffect } from "./request-actions";

describe("RequestSideEffect", () => {
  it("supports nurse availability side effects", () => {
    const effect: RequestSideEffect = {
      type: "set-nurse-availability",
      userId: "nurse-user-id",
      isAvailable: true,
    };

    expect(effect).toEqual({
      type: "set-nurse-availability",
      userId: "nurse-user-id",
      isAvailable: true,
    });
  });
});
