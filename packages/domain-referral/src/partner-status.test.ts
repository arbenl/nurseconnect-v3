import { describe, expect, it } from "vitest";

import { toPartnerRequestStatus } from "./partner-status";

describe("partner request status mapping", () => {
  it("maps open requests to received", () => {
    expect(toPartnerRequestStatus("open")).toBe("received");
  });

  it("maps active fulfillment states to scheduled", () => {
    expect(toPartnerRequestStatus("assigned")).toBe("scheduled");
    expect(toPartnerRequestStatus("accepted")).toBe("scheduled");
    expect(toPartnerRequestStatus("enroute")).toBe("scheduled");
  });

  it("maps terminal outcomes cleanly", () => {
    expect(toPartnerRequestStatus("completed")).toBe("completed");
    expect(toPartnerRequestStatus("canceled")).toBe("could_not_fulfill");
    expect(toPartnerRequestStatus("rejected")).toBe("could_not_fulfill");
  });

  it("throws for unexpected runtime statuses", () => {
    expect(() => toPartnerRequestStatus("paused" as never)).toThrow(
      "Unsupported request status: paused",
    );
  });
});
