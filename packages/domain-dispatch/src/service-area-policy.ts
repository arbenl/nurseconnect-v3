import { haversineMeters, type LatLng } from "@nurseconnect/contracts";
import type { DbClient } from "@nurseconnect/database";
import { asc, eq } from "drizzle-orm";

import { serviceAreas } from "@nurseconnect/database/schema";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
type ServiceAreaDb = DbClient | Transaction;

export type ServiceArea = {
  id: string;
  label: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  status: "active" | "paused";
};

export class ServiceAreaNotFoundError extends Error {
  constructor(message = "Point is outside all active service areas") {
    super(message);
    this.name = "ServiceAreaNotFoundError";
  }
}

export function findContainingServiceArea(
  point: LatLng,
  areas: ServiceArea[],
): ServiceArea | null {
  for (const area of areas) {
    if (area.status !== "active") {
      continue;
    }

    const distanceMeters = haversineMeters(point, {
      lat: area.centerLat,
      lng: area.centerLng,
    });

    if (distanceMeters <= area.radiusMeters) {
      return area;
    }
  }

  return null;
}

export function assertPointInActiveServiceArea(
  point: LatLng,
  areas: ServiceArea[],
): ServiceArea {
  const area = findContainingServiceArea(point, areas);
  if (!area) {
    throw new ServiceAreaNotFoundError();
  }
  return area;
}

export async function getActiveServiceAreas(db: ServiceAreaDb): Promise<ServiceArea[]> {
  const rows = await db
    .select({
      id: serviceAreas.id,
      label: serviceAreas.label,
      centerLat: serviceAreas.centerLat,
      centerLng: serviceAreas.centerLng,
      radiusMeters: serviceAreas.radiusMeters,
      status: serviceAreas.status,
    })
    .from(serviceAreas)
    .where(eq(serviceAreas.status, "active"))
    .orderBy(asc(serviceAreas.label), asc(serviceAreas.id));

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    centerLat: Number(row.centerLat),
    centerLng: Number(row.centerLng),
    radiusMeters: row.radiusMeters,
    status: row.status,
  }));
}
