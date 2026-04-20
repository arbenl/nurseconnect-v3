import { ForbiddenError, UnauthorizedError } from "./errors";
import type { ResolvedSessionUser } from "./session-user";

type AppRole = ResolvedSessionUser["user"]["role"];
type NarrowedResolvedSessionUser<Role extends AppRole> = Omit<ResolvedSessionUser, "user"> & {
  user: Omit<ResolvedSessionUser["user"], "role"> & {
    role: Role;
  };
};

export async function requireAnyRole<const AllowedRoles extends readonly AppRole[]>(
  allowedRoles: AllowedRoles,
  resolved: ResolvedSessionUser | null,
): Promise<NarrowedResolvedSessionUser<AllowedRoles[number]>> {
  if (!resolved) {
    throw new UnauthorizedError();
  }

  if (!allowedRoles.includes(resolved.user.role)) {
    throw new ForbiddenError();
  }

  return resolved as NarrowedResolvedSessionUser<AllowedRoles[number]>;
}

export async function requireRole<Role extends AppRole>(
  role: Role,
  resolved: ResolvedSessionUser | null,
): Promise<NarrowedResolvedSessionUser<Role>> {
  return requireAnyRole([role], resolved);
}
