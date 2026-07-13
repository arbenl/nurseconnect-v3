import { db } from "./db";
import {
  assignments,
  branches,
  nursePayouts,
  nurses,
  organizations,
  patients,
  paymentAuthorizations,
  requestEvents,
  serviceRequests,
  users,
  visits,
} from "./schema";

export const primaryOrganizationId = "00000000-0000-4000-8000-000000000001";
export const branchId = "00000000-0000-4000-8000-000000000101";
export const otherOrganizationId = "33333333-3333-4333-8333-333333333333";

export async function seedTenantBackfillFixture() {
  const { patientUserId, nurseUserId } = await seedTenantParents();
  await db.insert(patients).values({ userId: patientUserId, organizationId: null });
  const nurse = await seedNurse(nurseUserId);
  const [request] = await db.insert(serviceRequests).values({
    patientUserId,
    organizationId: null,
    branchId: null,
    address: "Synthetic Test Address",
    lat: "0.000000",
    lng: "0.000000",
  }).returning();
  const [assignment] = await db.insert(assignments).values({
    requestId: request!.id,
    nurseId: nurse!.id,
    organizationId: null,
    status: "assigned",
  }).returning();
  await db.insert(visits).values({
    assignmentId: assignment!.id,
    organizationId: null,
    branchId: null,
  });
  await db.insert(requestEvents).values({
    requestId: request!.id,
    organizationId: null,
    type: "request_created",
  });
  await db.insert(paymentAuthorizations).values({
    requestId: request!.id,
    organizationId: null,
    patientUserId,
    amountCents: 100,
    currency: "USD",
  });
  await db.insert(nursePayouts).values({
    requestId: request!.id,
    organizationId: null,
    nurseUserId,
    amountCents: 100,
    currency: "USD",
  });
}

async function seedNurse(userId: string) {
  const [nurse] = await db.insert(nurses).values({ userId }).returning();
  return nurse!;
}

export async function seedOwnedRequest(useUnexpectedTenant = false) {
  const { patientUserId } = await seedTenantParents();
  const [request] = await db.insert(serviceRequests).values({
    patientUserId,
    organizationId: useUnexpectedTenant ? otherOrganizationId : primaryOrganizationId,
    branchId,
    address: "Synthetic Test Address",
    lat: "0.000000",
    lng: "0.000000",
  }).returning();
  return request!.id;
}

async function seedTenantParents() {
  await db.insert(organizations).values([
    { id: primaryOrganizationId, name: "Primary Test Org", slug: "primary-test-org" },
    { id: otherOrganizationId, name: "Other Test Org", slug: "other-test-org" },
  ]);
  await db.insert(branches).values({
    id: branchId,
    organizationId: primaryOrganizationId,
    name: "Primary Test Branch",
    slug: "primary-test-branch",
    jurisdictionCountry: "US",
    jurisdictionRegion: "test-region",
  });
  const [patientUser, nurseUser] = await db.insert(users).values([
    { email: "tenant-backfill-patient@test.local", role: "patient" },
    { email: "tenant-backfill-nurse@test.local", role: "nurse" },
  ]).returning();
  return { patientUserId: patientUser!.id, nurseUserId: nurseUser!.id };
}
