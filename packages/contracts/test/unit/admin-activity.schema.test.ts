import { describe, expect, it } from "vitest";

import { AdminReassignmentActivityResponseSchema } from "../../src/admin-activity";

describe("admin activity schema", () => {
  it("parses reassignment event and audit entries", () => {
    const parsed = AdminReassignmentActivityResponseSchema.parse({
      generatedAt: "2026-02-27T00:00:00.000Z",
      items: [
        {
          source: "request-event",
          id: 11,
          requestId: "11111111-1111-4111-8111-111111111111",
          actorUserId: "22222222-2222-4222-8222-222222222222",
          fromStatus: "assigned",
          toStatus: "assigned",
          metadata: {
            previousNurseUserId: "33333333-3333-4333-8333-333333333333",
            newNurseUserId: "44444444-4444-4444-8444-444444444444",
          },
          createdAt: "2026-02-27T00:00:01.000Z",
        },
        {
          source: "admin-audit",
          id: 12,
          action: "request.reassigned",
          requestId: "11111111-1111-4111-8111-111111111111",
          actorUserId: "22222222-2222-4222-8222-222222222222",
          metadata: {
            previousNurseUserId: "33333333-3333-4333-8333-333333333333",
            newNurseUserId: "44444444-4444-4444-8444-444444444444",
          },
          createdAt: "2026-02-27T00:00:01.500Z",
        },
      ],
    });

    expect(parsed.items).toHaveLength(2);
  });

  it("rejects invalid reassignment metadata", () => {
    const result = AdminReassignmentActivityResponseSchema.safeParse({
      generatedAt: "2026-02-27T00:00:00.000Z",
      items: [
        {
          source: "request-event",
          id: 1,
          requestId: "11111111-1111-4111-8111-111111111111",
          actorUserId: null,
          fromStatus: "assigned",
          toStatus: "assigned",
          metadata: {
            previousNurseUserId: "not-a-uuid",
            newNurseUserId: null,
          },
          createdAt: "2026-02-27T00:00:01.000Z",
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});

