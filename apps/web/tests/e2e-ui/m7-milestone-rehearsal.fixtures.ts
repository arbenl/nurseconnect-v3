import { randomUUID } from "node:crypto";

import { test as base } from "@playwright/test";

import {
  resetDb,
  seedNurse,
  seedNurseLocation,
  seedReferralPartnerProfile,
} from "../e2e-utils/db";
import { createTestUser, markProfileComplete } from "../e2e-utils/helpers";

type M7MilestoneState = {
  adminEmail: string;
  nurseEmail: string;
  nurseUserId: string;
  partnerEmail: string;
  partnerUserId: string;
  patientEmail: string;
  suffix: string;
};

export const test = base.extend<{
  milestoneState: M7MilestoneState;
}>({
  milestoneState: async ({ request }, use, testInfo) => {
    await resetDb();

    const suffix = `${testInfo.workerIndex}-${testInfo.retry}-${randomUUID().slice(0, 8)}`;

    const adminEmail = `m7-admin-${suffix}@example.com`;
    await createTestUser(request, adminEmail, "M7 Admin", "admin");
    await markProfileComplete(adminEmail, {
      firstName: "M7",
      lastName: "Admin",
      phone: "555-7000",
    });

    const nurseEmail = `m7-nurse-${suffix}@example.com`;
    const { userId: nurseUserId } = await createTestUser(
      request,
      nurseEmail,
      "M7 Nurse",
      "nurse",
    );
    await markProfileComplete(nurseEmail, {
      firstName: "M7",
      lastName: "Nurse",
      phone: "555-7001",
    });
    await seedNurse({
      userId: nurseUserId,
      licenseNumber: `RN-M7-${suffix}`,
      licenseJurisdiction: "XK",
      specialization: "Launch rehearsal",
      isAvailable: true,
      status: "verified",
      licenseValidUntil: new Date(Date.now() + 86_400_000).toISOString(),
    });
    await seedNurseLocation({
      nurseUserId,
      lat: "42.6629",
      lng: "21.1655",
    });

    const partnerEmail = `m7-partner-${suffix}@example.com`;
    const { userId: partnerUserId } = await createTestUser(
      request,
      partnerEmail,
      "M7 Partner",
      "referral_partner",
    );
    await markProfileComplete(partnerEmail, {
      firstName: "M7",
      lastName: "Partner",
      phone: "555-7002",
    });
    await seedReferralPartnerProfile({
      userId: partnerUserId,
      organizationName: "M7 Launch Clinic",
      status: "active",
    });

    const patientEmail = `m7-patient-${suffix}@example.com`;
    await createTestUser(request, patientEmail, "M7 Patient", "patient");
    await markProfileComplete(patientEmail, {
      firstName: "M7",
      lastName: "Patient",
      phone: "555-7003",
      city: "Pristina",
    });

    await use({
      adminEmail,
      nurseEmail,
      nurseUserId,
      partnerEmail,
      partnerUserId,
      patientEmail,
      suffix,
    });
  },
});

export { expect } from "@playwright/test";
