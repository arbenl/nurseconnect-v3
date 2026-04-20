import type { RequestStatus } from "@nurseconnect/contracts";

export type PartnerRequestStatus =
  | "received"
  | "scheduled"
  | "completed"
  | "could_not_fulfill";

export function toPartnerRequestStatus(status: RequestStatus): PartnerRequestStatus {
  switch (status) {
    case "open":
    case "needs_review":
      return "received";
    case "assigned":
    case "accepted":
    case "enroute":
      return "scheduled";
    case "completed":
      return "completed";
    case "canceled":
    case "rejected":
    case "declined":
    case "unfulfilled":
      return "could_not_fulfill";
    default:
      throw new Error(`Unsupported request status: ${String(status)}`);
  }
}
