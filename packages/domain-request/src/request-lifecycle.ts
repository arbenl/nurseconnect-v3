import type { RequestStatus } from "@nurseconnect/contracts";

export type RequestAction = "accept" | "reject" | "enroute" | "complete" | "cancel";
export type AdminTriageAction = "needs_review" | "decline" | "unfulfilled" | "reopen";

const transitionMap: Record<RequestAction, Partial<Record<RequestStatus, RequestStatus>>> = {
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

export function canTransition(from: RequestStatus, action: RequestAction): RequestStatus {
  const next = transitionMap[action][from];
  if (!next) {
    throw new Error(`Invalid transition: ${from} -> ${action}`);
  }
  return next;
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
): RequestStatus {
  const next = adminTransitionMap[action][from];
  if (!next) {
    throw new Error(`Invalid admin transition: ${from} -> ${action}`);
  }
  return next;
}
