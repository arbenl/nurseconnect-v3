import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  executor: { tag: "tenant-executor" },
  withTenant: vi.fn(),
  requireRole: vi.fn(),
  requireAnyRole: vi.fn(),
  activeQueue: vi.fn(),
  exceptionQueue: vi.fn(),
  activity: vi.fn(),
  partnerList: vi.fn(),
  partnerDetail: vi.fn(),
  nurseProjection: vi.fn(),
  patientProjection: vi.fn(),
  timeline: vi.fn(),
}));

vi.mock("@/server/db/default-tenant-context", () => ({
  withDefaultTenantContext: mocks.withTenant,
}));
vi.mock("@/server/auth", () => ({
  authErrorResponse: vi.fn(),
  requireRole: mocks.requireRole,
  requireAnyRole: mocks.requireAnyRole,
}));
vi.mock("@/server/partner/create-partner-patient-shell", () => ({
  createPartnerPatientShell: vi.fn(),
}));
vi.mock("@/server/requests/allocate-request", () => ({
  createAndAssignRequest: vi.fn(),
}));
vi.mock("@/server/telemetry/ops-logger", () => ({
  createApiLogContext: vi.fn(() => ({ requestId: "request-1" })),
  logApiFailure: vi.fn(),
  logApiStart: vi.fn(),
  logApiSuccess: vi.fn(),
  withRequestId: vi.fn((response: Response) => response),
}));
vi.mock("@nurseconnect/domain-admin-ops", () => ({
  getAdminActiveRequestQueue: mocks.activeQueue,
  getAdminExceptionQueue: mocks.exceptionQueue,
  getAdminReassignmentActivityFeed: mocks.activity,
}));
vi.mock("@nurseconnect/domain-referral", () => ({
  getPartnerRequestDetail: mocks.partnerDetail,
  listPartnerRequests: mocks.partnerList,
  ReferralPartnerInactiveError: class extends Error {},
  ReferralPartnerNotFoundError: class extends Error {},
  ReferralPartnerValidationError: class extends Error {},
}));
vi.mock("@nurseconnect/domain-visit", () => ({
  getNurseVisitProjection: mocks.nurseProjection,
  getPatientVisitProjection: mocks.patientProjection,
  getVisitTimelineForActor: mocks.timeline,
  VisitForbiddenError: class extends Error {},
  VisitNotFoundError: class extends Error {},
}));

import { GET as getActivity } from "./admin/activity/reassignments/route";
import { GET as getActive } from "./admin/requests/active/route";
import { GET as getExceptions } from "./admin/requests/exceptions/route";
import { GET as getPartnerDetail } from "./partner/requests/[id]/route";
import { GET as getPartnerList } from "./partner/requests/route";
import { GET as getEvents } from "./requests/[id]/events/route";
import { GET as getAssigned } from "./requests/assigned/route";
import { GET as getMine } from "./requests/mine/route";

describe("tenant context route adoption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withTenant.mockImplementation((_boundary, callback) => callback(mocks.executor));
    mocks.requireRole.mockResolvedValue({ user: { id: "actor-1", role: "admin" } });
    mocks.requireAnyRole.mockResolvedValue({ user: { id: "actor-1", role: "patient" } });
    mocks.activeQueue.mockResolvedValue({ items: [] });
    mocks.exceptionQueue.mockResolvedValue({ items: [] });
    mocks.activity.mockResolvedValue({ items: [] });
    mocks.partnerList.mockResolvedValue([]);
    mocks.partnerDetail.mockResolvedValue({ id: "request-1" });
    mocks.nurseProjection.mockResolvedValue({ activeAssignment: null, recentAssignments: [] });
    mocks.patientProjection.mockResolvedValue({ activeVisit: null, recentVisits: [] });
    mocks.timeline.mockResolvedValue([]);
  });

  it.each([
    ["admin.active-queue", getActive, "/api/admin/requests/active"],
    ["admin.exception-queue", getExceptions, "/api/admin/requests/exceptions"],
    ["visit.projection", getAssigned, "/api/requests/assigned"],
    ["visit.projection", getMine, "/api/requests/mine"],
    ["referral.request", getPartnerList, "/api/partner/requests"],
  ])("runs %s reads through the scoped executor", async (boundary, route, path) => {
    const response = await route(new Request(`https://app.test${path}`) as never);
    expect(response.status).toBe(200);
    expect(mocks.withTenant).toHaveBeenCalledWith(boundary, expect.any(Function));
  });

  it("scopes activity, detail, and timeline parameterized reads", async () => {
    const activity = await getActivity(new NextRequest("https://app.test/api/admin/activity/reassignments"));
    const detail = await getPartnerDetail(new Request("https://app.test/api/partner/requests/request-1"), {
      params: Promise.resolve({ id: "request-1" }),
    });
    const events = await getEvents(new Request("https://app.test/api/requests/request-1/events"), {
      params: { id: "request-1" },
    });

    expect([activity.status, detail.status, events.status]).toEqual([200, 200, 200]);
    expect(mocks.withTenant.mock.calls.map(([boundary]) => boundary)).toEqual([
      "admin.activity",
      "referral.request",
      "visit.timeline",
    ]);
    expect(mocks.timeline).toHaveBeenCalledWith(mocks.executor, expect.objectContaining({ requestId: "request-1" }));
  });
});
