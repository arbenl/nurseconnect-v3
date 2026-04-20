import { describe, expect, it } from "vitest";

import { getStatusCopy } from "./patient-request-copy";

describe("getStatusCopy", () => {
  it("describes admin exception statuses distinctly", () => {
    expect(getStatusCopy("needs_review")).toBe("Request is under review");
    expect(getStatusCopy("declined")).toBe("Request declined");
    expect(getStatusCopy("unfulfilled")).toBe("Request could not be fulfilled");
  });
});
