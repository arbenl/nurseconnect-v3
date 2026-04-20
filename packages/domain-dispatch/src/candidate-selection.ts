import type { DbClient } from "@nurseconnect/database";
import { haversineMeters } from "@nurseconnect/contracts";
import { sql } from "drizzle-orm";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

export type CandidateRow = {
  nurseUserId: string;
  lat: string;
  lng: string;
};

export function pickDispatchCandidate(
  rows: CandidateRow[],
  origin: { lat: number; lng: number },
) {
  if (rows.length === 0) {
    return null;
  }

  const ranked = rows
    .map((row) => ({
      row,
      meters: haversineMeters(origin, {
        lat: Number(row.lat),
        lng: Number(row.lng),
      }),
    }))
    .sort((a, b) => {
      if (a.meters !== b.meters) {
        return a.meters - b.meters;
      }

      return a.row.nurseUserId.localeCompare(b.row.nurseUserId);
    });

  return ranked[0]?.row ?? null;
}

export async function selectDispatchCandidate(
  tx: Transaction,
  origin: { lat: number; lng: number },
  serviceAreaId: string,
) {
  const rows = await tx.execute<{
    nurse_user_id: string;
    lat: string;
    lng: string;
  }>(sql`
    SELECT nl.nurse_user_id, nl.lat::text as lat, nl.lng::text as lng
    FROM nurse_locations nl
    JOIN nurses n ON n.user_id = nl.nurse_user_id
    JOIN users u ON u.id = nl.nurse_user_id
    WHERE n.is_available = true
      AND u.role = 'nurse'
      AND n.status = 'verified'
      AND (n.license_valid_until IS NULL OR n.license_valid_until > NOW())
      AND nl.service_area_id = ${serviceAreaId}::uuid
    FOR UPDATE OF nl SKIP LOCKED
  `);

  return pickDispatchCandidate(
    rows.rows.map((row) => ({
      nurseUserId: row.nurse_user_id,
      lat: row.lat,
      lng: row.lng,
    })),
    origin,
  );
}
