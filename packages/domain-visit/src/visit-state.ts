import type { RequestStatus } from "@nurseconnect/contracts";

const ACTIVE_VISIT_STATUSES: ReadonlySet<RequestStatus> = new Set([
  "assigned",
  "accepted",
  "enroute",
]);
const TERMINAL_VISIT_STATUSES: ReadonlySet<RequestStatus> = new Set([
  "completed",
  "canceled",
  "rejected",
]);

export function isVisitActive(status: RequestStatus) {
  return ACTIVE_VISIT_STATUSES.has(status);
}

export function isVisitTerminal(status: RequestStatus) {
  return TERMINAL_VISIT_STATUSES.has(status);
}

export function isVisitHistorical(status: RequestStatus) {
  return isVisitTerminal(status);
}
