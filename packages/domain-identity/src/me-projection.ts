import { schema } from "@nurseconnect/database";

type DomainUser = typeof schema.users.$inferSelect;
type NurseRecord = typeof schema.nurses.$inferSelect;

type MeProjectionNurseProfile =
  | {
      status: NurseRecord["status"];
      licenseNumber: string | null;
      licenseJurisdiction: string | null;
      specialization: string | null;
      licenseValidUntil: string | null;
      isAvailable: boolean;
    }
  | null;

function buildMeNurseProfile(nurse: NurseRecord | null): MeProjectionNurseProfile {
  if (!nurse) {
    return null;
  }

  return {
    status: nurse.status,
    licenseNumber: nurse.licenseNumber,
    licenseJurisdiction: nurse.licenseJurisdiction,
    specialization: nurse.specialization,
    licenseValidUntil: nurse.licenseValidUntil?.toISOString() ?? null,
    isAvailable: nurse.isAvailable,
  };
}

export function isUserPortalProfileComplete(user: DomainUser, nurse: NurseRecord | null) {
  const hasBaseProfile = Boolean(user.firstName && user.lastName && user.phone && user.city);

  if (!hasBaseProfile) {
    return false;
  }

  if (user.role !== "nurse") {
    return true;
  }

  return Boolean(nurse?.licenseNumber && nurse.specialization);
}

export function buildMeUserProjection(user: DomainUser, nurse: NurseRecord | null) {
  return {
    id: user.id,
    authId: user.authId,
    email: user.email,
    role: user.role,
    name: user.name,
    profile: {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      city: user.city,
      address: user.address,
    },
    nurseProfile: buildMeNurseProfile(nurse),
    profileComplete: isUserPortalProfileComplete(user, nurse),
  };
}
