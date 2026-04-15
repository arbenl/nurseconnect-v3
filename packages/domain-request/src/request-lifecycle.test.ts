import { describe, expect, it } from "vitest";

describe("domain-request scaffold", () => {
  it("can import request status contracts", async () => {
    const contracts = await import("@nurseconnect/contracts");

    expect(contracts).toHaveProperty("RequestStatusInfo");
  });
});
