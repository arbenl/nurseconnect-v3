import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  handleCredentialRoute: vi.fn(() => new Response("ok")),
  rejectNurseCredential: vi.fn(),
  suspendNurseCredential: vi.fn(),
  verifyNurseCredential: vi.fn(),
}));

vi.mock("./credential-route", () => ({
  handleCredentialRoute: mocks.handleCredentialRoute,
}));

vi.mock("@nurseconnect/contracts", () => ({
  AdminRejectNurseSchema: {},
  AdminSuspendNurseSchema: {},
  AdminVerifyNurseSchema: {},
}));

vi.mock("@nurseconnect/domain-nurse", () => ({
  rejectNurseCredential: mocks.rejectNurseCredential,
  suspendNurseCredential: mocks.suspendNurseCredential,
  verifyNurseCredential: mocks.verifyNurseCredential,
}));

type RouteConfig = {
  action: "reject" | "suspend" | "verify";
  mutate(input: {
    actorUserId: string;
    nurseId: string;
    authority: { organizationId: string; policyDecision: { allowed: boolean } };
    data: Record<string, string>;
  }): unknown;
};

const props = { params: Promise.resolve({ id: "nurse-1" }) };

describe("credential route wrappers", () => {
  it("wires verify, reject, and suspend through the shared handler", async () => {
    const request = new Request("https://app.test/api/admin/nurses/nurse-1/verify", { method: "POST" });
    const [{ POST: verify }, { POST: reject }, { POST: suspend }] = await Promise.all([
      import("./verify/route"),
      import("./reject/route"),
      import("./suspend/route"),
    ]);

    await verify(request, props);
    await reject(request, props);
    await suspend(request, props);

    const calls = mocks.handleCredentialRoute.mock.calls as unknown as Array<[Request, typeof props, RouteConfig]>;
    const configs = calls.map((call) => call[2]);
    expect(configs.map((config) => config.action)).toEqual(["verify", "reject", "suspend"]);

    await configs[0]!.mutate({
      actorUserId: "admin-1",
      nurseId: "nurse-1",
      authority: { organizationId: "org-1", policyDecision: { allowed: true } },
      data: { licenseValidUntil: "2028-01-01T00:00:00.000Z", licenseJurisdiction: "CA" },
    });
    await configs[1]!.mutate({
      actorUserId: "admin-1",
      nurseId: "nurse-1",
      authority: { organizationId: "org-1", policyDecision: { allowed: true } },
      data: { reason: "Incomplete" },
    });
    await configs[2]!.mutate({
      actorUserId: "admin-1",
      nurseId: "nurse-1",
      authority: { organizationId: "org-1", policyDecision: { allowed: true } },
      data: { reason: "Expired" },
    });

    expect(mocks.verifyNurseCredential).toHaveBeenCalledWith(expect.objectContaining({ licenseJurisdiction: "CA" }));
    expect(mocks.rejectNurseCredential).toHaveBeenCalledWith(expect.objectContaining({ reason: "Incomplete" }));
    expect(mocks.suspendNurseCredential).toHaveBeenCalledWith(expect.objectContaining({ reason: "Expired" }));
  });
});
