import { serviceRequests } from "@nurseconnect/database/schema";

import { requestStatusUpdate, type AuthorizedRequestStatusUpdate } from "./request-status-update";

// @ts-expect-error raw service request statuses need an AuthorizedTransition.
requestStatusUpdate("open", {
  requestId: "request-1",
  actorUserId: "actor-1",
  fromStatus: "assigned",
}, { updatedAt: new Date() });

function acceptsAuthorizedStatusUpdate(_update: AuthorizedRequestStatusUpdate) {}

const rawStatusUpdate = { status: "open", updatedAt: new Date() };
const directServiceRequestStatusWrite: Pick<typeof serviceRequests.$inferInsert, "status"> = {
  status: "open",
};

// @ts-expect-error raw status update objects are not authorized request status updates.
const typedStatusUpdate: AuthorizedRequestStatusUpdate = rawStatusUpdate;

// @ts-expect-error direct serviceRequests.status writes need an AuthorizedTransition.
const typedDirectWrite: AuthorizedRequestStatusUpdate = directServiceRequestStatusWrite;

// @ts-expect-error direct raw status updates cannot satisfy authorized update input.
acceptsAuthorizedStatusUpdate({ status: "open", updatedAt: new Date() });
