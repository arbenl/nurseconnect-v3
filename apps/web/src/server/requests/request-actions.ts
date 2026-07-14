import { eq, schema } from "@nurseconnect/database";
import {
  applyRequestAction as applyRequestActionInDomain,
  type ApplyRequestActionInput,
} from "@nurseconnect/domain-request";

import { withDefaultTenantContext } from "@/server/db/default-tenant-context";

import type { RequestAction } from "./request-lifecycle";

const { nurses } = schema;

const nurseActions = new Set<RequestAction>([
  "accept",
  "reject",
  "enroute",
  "complete",
]);

type ApplyRequestActionAdapterInput = Omit<
  ApplyRequestActionInput,
  "actorHasNurseProfile"
>;

export async function applyRequestAction(input: ApplyRequestActionAdapterInput) {
  return withDefaultTenantContext("request.action", async (tx) => {
    const actorHasNurseProfile = nurseActions.has(input.action)
      ? Boolean(
          (
            await tx
              .select({ userId: nurses.userId })
              .from(nurses)
              .where(eq(nurses.userId, input.actorUserId))
          )[0],
        )
      : false;

    const result = await applyRequestActionInDomain(tx, {
      ...input,
      actorHasNurseProfile,
    });

    for (const sideEffect of result.sideEffects) {
      if (sideEffect.type === "set-nurse-availability") {
        await tx
          .update(nurses)
          .set({
            isAvailable: sideEffect.isAvailable,
            updatedAt: new Date(),
          })
          .where(eq(nurses.userId, sideEffect.userId));
      }
    }

    return result.request;
  });
}

export {
  RequestConflictError,
  RequestForbiddenError,
  RequestNotFoundError,
} from "@nurseconnect/domain-request";
