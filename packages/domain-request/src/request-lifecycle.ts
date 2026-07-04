import { brandValue, type Brand, type RequestStatus } from "@nurseconnect/contracts";

export type RequestAction = "accept" | "reject" | "enroute" | "complete" | "cancel";
export type AdminTriageAction = "needs_review" | "decline" | "unfulfilled" | "reopen";
export type DispatchTransitionAction = "assign" | "unassign";
export type TransitionContext = {
  requestId: string;
  actorUserId: string | null;
};
const authorizedTransitions = new WeakSet<object>();
type AuthorizedTransitionPayload = Readonly<TransitionContext & {
  action: RequestTransitionAction | AdminTriageAction;
  fromStatus: RequestStatus;
  toStatus: RequestStatus;
}>;
export type AuthorizedTransition = Brand<AuthorizedTransitionPayload, "AuthorizedTransition">;

type RequestTransitionAction = RequestAction | DispatchTransitionAction;

const transitionMap: Record<RequestTransitionAction, Partial<Record<RequestStatus, RequestStatus>>> = {
  assign: {
    open: "assigned",
    assigned: "assigned",
  },
  unassign: {
    open: "open",
    assigned: "open",
  },
  accept: {
    assigned: "accepted",
  },
  reject: {
    assigned: "open",
    accepted: "open",
  },
  enroute: {
    accepted: "enroute",
  },
  complete: {
    enroute: "completed",
  },
  cancel: {
    open: "canceled",
    assigned: "canceled",
    accepted: "canceled",
  },
};

function authorized(
  fromStatus: RequestStatus,
  toStatus: RequestStatus,
  action: RequestTransitionAction | AdminTriageAction,
  context: TransitionContext,
): AuthorizedTransition {
  const transition = {
    ...context,
    action,
    fromStatus,
    toStatus,
  };
  Object.freeze(transition);
  authorizedTransitions.add(transition);
  return brandValue<AuthorizedTransitionPayload, "AuthorizedTransition">(transition);
}

function assertAuthorizedTransition(transition: AuthorizedTransition) {
  if (!authorizedTransitions.has(transition)) {
    throw new Error("Invalid AuthorizedTransition proof");
  }
}

export function transitionStatus(transition: AuthorizedTransition): RequestStatus {
  assertAuthorizedTransition(transition);
  return transition.toStatus;
}

export function canTransition(
  from: RequestStatus,
  action: RequestTransitionAction,
  context: TransitionContext,
): AuthorizedTransition {
  const next = transitionMap[action][from];
  if (!next) {
    throw new Error(`Invalid transition: ${from} -> ${action}`);
  }
  return authorized(from, next, action, context);
}

const adminTransitionMap: Record<AdminTriageAction, Partial<Record<RequestStatus, RequestStatus>>> = {
  needs_review: {
    open: "needs_review",
    assigned: "needs_review",
  },
  decline: {
    open: "declined",
    assigned: "declined",
    needs_review: "declined",
  },
  unfulfilled: {
    open: "unfulfilled",
    assigned: "unfulfilled",
    needs_review: "unfulfilled",
  },
  reopen: {
    needs_review: "open",
    declined: "open",
    unfulfilled: "open",
  },
};

export function canAdminTransition(
  from: RequestStatus,
  action: AdminTriageAction,
  context: TransitionContext,
): AuthorizedTransition {
  const next = adminTransitionMap[action][from];
  if (!next) {
    throw new Error(`Invalid admin transition: ${from} -> ${action}`);
  }
  return authorized(from, next, action, context);
}
