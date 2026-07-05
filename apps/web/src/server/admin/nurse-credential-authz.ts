import { organizationId } from "@nurseconnect/contracts";
import { db, withTenantContext } from "@nurseconnect/database";
import { DEFAULT_ORGANIZATION_ID, ForbiddenError, requireOrganizationMembership } from "@nurseconnect/domain-identity";
import { authorizeTenantAction } from "@nurseconnect/platform-authz";

export async function credentialAuthorityForAdmin(actorUserId: string) {
  const org = organizationId(DEFAULT_ORGANIZATION_ID);
  const membership = await requireAdminMembership(actorUserId);
  const policyDecision = authorizeTenantAction({
    subject: { userId: actorUserId, personaRole: "admin", organizationId: org, membershipRole: membership.role, membershipStatus: membership.status },
    action: "tenant.write",
    resource: { kind: "organization", organizationId: org },
    context: { tenantId: org },
  });
  if (!policyDecision.allowed) throw new ForbiddenError();
  return {
    organizationId: org,
    policyDecision,
  };
}

async function requireAdminMembership(actorUserId: string) {
  try {
    return await withTenantContext(db, DEFAULT_ORGANIZATION_ID, (tx) =>
      requireOrganizationMembership({ userId: actorUserId, organizationId: DEFAULT_ORGANIZATION_ID }, tx),
    );
  } catch (error) {
    if (error instanceof Error && error.name.startsWith("Organization")) throw new ForbiddenError();
    throw error;
  }
}
