import { describe, expect, it } from "vitest";

import { assertCanSetSelfAvailability } from "./availability-policy";

describe("domain-nurse scaffold", () => {
  it("exports nurse availability policy", () => {
    expect(assertCanSetSelfAvailability).toBeTypeOf("function");
  });
});
