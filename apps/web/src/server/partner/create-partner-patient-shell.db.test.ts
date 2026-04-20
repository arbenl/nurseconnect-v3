import { db, eq, schema, sql } from "@nurseconnect/database";
import { ReferralPartnerValidationError } from "@nurseconnect/domain-referral";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createPartnerPatientShell } from "./create-partner-patient-shell";

const { users } = schema;

describe.sequential("partner patient shell bridge", () => {
  beforeAll(async () => {
    await db.execute(sql`SELECT 1`);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE referral_partners RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE service_request_events RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE service_requests RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nurses RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  });

  it("creates a lightweight patient shell from referral contact data", async () => {
    const patient = await createPartnerPatientShell({
      email: "referred-patient@test.local",
      firstName: "Referred",
      lastName: "Patient",
      phone: "+38344111222",
      city: "Pristina",
    });

    expect(patient).toMatchObject({
      email: "referred-patient@test.local",
      role: "patient",
      firstName: "Referred",
      lastName: "Patient",
      phone: "+38344111222",
      city: "Pristina",
    });
  });

  it("reuses an existing patient shell when the match strategy is safe", async () => {
    const [existing] = await db
      .insert(users)
      .values({
        email: "existing-patient@test.local",
        role: "patient",
        firstName: "Existing",
        lastName: "Patient",
      })
      .returning();

    if (!existing) {
      throw new Error("Expected existing patient shell");
    }

    const patient = await createPartnerPatientShell({
      email: "existing-patient@test.local",
      firstName: "Existing",
      lastName: "Patient",
      phone: "+38344111223",
      city: "Pristina",
    });

    expect(patient.id).toBe(existing.id);

    const rows = await db.select().from(users).where(eq(users.email, "existing-patient@test.local"));
    expect(rows).toHaveLength(1);
  });

  it("does not assign referral_partner or nurse roles accidentally", async () => {
    for (const role of ["referral_partner", "nurse"] as const) {
      const email = `${role}-collision@test.local`;
      const [existing] = await db
        .insert(users)
        .values({
          email,
          role,
          firstName: "Existing",
          lastName: "Actor",
        })
        .returning();

      if (!existing) {
        throw new Error("Expected seeded collision user");
      }

      await expect(
        createPartnerPatientShell({
          email,
          firstName: "Referred",
          lastName: "Patient",
        }),
      ).rejects.toThrow(ReferralPartnerValidationError);

      const persisted = await db.query.users.findFirst({
        where: eq(users.id, existing.id),
      });
      expect(persisted?.role).toBe(role);
    }
  });
});
