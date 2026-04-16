import { describe, expect, it } from "vitest";

import {
  RequestConflictError,
  RequestCreationValidationError,
  RequestForbiddenError,
  RequestNotFoundError,
} from "./index";
import { assertCreateRequestInvariants } from "./request-creation";

describe("assertCreateRequestInvariants", () => {
  it("requires scheduledFor for scheduled requests", () => {
    expect(() =>
      assertCreateRequestInvariants({
        requestType: "scheduled",
      }),
    ).toThrow(RequestCreationValidationError);
  });

  it("rejects scheduledFor on same-day requests", () => {
    expect(() =>
      assertCreateRequestInvariants({
        requestType: "same_day",
        scheduledFor: "2027-01-01T10:00:00.000Z",
      }),
    ).toThrow("scheduledFor must be omitted for same-day requests");
  });
});

describe("domain-request shared errors", () => {
  it("exports shared request errors", () => {
    expect(new RequestNotFoundError().name).toBe("RequestNotFoundError");
    expect(new RequestForbiddenError().name).toBe("RequestForbiddenError");
    expect(new RequestConflictError().name).toBe("RequestConflictError");
  });
});
