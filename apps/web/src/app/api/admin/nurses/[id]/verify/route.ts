import { AdminVerifyNurseSchema } from "@nurseconnect/contracts";
import { verifyNurseCredential } from "@nurseconnect/domain-nurse";

import { handleCredentialRoute } from "../credential-route";

export function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  return handleCredentialRoute(request, props, {
    action: "verify",
    schema: AdminVerifyNurseSchema,
    mutate: ({ actorUserId, nurseId, authority, data }) =>
      verifyNurseCredential({
        actorUserId,
        nurseId,
        ...authority,
        licenseValidUntil: data.licenseValidUntil,
        licenseJurisdiction: data.licenseJurisdiction,
      }),
  });
}
