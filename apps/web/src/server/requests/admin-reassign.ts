import type { RequestStatus } from "@nurseconnect/contracts";
import { reassignRequestInDispatch } from "@nurseconnect/domain-dispatch";

import { recordAdminAction } from "@/server/admin/audit";
import { withDefaultTenantContext } from "@/server/db/default-tenant-context";

export {
  RequestReassignForbiddenError,
  RequestReassignValidationError,
} from "@nurseconnect/domain-dispatch";

type ReassignResult = {
  request: {
    id: string;
    status: string;
    assignedNurseUserId: string | null;
  };
  previousNurseUserId: string | null;
};

export async function reassignRequest(input: {
  requestId: string;
  actorUserId: string;
  nurseUserId: string | null;
}): Promise<ReassignResult> {
  const { requestId, actorUserId, nurseUserId } = input;

  return withDefaultTenantContext("request.reassign", async (tx) => {
    const result = await reassignRequestInDispatch(tx, {
      requestId,
      actorUserId,
      nurseUserId,
    });

    await recordAdminAction(
      {
        actorUserId,
        action: "request.reassigned",
        targetEntityType: "request",
        targetEntityId: requestId,
        details: {
          requestId,
          nurseUserId,
          previousNurseUserId: result.previousNurseUserId,
          previousStatus: result.previousStatus as RequestStatus,
          nextStatus: result.nextStatus as RequestStatus,
        },
      },
      tx,
    );

    return {
      request: result.request,
      previousNurseUserId: result.previousNurseUserId,
    };
  });
}
