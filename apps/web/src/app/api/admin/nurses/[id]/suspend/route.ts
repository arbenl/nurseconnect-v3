import { AdminSuspendNurseSchema } from "@nurseconnect/contracts";
import { suspendNurseCredential } from "@nurseconnect/domain-nurse";

import { handleCredentialRoute } from "../credential-route";

export function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  return handleCredentialRoute(request, props, {
    action: "suspend",
    schema: AdminSuspendNurseSchema,
    mutate: ({ actorUserId, nurseId, authority, data }) =>
      suspendNurseCredential({
        actorUserId,
        nurseId,
        ...authority,
        reason: data.reason,
      }),
  });
}
