import type { OrganizationId } from "@nurseconnect/contracts";

export type PersonaRole = "admin" | "nurse" | "patient" | "referral_partner";
export type MembershipRole = "owner" | "admin" | "coordinator" | "requester" | "viewer";
export type MembershipStatus = "active" | "invited" | "disabled";

export type TenantAction =
  | "tenant.manage_members"
  | "tenant.read"
  | "tenant.write"
  | "request.create"
  | "request.read"
  | "request.update"
  | "assignment.participate"
  | "phi.read_field";

export type TenantResourceKind =
  | "organization"
  | "membership"
  | "request"
  | "assignment"
  | "visit"
  | "patient_record"
  | "nurse_context";

export type TenantSubject = {
  userId: string;
  personaRole: PersonaRole;
  organizationId: OrganizationId;
  membershipRole: MembershipRole;
  membershipStatus: MembershipStatus;
  branchIds?: readonly string[];
  facilityIds?: readonly string[];
};

export type TenantResource = {
  kind: TenantResourceKind;
  organizationId: OrganizationId | null;
  branchId?: string | null;
  facilityId?: string | null;
  ownerUserId?: string | null;
  assignedNurseUserId?: string | null;
  phiFields?: readonly string[];
};

export type TenantDecisionContext = {
  tenantId: OrganizationId | null;
  jurisdiction?: string | null;
};

export type AuthorizationInput = {
  subject: TenantSubject | null;
  action: TenantAction;
  resource: TenantResource;
  context: TenantDecisionContext;
};
