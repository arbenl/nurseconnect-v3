import { AdminRejectNurseSchema } from "@nurseconnect/contracts";
import { rejectNurseCredential } from "@nurseconnect/domain-nurse";

import { handleCredentialRoute } from "../credential-route";

export function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  return handleCredentialRoute(request, props, {
    action: "reject",
    schema: AdminRejectNurseSchema,
    mutate: ({ actorUserId, nurseId, authority, data }) =>
      rejectNurseCredential({
        actorUserId,
        nurseId,
        ...authority,
        reason: data.reason,
      }),
  });
}
