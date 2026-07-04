import { brandValue, type Brand } from "@nurseconnect/contracts";

export type AuthorizationDenyReason =
  | "missing_subject"
  | "inactive_membership"
  | "missing_tenant"
  | "cross_tenant"
  | "scope_mismatch"
  | "action_denied"
  | "phi_field_denied";

export type AuthorizationDecision =
  | { allowed: true }
  | { allowed: false; reason: AuthorizationDenyReason };

export type PolicyDecision = Brand<AuthorizationDecision, "PolicyDecision">;

const policyDecisions = new WeakSet<object>();

export class AuthorizationDeniedError extends Error {
  constructor(readonly reason: AuthorizationDenyReason) {
    super(`Authorization denied: ${reason}`);
    this.name = "AuthorizationDeniedError";
  }
}

export function allow(): PolicyDecision {
  return register({ allowed: true });
}

export function deny(reason: AuthorizationDenyReason): PolicyDecision {
  return register({ allowed: false, reason });
}

export function assertTenantActionAllowed(decision: PolicyDecision): void {
  if (!policyDecisions.has(decision)) {
    throw new AuthorizationDeniedError("action_denied");
  }
  if (!decision.allowed) {
    throw new AuthorizationDeniedError(decision.reason);
  }
}

function register(decision: AuthorizationDecision): PolicyDecision {
  policyDecisions.add(decision);
  return Object.freeze(brandValue<AuthorizationDecision, "PolicyDecision">(decision));
}
