import { assertCanSetSelfAvailability } from "./availability-policy";
import { NurseCredentialValidationError } from "./errors";
import { NurseProfileNotFoundError } from "./errors";

const SELF_SERVE_ALLOWED_STATUSES = new Set(["draft", "submitted"] as const);

export function assertCanSubmitOwnNurseApplication(status: string | null) {
  if (status === null) {
    return;
  }

  if (SELF_SERVE_ALLOWED_STATUSES.has(status as "draft" | "submitted")) {
    return;
  }

  throw new NurseCredentialValidationError(
    `Self-service nurse application is not allowed while status is ${status}`,
  );
}

export async function submitOwnNurseApplication(input: {
  userId: string;
  licenseNumber: string;
  licenseJurisdiction: string;
  specialization: string;
}) {
  const { and, db, eq, or, schema } = await import("@nurseconnect/database");
  const now = new Date();
  await db
    .insert(schema.nurses)
    .values({
      userId: input.userId,
      status: "submitted",
      licenseNumber: input.licenseNumber,
      licenseJurisdiction: input.licenseJurisdiction,
      specialization: input.specialization,
      isAvailable: false,
      updatedAt: now,
    })
    .onConflictDoNothing({
      target: schema.nurses.userId,
    });

  const current = await db.query.nurses.findFirst({
    where: eq(schema.nurses.userId, input.userId),
  });

  assertCanSubmitOwnNurseApplication(current?.status ?? null);

  const [submitted] = await db
    .update(schema.nurses)
    .set({
      status: "submitted",
      licenseNumber: input.licenseNumber,
      licenseJurisdiction: input.licenseJurisdiction,
      specialization: input.specialization,
      isAvailable: false,
      updatedAt: now,
    })
    .where(
      and(
        eq(schema.nurses.userId, input.userId),
        or(
          eq(schema.nurses.status, "draft"),
          eq(schema.nurses.status, "submitted"),
        ),
      ),
    )
    .returning();

  if (submitted) {
    return submitted;
  }

  const latest = await db.query.nurses.findFirst({
    where: eq(schema.nurses.userId, input.userId),
  });

  assertCanSubmitOwnNurseApplication(latest?.status ?? null);

  return latest;
}

export async function setMyAvailability(input: {
  actorUserId: string;
  isAvailable: boolean;
}) {
  const { db, eq, schema } = await import("@nurseconnect/database");
  const nurse = await db.query.nurses.findFirst({
    where: eq(schema.nurses.userId, input.actorUserId),
  });

  if (!nurse) {
    throw new NurseProfileNotFoundError();
  }

  if (input.isAvailable) {
    assertCanSetSelfAvailability({
      status: nurse.status,
      licenseValidUntil: nurse.licenseValidUntil,
    });
  }

  await db
    .update(schema.nurses)
    .set({
      isAvailable: input.isAvailable,
      updatedAt: new Date(),
    })
    .where(eq(schema.nurses.userId, input.actorUserId));

  return db.query.nurses.findFirst({
    where: eq(schema.nurses.userId, input.actorUserId),
  });
}
