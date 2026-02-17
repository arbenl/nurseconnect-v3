// packages/contracts/src/geo/haversine.test.ts
import { describe, expect, it } from "vitest";
import { haversineMeters } from "./haversine";

describe("haversineMeters", () => {
    it("returns 0 for identical points", () => {
        expect(haversineMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 0 })).toBe(0);
    });

    it("is symmetric", () => {
        const a = { lat: 42.6629, lng: 21.1655 };
        const b = { lat: 42.6639, lng: 21.1755 };
        const ab = haversineMeters(a, b);
        const ba = haversineMeters(b, a);
        expect(Math.abs(ab - ba)).toBeLessThan(1e-9);
    });

    it("reasonable distance for nearby points", () => {
        // ~0.001 degrees lat ≈ 111m (roughly)
        const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 0.001, lng: 0 });
        expect(d).toBeGreaterThan(90);
        expect(d).toBeLessThan(140);
    });
});
