import { sql } from "drizzle-orm";

import type { TenantQueryExecutor } from "@nurseconnect/database";

import { ForbiddenError } from "./errors";

export const organizationMembershipRoles = ["owner", "admin", "coordinator", "requester", "viewer"] as const;
export const organizationMembershipStatuses = ["active", "invited", "disabled"] as const;
export const organizationMembershipSources = ["bootstrap", "invitation", "api", "sso"] as const;

export type OrganizationMembershipRole = (typeof organizationMembershipRoles)[number];
export type OrganizationMembershipStatus = (typeof organizationMembershipStatuses)[number];
export type OrganizationMembershipSource = (typeof organizationMembershipSources)[number];

export type OrganizationMembership = {
  organizationId: string;
  userId: string;
  role: OrganizationMembershipRole;
  status: Extract<OrganizationMembershipStatus, "active">;
};

type MembershipRow = {
  organization_id: string;
  user_id: string;
  role: OrganizationMembershipRole;
  status: OrganizationMembershipStatus;
};

export class OrganizationMembershipRequiredError extends ForbiddenError {
  constructor() {
    super("Organization membership required");
    this.name = "OrganizationMembershipRequiredError";
  }
}

export class OrganizationInsufficientRoleError extends ForbiddenError {
  constructor() {
    super("Organization membership role is insufficient");
    this.name = "OrganizationInsufficientRoleError";
  }
}

export function boundedMembershipListLimit(limit = 50): number {
  if (!Number.isFinite(limit)) {
    return 50;
  }

  return Math.min(100, Math.max(1, Math.trunc(limit)));
}

export function isActiveOrganizationMembership(
  membership: { status: OrganizationMembershipStatus } | null | undefined,
): membership is { status: "active" } {
  return membership?.status === "active";
}

export async function listActiveOrganizationMembershipsForUser(
  input: { userId: string; limit?: number },
  database: TenantQueryExecutor,
): Promise<OrganizationMembership[]> {
  const limit = boundedMembershipListLimit(input.limit);
  const result = await database.execute(sql`
    SELECT
      org_memberships.organization_id,
      org_memberships.user_id,
      org_memberships.role,
      org_memberships.status
    FROM org_memberships
    INNER JOIN organizations
      ON organizations.id = org_memberships.organization_id
    WHERE org_memberships.user_id = ${input.userId}
      AND org_memberships.organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
      AND org_memberships.status = 'active'
      AND organizations.status = 'active'
    ORDER BY org_memberships.created_at ASC, org_memberships.id ASC
    LIMIT ${limit}
  `);

  return rowsFrom<MembershipRow>(result).map((row) => ({
    organizationId: row.organization_id,
    userId: row.user_id,
    role: row.role,
    status: "active",
  }));
}

export async function requireOrganizationMembership(
  input: {
    userId: string;
    organizationId: string;
    roles?: OrganizationMembershipRole[];
  },
  database: TenantQueryExecutor,
): Promise<OrganizationMembership> {
  const result = await database.execute(sql`
    SELECT
      org_memberships.organization_id,
      org_memberships.user_id,
      org_memberships.role,
      org_memberships.status
    FROM org_memberships
    INNER JOIN organizations
      ON organizations.id = org_memberships.organization_id
    WHERE org_memberships.user_id = ${input.userId}
      AND org_memberships.organization_id = ${input.organizationId}
      AND org_memberships.organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
      AND org_memberships.status = 'active'
      AND organizations.status = 'active'
    LIMIT 1
  `);

  const [membership] = rowsFrom<MembershipRow>(result);
  if (!isActiveOrganizationMembership(membership)) {
    throw new OrganizationMembershipRequiredError();
  }

  if (input.roles && input.roles.length > 0 && !input.roles.includes(membership.role)) {
    throw new OrganizationInsufficientRoleError();
  }

  return {
    organizationId: membership.organization_id,
    userId: membership.user_id,
    role: membership.role,
    status: "active",
  };
}

function rowsFrom<Row extends Record<string, unknown>>(result: { rows?: Record<string, unknown>[] } | Record<string, unknown>[]): Row[] {
  return (Array.isArray(result) ? result : result.rows ?? []) as Row[];
}
