import { describe, expect, it } from "vitest";

import { describeEvent } from "./patient-request-copy";

describe("describeEvent", () => {
  it("describes admin exception events distinctly", () => {
    expect(describeEvent("request_needs_review")).toBe("Request under review");
    expect(describeEvent("request_declined")).toBe("Request declined");
    expect(describeEvent("request_unfulfilled")).toBe("Request could not be fulfilled");
    expect(describeEvent("request_reopened")).toBe("Request reopened");
  });
});
