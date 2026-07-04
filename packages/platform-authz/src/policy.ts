import { allow, deny, type PolicyDecision } from "./decision";
import type { AuthorizationInput, MembershipRole, TenantAction } from "./types";

const allowedActions: Record<MembershipRole, ReadonlySet<TenantAction>> = {
  owner: new Set([
    "tenant.manage_members",
    "tenant.read",
    "tenant.write",
    "request.create",
    "request.read",
    "request.update",
    "assignment.participate",
    "phi.read_field",
  ]),
  admin: new Set([
    "tenant.read",
    "tenant.write",
    "request.create",
    "request.read",
    "request.update",
    "assignment.participate",
  ]),
  coordinator: new Set([
    "tenant.read",
    "request.read",
    "request.update",
    "assignment.participate",
    "phi.read_field",
  ]),
  requester: new Set(["tenant.read", "request.create", "request.read"]),
  viewer: new Set(["tenant.read", "request.read"]),
};

const phiFieldsByRole: Partial<Record<MembershipRole, ReadonlySet<string>>> = {
  coordinator: new Set(["schedule_window", "mobility_need"]),
};

const operationalPersonas = new Set(["admin", "referral_partner"]);

function includesScope(allowed: readonly string[] | undefined, value: string | null | undefined) {
  if (allowed === undefined) return true;
  if (value === null || value === undefined) return false;
  return allowed.includes(value);
}

function hasScopeMismatch(input: AuthorizationInput) {
  const { subject, resource } = input;
  return !includesScope(subject?.branchIds, resource.branchId) ||
    !includesScope(subject?.facilityIds, resource.facilityId);
}

function hasResourceKindDenial(input: AuthorizationInput) {
  const { action, resource } = input;
  if (action.startsWith("request.")) return resource.kind !== "request";
  if (action === "assignment.participate") return resource.kind !== "assignment";
  if (action === "phi.read_field") return resource.kind !== "patient_record";
  return action.startsWith("tenant.") &&
    resource.kind !== "organization" &&
    resource.kind !== "membership";
}

function hasPhiDenial(input: AuthorizationInput) {
  const fields = input.resource.phiFields ?? [];
  if (input.action !== "phi.read_field") return fields.length > 0;
  if (fields.length === 0) return true;
  const allowed = phiFieldsByRole[input.subject!.membershipRole] ?? new Set();
  return fields.some((field) => !allowed.has(field));
}

function hasPersonaDenial(input: AuthorizationInput) {
  const role = input.subject!.membershipRole;
  const persona = input.subject!.personaRole;
  if (role === "requester") return !["admin", "patient", "referral_partner"].includes(persona);
  if (persona === "nurse" && (input.action === "request.read" || input.action === "request.update")) return false;
  if (input.action === "assignment.participate") return !["admin", "nurse", "referral_partner"].includes(persona);
  return !operationalPersonas.has(persona);
}

function hasRequestOwnershipDenial(input: AuthorizationInput) {
  const { action, resource, subject } = input;
  if (resource.kind !== "request" || (action !== "request.read" && action !== "request.update")) {
    return false;
  }
  if (subject!.membershipRole === "requester" || subject!.personaRole === "patient") {
    return resource.ownerUserId !== subject!.userId;
  }
  if (subject!.personaRole === "nurse") {
    return resource.assignedNurseUserId !== subject!.userId;
  }
  return false;
}

export function authorizeTenantAction(input: AuthorizationInput): PolicyDecision {
  const { subject, resource, context, action } = input;
  if (!subject) return deny("missing_subject");
  if (subject.membershipStatus !== "active") return deny("inactive_membership");
  if (!context.tenantId || !resource.organizationId) return deny("missing_tenant");
  if (subject.organizationId !== context.tenantId || resource.organizationId !== context.tenantId) {
    return deny("cross_tenant");
  }
  if (hasScopeMismatch(input)) return deny("scope_mismatch");
  if (hasResourceKindDenial(input)) return deny("action_denied");
  if (hasPersonaDenial(input)) return deny("action_denied");
  if (!allowedActions[subject.membershipRole].has(action)) return deny("action_denied");
  if (hasRequestOwnershipDenial(input)) return deny("action_denied");
  if (hasPhiDenial(input)) return deny("phi_field_denied");
  return allow();
}
