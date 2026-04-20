import { db, eq, schema } from "@nurseconnect/database";
import { ReferralPartnerValidationError } from "@nurseconnect/domain-referral";

const { users } = schema;

function normalizeRequiredValue(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new ReferralPartnerValidationError(`${field} is required`);
  }
  return normalized;
}

export async function createPartnerPatientShell(input: {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  city?: string | null;
}) {
  const email = normalizeRequiredValue(input.email, "Patient email").toLowerCase();
  const firstName = normalizeRequiredValue(input.firstName, "Patient first name");
  const lastName = normalizeRequiredValue(input.lastName, "Patient last name");
  const phone = input.phone?.trim() || null;
  const city = input.city?.trim() || null;
  const displayName = `${firstName} ${lastName}`.trim();

  const [existing] = await db.select().from(users).where(eq(users.email, email));

  if (existing) {
    if (existing.role !== "patient") {
      throw new ReferralPartnerValidationError(
        "Existing user with this email is not a patient",
      );
    }

    const [updated] = await db
      .update(users)
      .set({
        name: existing.name ?? displayName,
        firstName: existing.firstName ?? firstName,
        lastName: existing.lastName ?? lastName,
        phone: existing.phone ?? phone,
        city: existing.city ?? city,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();

    if (!updated) {
      throw new ReferralPartnerValidationError("Failed to update patient shell");
    }

    return updated;
  }

  const [created] = await db
    .insert(users)
    .values({
      email,
      role: "patient",
      name: displayName,
      firstName,
      lastName,
      phone,
      city,
    })
    .returning();

  if (!created) {
    throw new ReferralPartnerValidationError("Failed to create patient shell");
  }

  return created;
}
