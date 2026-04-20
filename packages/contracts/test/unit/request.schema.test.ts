import { describe, expect, it } from "vitest";

import {
  AdminExceptionQueueResponseSchema,
  AdminTriageRequestSchema,
  CreateRequestSchema,
  RequestStatusInfo,
} from "../../src/requests";

describe("request contracts", () => {
  it("accepts a scheduled request without scheduledFor at the transport layer", () => {
    const result = CreateRequestSchema.safeParse({
      address: "123 Main Street",
      lat: 42.6629,
      lng: 21.1655,
      requestType: "scheduled",
    });

    expect(result.success).toBe(true);
  });

  it("accepts scheduledFor on same-day requests at the transport layer", () => {
    const result = CreateRequestSchema.safeParse({
      address: "123 Main Street",
      lat: 42.6629,
      lng: 21.1655,
      requestType: "same_day",
      scheduledFor: "2027-01-01T10:00:00.000Z",
    });

    expect(result.success).toBe(true);
  });

  it("accepts a scheduled request with a scheduled timestamp", () => {
    const result = CreateRequestSchema.safeParse({
      address: "123 Main Street",
      lat: 42.6629,
      lng: 21.1655,
      requestType: "scheduled",
      scheduledFor: "2027-01-01T10:00:00.000Z",
    });

    expect(result.success).toBe(true);
  });

  it("accepts explicit admin exception statuses", () => {
    expect(RequestStatusInfo.parse("needs_review")).toBe("needs_review");
    expect(RequestStatusInfo.parse("declined")).toBe("declined");
    expect(RequestStatusInfo.parse("unfulfilled")).toBe("unfulfilled");
  });

  it("requires reasons for terminal admin exception actions", () => {
    expect(AdminTriageRequestSchema.safeParse({ action: "decline" }).success).toBe(false);
    expect(AdminTriageRequestSchema.safeParse({ action: "unfulfilled", reason: "no" }).success).toBe(false);
    expect(AdminTriageRequestSchema.parse({ action: "decline", reason: "Outside clinical scope" })).toEqual({
      action: "decline",
      reason: "Outside clinical scope",
    });
  });

  it("parses the admin exception queue response", () => {
    const parsed = AdminExceptionQueueResponseSchema.parse({
      generatedAt: "2026-04-20T00:00:00.000Z",
      items: [
        {
          requestId: "11111111-1111-4111-8111-111111111111",
          status: "unfulfilled",
          reason: "No verified nurse capacity",
          waitMinutes: 45,
          requestType: "same_day",
          referralSource: "partner",
          partnerLabel: "North Clinic",
          careType: "wound care",
          locationHint: "~42.66,21.17",
          actorUserId: "22222222-2222-4222-8222-222222222222",
          createdAt: "2026-04-20T00:00:00.000Z",
          updatedAt: "2026-04-20T00:45:00.000Z",
          lastEventAt: "2026-04-20T00:45:00.000Z",
        },
      ],
    });

    expect(parsed.items[0]?.reason).toBe("No verified nurse capacity");
  });
});
