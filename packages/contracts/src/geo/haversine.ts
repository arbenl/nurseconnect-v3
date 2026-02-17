// packages/contracts/src/geo/haversine.ts
export type LatLng = { lat: number; lng: number };

/**
 * Calculate distance between two lat/lng points using the Haversine formula.
 * Uses Earth mean radius of 6,371 km.
 * @returns distance in meters
 */
export function haversineMeters(a: LatLng, b: LatLng): number {
    const R = 6371000; // Earth mean radius in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);

    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);

    const h =
        sinDLat * sinDLat +
        Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    return R * c;
}
