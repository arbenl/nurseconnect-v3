import { describe, expect, it } from "vitest";

import { deriveReassignmentPlan } from "./reassignment-policy";

describe("deriveReassignmentPlan", () => {
  it("assigns an open request to a nurse", () => {
    expect(
      deriveReassignmentPlan({
        currentStatus: "open",
        previousNurseUserId: null,
        nextNurseUserId: "nurse-1",
      }),
    ).toMatchObject({
      nextStatus: "assigned",
      shouldReleasePreviousNurse: false,
      shouldAssignNewNurse: true,
    });
  });

  it("reassigns from one nurse to another", () => {
    expect(
      deriveReassignmentPlan({
        currentStatus: "assigned",
        previousNurseUserId: "nurse-1",
        nextNurseUserId: "nurse-2",
      }),
    ).toMatchObject({
      nextStatus: "assigned",
      shouldReleasePreviousNurse: true,
      shouldAssignNewNurse: true,
    });
  });

  it("unassigns an assigned request", () => {
    expect(
      deriveReassignmentPlan({
        currentStatus: "assigned",
        previousNurseUserId: "nurse-1",
        nextNurseUserId: null,
      }),
    ).toMatchObject({
      nextStatus: "open",
      shouldReleasePreviousNurse: true,
      shouldAssignNewNurse: false,
    });
  });
});
