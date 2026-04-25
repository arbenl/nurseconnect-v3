import { db, schema, sql } from "@nurseconnect/database";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { getAdminOpsStatus } from "./ops-status";
import { DEFAULT_TRIAGE_SEVERITY_POLICY } from "./triage-severity";

const {
  adminAuditLogs,
  nurseLocations,
  nursePayouts,
  nurses,
  paymentAuthorizations,
  requestEvents,
  serviceAreas,
  serviceRequests,
  users,
} = schema;

describe.sequential("admin ops status", () => {
  const now = new Date("2026-04-21T10:00:00.000Z");

  beforeAll(async () => {
    await db.execute(sql`SELECT 1`);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE nurse_payouts RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE payment_authorizations RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE service_request_events RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE admin_audit_logs RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE service_requests RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nurse_locations RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE service_areas RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nurses RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  });

  it("returns launch monitoring counts with strict nurse supply and payment gap semantics", async () => {
    const [patient, nurse, admin, verifiedUnavailable, submittedAvailable] = await db
      .insert(users)
      .values([
        { email: "ops-patient@test.local", role: "patient" },
        { email: "ops-nurse@test.local", role: "nurse" },
        { email: "ops-admin@test.local", role: "admin" },
        { email: "ops-verified-unavailable@test.local", role: "nurse" },
        { email: "ops-submitted-available@test.local", role: "patient" },
      ])
      .returning();

    await db.insert(nurses).values([
      {
        userId: nurse!.id,
        status: "verified",
        licenseNumber: "RN-OPS-001",
        licenseJurisdiction: "CA",
        specialization: "ICU",
        licenseValidUntil: new Date("2027-12-31T00:00:00.000Z"),
        isAvailable: true,
      },
      {
        userId: verifiedUnavailable!.id,
        status: "verified",
        licenseNumber: "RN-OPS-002",
        licenseJurisdiction: "CA",
        specialization: "ER",
        licenseValidUntil: new Date("2027-12-31T00:00:00.000Z"),
        isAvailable: false,
      },
      {
        userId: submittedAvailable!.id,
        status: "submitted",
        licenseNumber: "RN-OPS-003",
        licenseJurisdiction: "CA",
        specialization: "General",
        isAvailable: true,
      },
    ]);

    const [activeArea] = await db
      .insert(serviceAreas)
      .values({
        label: "Ops Launch Area",
        centerLat: "42.662900",
        centerLng: "21.165500",
        radiusMeters: 15000,
        status: "active",
      })
      .returning();
    await db.insert(serviceAreas).values({
      label: "Paused Area",
      centerLat: "42.662900",
      centerLng: "21.165500",
      radiusMeters: 15000,
      status: "paused",
    });
    await db.insert(nurseLocations).values({
      nurseUserId: nurse!.id,
      lat: "42.662900",
      lng: "21.165500",
      serviceAreaId: activeArea!.id,
      lastUpdated: now,
    });

    const staleMinutes =
      DEFAULT_TRIAGE_SEVERITY_POLICY.staleEventThresholdMinutes + 5;
    const staleEventAt = new Date(now.getTime() - staleMinutes * 60_000);

    const [openUnassigned, staleAssigned, staleEnroute, exception, authorizedGap, capturedWithPayout, voidedGap, failedGap] =
      await db
        .insert(serviceRequests)
        .values([
          {
            patientUserId: patient!.id,
            status: "open",
            address: "Unassigned St",
            lat: "42.662900",
            lng: "21.165500",
            serviceAreaId: activeArea!.id,
          },
          {
            patientUserId: patient!.id,
            assignedNurseUserId: nurse!.id,
            status: "assigned",
            address: "Stale Assigned St",
            lat: "42.662900",
            lng: "21.165500",
            serviceAreaId: activeArea!.id,
          },
          {
            patientUserId: patient!.id,
            assignedNurseUserId: nurse!.id,
            status: "enroute",
            address: "Stale Enroute St",
            lat: "42.662900",
            lng: "21.165500",
            serviceAreaId: activeArea!.id,
          },
          {
            patientUserId: patient!.id,
            status: "needs_review",
            address: "Exception St",
            lat: "42.662900",
            lng: "21.165500",
            serviceAreaId: activeArea!.id,
          },
          {
            patientUserId: patient!.id,
            assignedNurseUserId: nurse!.id,
            status: "completed",
            address: "Authorized Gap St",
            lat: "42.662900",
            lng: "21.165500",
            serviceAreaId: activeArea!.id,
          },
          {
            patientUserId: patient!.id,
            assignedNurseUserId: nurse!.id,
            status: "completed",
            address: "Captured With Payout St",
            lat: "42.662900",
            lng: "21.165500",
            serviceAreaId: activeArea!.id,
          },
          {
            patientUserId: patient!.id,
            assignedNurseUserId: nurse!.id,
            status: "completed",
            address: "Voided Gap St",
            lat: "42.662900",
            lng: "21.165500",
            serviceAreaId: activeArea!.id,
          },
          {
            patientUserId: patient!.id,
            assignedNurseUserId: nurse!.id,
            status: "completed",
            address: "Failed Gap St",
            lat: "42.662900",
            lng: "21.165500",
            serviceAreaId: activeArea!.id,
          },
        ])
        .returning();

    await db.insert(requestEvents).values([
      {
        requestId: staleAssigned!.id,
        type: "request_assigned",
        toStatus: "assigned",
        createdAt: staleEventAt,
      },
      {
        requestId: staleEnroute!.id,
        type: "request_enroute",
        toStatus: "enroute",
        createdAt: staleEventAt,
      },
    ]);

    await db.insert(paymentAuthorizations).values([
      {
        requestId: authorizedGap!.id,
        patientUserId: patient!.id,
        status: "authorized",
        amountCents: 10000,
        currency: "USD",
      },
      {
        requestId: capturedWithPayout!.id,
        patientUserId: patient!.id,
        status: "captured",
        amountCents: 10000,
        currency: "USD",
      },
      {
        requestId: voidedGap!.id,
        patientUserId: patient!.id,
        status: "voided",
        amountCents: 10000,
        currency: "USD",
      },
      {
        requestId: failedGap!.id,
        patientUserId: patient!.id,
        status: "failed",
        amountCents: 10000,
        currency: "USD",
      },
    ]);

    await db.insert(nursePayouts).values({
      requestId: capturedWithPayout!.id,
      nurseUserId: nurse!.id,
      status: "owed",
      amountCents: 8000,
      currency: "USD",
    });

    await db.insert(adminAuditLogs).values([
      {
        actorUserId: admin!.id,
        action: "payment.authorization.failed",
        targetEntityType: "request",
        targetEntityId: failedGap!.id,
        createdAt: new Date(now.getTime() - 60_000),
      },
      {
        actorUserId: admin!.id,
        action: "payout.failed",
        targetEntityType: "request",
        targetEntityId: capturedWithPayout!.id,
        createdAt: new Date(now.getTime() - 60_000),
      },
      {
        actorUserId: admin!.id,
        action: "payment.authorization.failed",
        targetEntityType: "request",
        targetEntityId: openUnassigned!.id,
        createdAt: new Date(now.getTime() - 25 * 60 * 60_000),
      },
    ]);

    await expect(getAdminOpsStatus({ now })).resolves.toMatchObject({
      generatedAt: now.toISOString(),
      serviceAreas: { active: 1 },
      nurseSupply: {
        verifiedAndAvailable: 1,
        launchMinimum: 10,
        launchShortfall: 9,
        launchReady: false,
        launchServiceAreaCount: 1,
        launchLowestServiceAreaSupply: 1,
        launchServiceAreasBelowMinimum: 1,
      },
      requests: {
        unassigned: 1,
        staleAssigned: 1,
        staleEnroute: 1,
        exceptionQueue: 1,
      },
      payments: {
        authorizationsWithoutPayout: 1,
        recentFailedAuthorizations: 1,
        recentFailedPayouts: 1,
      },
    });
  });

  it("counts only dispatch-eligible nurses in active launch service areas", async () => {
    const [activeArea] = await db
      .insert(serviceAreas)
      .values({
        label: "Ops Launch Area",
        centerLat: "42.662900",
        centerLng: "21.165500",
        radiusMeters: 15000,
        status: "active",
      })
      .returning();
    const [pausedArea] = await db
      .insert(serviceAreas)
      .values({
        label: "Paused Area",
        centerLat: "42.662900",
        centerLng: "21.165500",
        radiusMeters: 15000,
        status: "paused",
      })
      .returning();

    const eligibleUsers = await db
      .insert(users)
      .values(
        Array.from({ length: 10 }, (_, index) => ({
          email: `ops-launch-eligible-${index}@test.local`,
          role: "nurse" as const,
        })),
      )
      .returning();
    const [expiredUser, noLocationUser, outOfAreaUser, nonNurseUser] = await db
      .insert(users)
      .values([
        { email: "ops-launch-expired@test.local", role: "nurse" },
        { email: "ops-launch-no-location@test.local", role: "nurse" },
        { email: "ops-launch-out-of-area@test.local", role: "nurse" },
        { email: "ops-launch-non-nurse@test.local", role: "patient" },
      ])
      .returning();
    const allNurseUsers = [
      ...eligibleUsers,
      expiredUser!,
      noLocationUser!,
      outOfAreaUser!,
      nonNurseUser!,
    ];

    await db.insert(nurses).values(
      allNurseUsers.map((user, index) => ({
        userId: user.id,
        status: "verified" as const,
        licenseNumber: `RN-OPS-LAUNCH-${index}`,
        licenseJurisdiction: "XK",
        specialization: "General",
        licenseValidUntil:
          user.id === expiredUser!.id
            ? new Date("2020-01-01T00:00:00.000Z")
            : new Date("2027-12-31T00:00:00.000Z"),
        isAvailable: true,
      })),
    );
    await db.insert(nurseLocations).values([
      ...eligibleUsers.map((user) => ({
        nurseUserId: user.id,
        lat: "42.662900",
        lng: "21.165500",
        serviceAreaId: activeArea!.id,
        lastUpdated: now,
      })),
      {
        nurseUserId: expiredUser!.id,
        lat: "42.662900",
        lng: "21.165500",
        serviceAreaId: activeArea!.id,
        lastUpdated: now,
      },
      {
        nurseUserId: outOfAreaUser!.id,
        lat: "42.662900",
        lng: "21.165500",
        serviceAreaId: pausedArea!.id,
        lastUpdated: now,
      },
      {
        nurseUserId: nonNurseUser!.id,
        lat: "42.662900",
        lng: "21.165500",
        serviceAreaId: activeArea!.id,
        lastUpdated: now,
      },
    ]);

    await expect(getAdminOpsStatus({ now })).resolves.toMatchObject({
      serviceAreas: { active: 1 },
      nurseSupply: {
        verifiedAndAvailable: 10,
        launchMinimum: 10,
        launchShortfall: 0,
        launchReady: true,
        launchServiceAreaCount: 1,
        launchLowestServiceAreaSupply: 10,
        launchServiceAreasBelowMinimum: 0,
      },
    });
  });

  it("blocks launch when any active service area is below the density threshold", async () => {
    const [readyArea, emptyArea] = await db
      .insert(serviceAreas)
      .values([
        {
          label: "Ready Launch Area",
          centerLat: "42.662900",
          centerLng: "21.165500",
          radiusMeters: 15000,
          status: "active",
        },
        {
          label: "Empty Launch Area",
          centerLat: "42.700000",
          centerLng: "21.200000",
          radiusMeters: 15000,
          status: "active",
        },
      ])
      .returning();
    const eligibleUsers = await db
      .insert(users)
      .values(
        Array.from({ length: 10 }, (_, index) => ({
          email: `ops-launch-one-area-${index}@test.local`,
          role: "nurse" as const,
        })),
      )
      .returning();

    await db.insert(nurses).values(
      eligibleUsers.map((user, index) => ({
        userId: user.id,
        status: "verified" as const,
        licenseNumber: `RN-OPS-ONE-AREA-${index}`,
        licenseJurisdiction: "XK",
        specialization: "General",
        licenseValidUntil: new Date("2027-12-31T00:00:00.000Z"),
        isAvailable: true,
      })),
    );
    await db.insert(nurseLocations).values(
      eligibleUsers.map((user) => ({
        nurseUserId: user.id,
        lat: "42.662900",
        lng: "21.165500",
        serviceAreaId: readyArea!.id,
        lastUpdated: now,
      })),
    );

    await expect(getAdminOpsStatus({ now })).resolves.toMatchObject({
      serviceAreas: { active: 2 },
      nurseSupply: {
        verifiedAndAvailable: 10,
        launchMinimum: 10,
        launchShortfall: 10,
        launchReady: false,
        launchServiceAreaCount: 2,
        launchLowestServiceAreaSupply: 0,
        launchServiceAreasBelowMinimum: 1,
      },
    });
    expect(emptyArea).toBeDefined();
  });
});
