import { brandValue, type Brand, type RequestStatus } from "@nurseconnect/contracts";
import { serviceRequests } from "@nurseconnect/database/schema";

import { transitionStatus, type AuthorizedTransition } from "./request-lifecycle";

export type RequestStatusUpdateExtras = Omit<
  Partial<typeof serviceRequests.$inferInsert>,
  "status"
>;

type RequestStatusUpdateShape = RequestStatusUpdateExtras & {
  status: RequestStatus;
};

export type AuthorizedRequestStatusUpdate = Readonly<Brand<
  RequestStatusUpdateShape,
  "AuthorizedRequestStatusUpdate"
>>;

export type ExpectedTransitionProof = {
  requestId: string;
  actorUserId: string | null;
  fromStatus: RequestStatus;
  toStatus?: RequestStatus;
};

function assertTransitionMatches(
  transition: AuthorizedTransition,
  expected: ExpectedTransitionProof,
) {
  const toStatus = transitionStatus(transition);
  if (
    transition.requestId !== expected.requestId ||
    transition.actorUserId !== expected.actorUserId ||
    transition.fromStatus !== expected.fromStatus ||
    (expected.toStatus !== undefined && toStatus !== expected.toStatus)
  ) {
    throw new Error("AuthorizedTransition proof does not match persistence context");
  }
  return toStatus;
}

export function requestStatusUpdate(
  transition: AuthorizedTransition,
  expected: ExpectedTransitionProof,
  extras: RequestStatusUpdateExtras = {},
): AuthorizedRequestStatusUpdate {
  return Object.freeze(brandValue<RequestStatusUpdateShape, "AuthorizedRequestStatusUpdate">({
    ...extras,
    status: assertTransitionMatches(transition, expected),
  }));
}
