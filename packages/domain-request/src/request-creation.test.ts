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
        serviceAreaId: "018f5b1c-b7d0-77ef-9d47-a0a0f83d0101",
      }),
    ).toThrow(RequestCreationValidationError);
  });

  it("rejects scheduledFor on same-day requests", () => {
    expect(() =>
      assertCreateRequestInvariants({
        requestType: "same_day",
        scheduledFor: "2027-01-01T10:00:00.000Z",
        serviceAreaId: "018f5b1c-b7d0-77ef-9d47-a0a0f83d0101",
      }),
    ).toThrow("scheduledFor must be omitted for same-day requests");
  });

  it("rejects request creation outside active service areas", () => {
    expect(() =>
      assertCreateRequestInvariants({
        requestType: "same_day",
        serviceAreaId: null,
      }),
    ).toThrow("Request location is outside all active service areas");
  });

  it("accepts request creation inside an active service area", () => {
    expect(() =>
      assertCreateRequestInvariants({
        requestType: "same_day",
        serviceAreaId: "018f5b1c-b7d0-77ef-9d47-a0a0f83d0101",
      }),
    ).not.toThrow();
  });
});

describe("domain-request shared errors", () => {
  it("exports shared request errors", () => {
    expect(new RequestNotFoundError().name).toBe("RequestNotFoundError");
    expect(new RequestForbiddenError().name).toBe("RequestForbiddenError");
    expect(new RequestConflictError().name).toBe("RequestConflictError");
  });
});
