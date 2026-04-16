import { describe, expect, it } from "vitest";

import { CreateRequestSchema } from "../../src/requests";

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
});
