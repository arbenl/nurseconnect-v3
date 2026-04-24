import { describe, expect, it } from "vitest";

import { shouldEnableVercelClientTelemetry } from "@/lib/vercel-telemetry";

describe("shouldEnableVercelClientTelemetry", () => {
  it("enables client telemetry only for Vercel production", () => {
    expect(shouldEnableVercelClientTelemetry({ VERCEL_ENV: "production" })).toBe(true);
    expect(shouldEnableVercelClientTelemetry({ VERCEL_ENV: "preview" })).toBe(false);
    expect(shouldEnableVercelClientTelemetry({ VERCEL_ENV: "development" })).toBe(false);
    expect(shouldEnableVercelClientTelemetry({ NODE_ENV: "production" })).toBe(false);
  });
});
