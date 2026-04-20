import { describe, expect, it } from "vitest";

import {
  ServiceAreaNotFoundError,
  assertPointInActiveServiceArea,
  findContainingServiceArea,
} from "./service-area-policy";

const pristina = {
  id: "area-pristina",
  label: "Pristina",
  centerLat: 42.6629,
  centerLng: 21.1655,
  radiusMeters: 15_000,
  status: "active" as const,
};

describe("service area policy", () => {
  it("finds the first active service area containing the point", () => {
    expect(
      findContainingServiceArea(
        { lat: 42.663, lng: 21.166 },
        [
          pristina,
          { ...pristina, id: "area-overlap", label: "Overlap" },
        ],
      )?.id,
    ).toBe("area-pristina");
  });

  it("includes points exactly on the radius boundary", () => {
    expect(
      findContainingServiceArea(
        { lat: 42.797798, lng: 21.1655 },
        [pristina],
      )?.id,
    ).toBe("area-pristina");
  });

  it("skips paused areas and returns null outside active coverage", () => {
    expect(
      findContainingServiceArea(
        { lat: 42.663, lng: 21.166 },
        [{ ...pristina, status: "paused" }],
      ),
    ).toBeNull();

    expect(
      findContainingServiceArea(
        { lat: 41.3275, lng: 19.8187 },
        [pristina],
      ),
    ).toBeNull();
  });

  it("throws a typed error when a point is outside all active service areas", () => {
    expect(() =>
      assertPointInActiveServiceArea(
        { lat: 41.3275, lng: 19.8187 },
        [pristina],
      ),
    ).toThrow(ServiceAreaNotFoundError);
  });
});
