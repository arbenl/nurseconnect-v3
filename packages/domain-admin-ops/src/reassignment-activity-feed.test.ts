import type { AdminReassignmentActivityItem } from "@nurseconnect/contracts";
import { describe, expect, it } from "vitest";

import {
  mergeAndSortActivityItems,
  toActivityMetadata,
} from "./reassignment-activity-feed";

describe("reassignment-activity-feed helpers", () => {
  it("normalizes invalid metadata values to null", () => {
    expect(
      toActivityMetadata({
        previousNurseUserId: "not-a-uuid",
        newNurseUserId: 123,
      }),
    ).toEqual({
      previousNurseUserId: null,
      newNurseUserId: null,
    });

    expect(
      toActivityMetadata({
        nurseUserId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toEqual({
      previousNurseUserId: null,
      newNurseUserId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("merges request-event and admin-audit rows into one descending timeline", () => {
    const items = mergeAndSortActivityItems([
      {
        source: "admin-audit",
        id: 7,
        action: "request.reassigned",
        requestId: "11111111-1111-1111-1111-111111111111",
        actorUserId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        metadata: {
          previousNurseUserId: null,
          newNurseUserId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        },
        createdAt: "2026-03-01T10:00:02.000Z",
      },
      {
        source: "request-event",
        id: 6,
        requestId: "11111111-1111-1111-1111-111111111111",
        actorUserId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        fromStatus: "open",
        toStatus: "assigned",
        metadata: {
          previousNurseUserId: null,
          newNurseUserId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        },
        createdAt: "2026-03-01T10:00:03.000Z",
      },
    ] satisfies AdminReassignmentActivityItem[]);

    expect(items.map((item) => `${item.source}:${item.id}`)).toEqual([
      "request-event:6",
      "admin-audit:7",
    ]);
  });

  it("breaks equal timestamps by numeric id descending", () => {
    const items = mergeAndSortActivityItems([
      {
        source: "admin-audit",
        id: 4,
        action: "request.reassigned",
        requestId: "11111111-1111-1111-1111-111111111111",
        actorUserId: null,
        metadata: {
          previousNurseUserId: null,
          newNurseUserId: null,
        },
        createdAt: "2026-03-01T10:00:00.000Z",
      },
      {
        source: "request-event",
        id: 9,
        requestId: "11111111-1111-1111-1111-111111111111",
        actorUserId: null,
        fromStatus: "assigned",
        toStatus: "assigned",
        metadata: {
          previousNurseUserId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          newNurseUserId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        },
        createdAt: "2026-03-01T10:00:00.000Z",
      },
    ] satisfies AdminReassignmentActivityItem[]);

    expect(items.map((item) => item.id)).toEqual([9, 4]);
  });
});
