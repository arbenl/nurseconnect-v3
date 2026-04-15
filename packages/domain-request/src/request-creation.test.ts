import { describe, expect, it } from "vitest";

import { RequestCreationValidationError } from "./errors";
import { assertCreateRequestInvariants } from "./request-creation";

describe("assertCreateRequestInvariants", () => {
  it("requires scheduledFor for scheduled requests", () => {
    expect(() =>
      assertCreateRequestInvariants({
        address: "123 Main Street",
        lat: 42.6629,
        lng: 21.1655,
        requestType: "scheduled",
      }),
    ).toThrow(RequestCreationValidationError);
  });

  it("rejects scheduledFor on same-day requests", () => {
    expect(() =>
      assertCreateRequestInvariants({
        address: "123 Main Street",
        lat: 42.6629,
        lng: 21.1655,
        requestType: "same_day",
        scheduledFor: "2027-01-01T10:00:00.000Z",
      }),
    ).toThrow("scheduledFor must be omitted for same-day requests");
  });
});
