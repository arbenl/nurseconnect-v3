import type { ResolvedSessionUser } from "./session-user";

type Portal = "app" | "admin";

type PortalAccessResolution =
  | {
      redirectTo: string;
      canonicalRoute: null;
      profileComplete: false;
      session: null;
      user: null;
    }
  | {
      redirectTo: null;
      canonicalRoute: string;
      profileComplete: boolean;
      session: ResolvedSessionUser["session"];
      user: ResolvedSessionUser["user"];
    };

function redirectResolution(redirectTo: string): PortalAccessResolution {
  return {
    redirectTo,
    canonicalRoute: null,
    profileComplete: false,
    session: null,
    user: null,
  };
}

export function resolvePortalAccessPolicy(options: {
  currentPath: string;
  portal: Portal;
  resolved: ResolvedSessionUser | null;
  canonicalRoute: string | null;
  profileComplete: boolean;
  requireProfileComplete?: boolean;
}): PortalAccessResolution {
  if (!options.resolved) {
    return redirectResolution(`/login?callbackUrl=${encodeURIComponent(options.currentPath)}`);
  }

  const canonicalRoute = options.canonicalRoute ?? "/dashboard";

  if (options.portal === "admin" && canonicalRoute !== "/admin") {
    return redirectResolution(canonicalRoute);
  }

  if (options.portal === "app" && canonicalRoute !== "/dashboard") {
    return redirectResolution(canonicalRoute);
  }

  if (options.requireProfileComplete && !options.profileComplete) {
    return redirectResolution("/onboarding");
  }

  return {
    redirectTo: null,
    canonicalRoute,
    profileComplete: options.profileComplete,
    session: options.resolved.session,
    user: options.resolved.user,
  };
}
