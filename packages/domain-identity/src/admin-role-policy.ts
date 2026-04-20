import { schema } from "@nurseconnect/database";

import { RoleChangeValidationError } from "./errors";

type DomainUser = typeof schema.users.$inferSelect;
type UserRole = DomainUser["role"];

const allowedRoles = ["admin", "nurse", "patient"] as const;

export type IdentitySideEffect =
  | {
      type: "admin-audit";
      action: "user.role.changed";
      targetUserId: string;
      details: {
        previousRole: UserRole;
        nextRole: UserRole;
        targetEmail: string | null;
      };
    };

type PlannedUnchangedRoleChange = {
  unchanged: true;
  sideEffects: [];
};

type PlannedRoleChange = {
  unchanged: false;
  patch: {
    role: UserRole;
    updatedAt: Date;
  };
  sideEffects: IdentitySideEffect[];
};

export type PlannedUserRoleChange = PlannedUnchangedRoleChange | PlannedRoleChange;

function assertRole(value: unknown): UserRole {
  if (typeof value !== "string" || !allowedRoles.includes(value as UserRole)) {
    throw new RoleChangeValidationError("Invalid role");
  }

  return value as UserRole;
}

export function planUserRoleChange(input: {
  targetUser: DomainUser;
  nextRole: unknown;
}): PlannedUserRoleChange {
  const nextRole = assertRole(input.nextRole);

  if (input.targetUser.role === nextRole) {
    return {
      unchanged: true,
      sideEffects: [],
    };
  }

  return {
    unchanged: false,
    patch: {
      role: nextRole,
      updatedAt: new Date(),
    },
    sideEffects: [
      {
        type: "admin-audit",
        action: "user.role.changed",
        targetUserId: input.targetUser.id,
        details: {
          previousRole: input.targetUser.role,
          nextRole,
          targetEmail: input.targetUser.email,
        },
      },
    ],
  };
}
