import type { RequestEvent } from "@nurseconnect/contracts";

export function getStatusCopy(status: string) {
  switch (status) {
    case "assigned":
      return "Assigned to a nurse";
    case "accepted":
      return "Nurse accepted the visit";
    case "enroute":
      return "Nurse is on the way";
    case "completed":
      return "Visit completed";
    case "canceled":
      return "Request canceled";
    case "rejected":
      return "Nurse could not take the visit";
    case "needs_review":
      return "Request is under review";
    case "declined":
      return "Request declined";
    case "unfulfilled":
      return "Request could not be fulfilled";
    default:
      return "Waiting for assignment";
  }
}

export function describeEvent(type: RequestEvent["type"]) {
  switch (type) {
    case "request_created":
      return "Request created";
    case "request_assigned":
      return "Assigned to a nurse";
    case "request_accepted":
      return "Accepted by nurse";
    case "request_rejected":
      return "Rejected by nurse";
    case "request_enroute":
      return "Nurse en route";
    case "request_completed":
      return "Visit completed";
    case "request_canceled":
      return "Request canceled";
    case "request_reassigned":
      return "Reassigned to another nurse";
    case "request_needs_review":
      return "Request under review";
    case "request_declined":
      return "Request declined";
    case "request_unfulfilled":
      return "Request could not be fulfilled";
    case "request_reopened":
      return "Request reopened";
    default:
      return type;
  }
}
