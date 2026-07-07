import type { RequestEventType, RequestStatus } from "@nurseconnect/contracts";
import type { DbClient } from "@nurseconnect/database";
import { requestEvents, serviceRequests } from "@nurseconnect/database/schema";
import { eq } from "drizzle-orm";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

type AppendRequestEventInput = {
  requestId: string;
  type: RequestEventType;
  actorUserId: string | null;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus | null;
  meta?: Record<string, unknown> | null;
};

export async function appendRequestEvent(
  tx: Transaction,
  input: AppendRequestEventInput,
) {
  const parentRequest = await tx.query.serviceRequests.findFirst({
    columns: { organizationId: true },
    where: eq(serviceRequests.id, input.requestId),
  });
  if (!parentRequest?.organizationId) {
    throw new Error("Request event requires tenant-owned parent request");
  }

  await tx.insert(requestEvents).values({
    requestId: input.requestId,
    organizationId: parentRequest.organizationId,
    type: input.type,
    actorUserId: input.actorUserId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    meta: input.meta ?? null,
  });
}
