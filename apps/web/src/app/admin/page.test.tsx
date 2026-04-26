import type { AdminOpsStatusCounts } from "@nurseconnect/contracts";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminOpsDashboard: vi.fn(),
  requirePortalAccessOrRedirect: vi.fn(),
}));

vi.mock("@nurseconnect/domain-admin-ops", () => ({
  getAdminOpsDashboard: mocks.getAdminOpsDashboard,
}));

vi.mock("@/server/auth", () => ({
  requirePortalAccessOrRedirect: mocks.requirePortalAccessOrRedirect,
}));

import AdminDashboardPage from "./page";

const opsStatus: AdminOpsStatusCounts = {
  generatedAt: "2026-04-25T10:00:00.000Z",
  serviceAreas: { active: 1 },
  nurseSupply: {
    verifiedAndAvailable: 8,
    launchMinimum: 10,
    launchShortfall: 2,
    launchReady: false,
    launchServiceAreaCount: 1,
    launchLowestServiceAreaSupply: 8,
    launchServiceAreasBelowMinimum: 1,
  },
  requests: {
    unassigned: 1,
    staleAssigned: 1,
    staleEnroute: 0,
    exceptionQueue: 2,
  },
  payments: {
    authorizationsWithoutPayout: 1,
    recentFailedAuthorizations: 0,
    recentFailedPayouts: 0,
  },
};

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    mocks.requirePortalAccessOrRedirect.mockResolvedValue({
      user: {
        id: "admin-user-123456",
        email: "admin@nurseconnect.test",
        role: "admin",
      },
    });
    mocks.getAdminOpsDashboard.mockResolvedValue({
      generatedAt: "2026-04-25T10:00:00.000Z",
      requestCounts: {
        total: 3,
        critical: 1,
        high: 1,
        unassigned: 1,
        assigned: 2,
      },
      opsStatus,
      credentialCounts: {
        total: 12,
        available: 8,
        needsAttention: 3,
        submitted: 1,
        under_review: 1,
        verified: 8,
        suspended: 1,
        expired: 0,
        renewal_pending: 1,
      },
      recentHotRequests: [],
      pendingCredentialItems: [],
      recentActivity: [],
      paymentFollowUpItems: [],
    });
  });

  it("renders launch supply threshold signals for blocked readiness", async () => {
    render(await AdminDashboardPage());

    expect(mocks.requirePortalAccessOrRedirect).toHaveBeenCalledWith({
      portal: "admin",
      currentPath: "/admin",
    });
    expect(screen.getByText("Verified supply")).toBeInTheDocument();
    expect(screen.getByText("8 launch eligible")).toBeInTheDocument();
    expect(screen.getByText("min 10")).toBeInTheDocument();
    expect(screen.getByText("1 areas short")).toBeInTheDocument();
    expect(screen.getByText("blocked")).toBeInTheDocument();
    expect(screen.getByText("8 lowest area")).toBeInTheDocument();
    expect(screen.getByText("2 short")).toBeInTheDocument();
  });
});
