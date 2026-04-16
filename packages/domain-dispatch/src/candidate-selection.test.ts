import { describe, expect, it } from "vitest";

import { pickDispatchCandidate } from "./candidate-selection";

describe("pickDispatchCandidate", () => {
  it("returns null when no candidate rows exist", () => {
    expect(pickDispatchCandidate([], { lat: 42.6629, lng: 21.1655 })).toBeNull();
  });

  it("chooses the nearest candidate", () => {
    const picked = pickDispatchCandidate(
      [
        { nurseUserId: "nurse-b", lat: "43.000000", lng: "21.000000" },
        { nurseUserId: "nurse-a", lat: "42.662901", lng: "21.165501" },
      ],
      { lat: 42.6629, lng: 21.1655 },
    );

    expect(picked?.nurseUserId).toBe("nurse-a");
  });

  it("breaks equal-distance ties by nurse user id", () => {
    const picked = pickDispatchCandidate(
      [
        { nurseUserId: "nurse-z", lat: "42.700000", lng: "21.200000" },
        { nurseUserId: "nurse-a", lat: "42.700000", lng: "21.200000" },
      ],
      { lat: 42.6629, lng: 21.1655 },
    );

    expect(picked?.nurseUserId).toBe("nurse-a");
  });
});
