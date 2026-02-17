import type { RequestStatus } from "@nurseconnect/contracts";

export type RequestAction = "accept" | "reject" | "enroute" | "complete" | "cancel";

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
