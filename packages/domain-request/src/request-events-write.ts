import type { RequestEventType, RequestStatus } from "@nurseconnect/contracts";
import { db, schema } from "@nurseconnect/database";

const { requestEvents } = schema;

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type AppendRequestEventInput = {
  requestId: string;
  type: RequestEventType;
  actorUserId: string | null;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus | null;
  meta?: Record<string, unknown> | null;
};

export async function appendRequestEvent(tx: Transaction, input: AppendRequestEventInput) {
  await tx.insert(requestEvents).values({
    requestId: input.requestId,
    type: input.type,
    actorUserId: input.actorUserId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    meta: input.meta ?? null,
  });
}
