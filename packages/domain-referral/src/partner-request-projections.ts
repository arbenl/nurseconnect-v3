import type { DbClient } from "@nurseconnect/database";
import { and, desc, eq, schema } from "@nurseconnect/database";

import { ReferralPartnerNotFoundError } from "./errors";
import { assertReferralPartnerActive, getReferralPartnerProfileByUserId } from "./partner-profile";
import { toPartnerRequestStatus, type PartnerRequestStatus } from "./partner-status";

const { serviceRequests, users } = schema;

export type PartnerRequestListItem = {
  id: string;
  status: PartnerRequestStatus;
  address: string;
  requestType: "scheduled" | "same_day";
  scheduledFor: string | null;
  careType: string | null;
  createdAt: string;
  patient: {
    firstName: string | null;
    lastName: string | null;
  };
};

export type PartnerRequestDetail = PartnerRequestListItem & {
  patient: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    city: string | null;
  };
};

function normalizeRequestType(value: string): "scheduled" | "same_day" {
  return value === "scheduled" ? "scheduled" : "same_day";
}

async function assertActivePartnerActor(db: DbClient, actorUserId: string) {
  const profile = await getReferralPartnerProfileByUserId({ userId: actorUserId }, db);
  assertReferralPartnerActive(profile.status);
}

export async function listPartnerRequests(
  db: DbClient,
  input: { actorUserId: string },
): Promise<PartnerRequestListItem[]> {
  await assertActivePartnerActor(db, input.actorUserId);

  const rows = await db
    .select({
      id: serviceRequests.id,
      status: serviceRequests.status,
      address: serviceRequests.address,
      requestType: serviceRequests.requestType,
      scheduledFor: serviceRequests.scheduledFor,
      careType: serviceRequests.careType,
      createdAt: serviceRequests.createdAt,
      patientFirstName: users.firstName,
      patientLastName: users.lastName,
    })
    .from(serviceRequests)
    .innerJoin(users, eq(users.id, serviceRequests.patientUserId))
    .where(eq(serviceRequests.referralPartnerId, input.actorUserId))
    .orderBy(desc(serviceRequests.createdAt));

  return rows.map((row) => ({
    id: row.id,
    status: toPartnerRequestStatus(row.status),
    address: row.address,
    requestType: normalizeRequestType(row.requestType),
    scheduledFor: row.scheduledFor?.toISOString() ?? null,
    careType: row.careType,
    createdAt: row.createdAt.toISOString(),
    patient: {
      firstName: row.patientFirstName,
      lastName: row.patientLastName,
    },
  }));
}

export async function getPartnerRequestDetail(
  db: DbClient,
  input: { actorUserId: string; requestId: string },
): Promise<PartnerRequestDetail> {
  await assertActivePartnerActor(db, input.actorUserId);

  const [row] = await db
    .select({
      id: serviceRequests.id,
      status: serviceRequests.status,
      address: serviceRequests.address,
      requestType: serviceRequests.requestType,
      scheduledFor: serviceRequests.scheduledFor,
      careType: serviceRequests.careType,
      createdAt: serviceRequests.createdAt,
      patientFirstName: users.firstName,
      patientLastName: users.lastName,
      patientPhone: users.phone,
      patientCity: users.city,
    })
    .from(serviceRequests)
    .innerJoin(users, eq(users.id, serviceRequests.patientUserId))
    .where(
      and(
        eq(serviceRequests.id, input.requestId),
        eq(serviceRequests.referralPartnerId, input.actorUserId),
      ),
    );

  if (!row) {
    throw new ReferralPartnerNotFoundError("Partner request not found");
  }

  return {
    id: row.id,
    status: toPartnerRequestStatus(row.status),
    address: row.address,
    requestType: normalizeRequestType(row.requestType),
    scheduledFor: row.scheduledFor?.toISOString() ?? null,
    careType: row.careType,
    createdAt: row.createdAt.toISOString(),
    patient: {
      firstName: row.patientFirstName,
      lastName: row.patientLastName,
      phone: row.patientPhone,
      city: row.patientCity,
    },
  };
}
