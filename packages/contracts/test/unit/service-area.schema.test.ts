import {
  AdminServiceAreaListResponseSchema,
  CreateServiceAreaSchema,
  ServiceAreaSchema,
  UpdateServiceAreaSchema,
} from "../../src/service-areas";
import { NurseLocationUpdateResponseSchema } from "../../src/location";

describe("service area contracts", () => {
  it("accepts launch service area DTOs and admin list responses", () => {
    const area = ServiceAreaSchema.parse({
      id: "018f5b1c-b7d0-77ef-9d47-a0a0f83d0101",
      label: "Pristina",
      centerLat: "42.662900",
      centerLng: "21.165500",
      radiusMeters: 15000,
      status: "active",
      createdAt: "2026-04-20T12:00:00.000Z",
      updatedAt: "2026-04-20T12:00:00.000Z",
    });

    expect(AdminServiceAreaListResponseSchema.parse({ items: [area] })).toEqual({
      items: [area],
    });
  });

  it("validates create and non-empty update payloads", () => {
    expect(
      CreateServiceAreaSchema.parse({
        label: "Tirana Metro",
        centerLat: 41.3275,
        centerLng: 19.8187,
        radiusMeters: 25000,
      }),
    ).toMatchObject({ label: "Tirana Metro" });

    expect(() =>
      CreateServiceAreaSchema.parse({
        label: "Tiny",
        centerLat: 41.3275,
        centerLng: 19.8187,
        radiusMeters: 499,
      }),
    ).toThrow();

    expect(() => UpdateServiceAreaSchema.parse({})).toThrow();
  });

  it("includes serviceAreaId on nurse location update responses", () => {
    expect(
      NurseLocationUpdateResponseSchema.parse({
        ok: true,
        throttled: false,
        lastUpdated: "2026-04-20T12:00:00.000Z",
        serviceAreaId: "018f5b1c-b7d0-77ef-9d47-a0a0f83d0101",
      }),
    ).toMatchObject({
      ok: true,
      serviceAreaId: "018f5b1c-b7d0-77ef-9d47-a0a0f83d0101",
    });

    expect(
      NurseLocationUpdateResponseSchema.parse({
        ok: true,
        throttled: false,
        lastUpdated: "2026-04-20T12:00:00.000Z",
        serviceAreaId: null,
      }),
    ).toMatchObject({ serviceAreaId: null });
  });
});
