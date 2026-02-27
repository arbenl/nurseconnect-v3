import { describe, expect, it } from "vitest";

import {
  DEFAULT_TRIAGE_SEVERITY_POLICY,
  buildActiveQueueItem,
  mapSeverityBand,
  sortQueueItems,
  type RawActiveRequestRow,
} from "./triage-severity";

const now = new Date("2026-02-27T12:00:00.000Z");

function makeRow(overrides: Partial<RawActiveRequestRow>): RawActiveRequestRow {
  return {
    requestId: "11111111-1111-1111-1111-111111111111",
    status: "open",
    assignedNurseUserId: null,
    createdAt: "2026-02-27T11:00:00.000Z",
    lastEventAt: "2026-02-27T11:10:00.000Z",
    lat: "42.662900",
    lng: "21.165500",
    ...overrides,
  };
}

describe("triage-severity", () => {
  it("scores unassigned open requests higher than assigned requests with same wait", () => {
    const open = buildActiveQueueItem(
      makeRow({
        requestId: "11111111-1111-1111-1111-111111111111",
        status: "open",
        assignedNurseUserId: null,
      }),
      DEFAULT_TRIAGE_SEVERITY_POLICY,
      now,
    );

    const assigned = buildActiveQueueItem(
      makeRow({
        requestId: "22222222-2222-2222-2222-222222222222",
        status: "assigned",
        assignedNurseUserId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      }),
      DEFAULT_TRIAGE_SEVERITY_POLICY,
      now,
    );

    expect(open.severityScore).toBeGreaterThan(assigned.severityScore);
    expect(open.assignedNurse).toBe("unassigned");
    expect(assigned.assignedNurse).toBe("assigned");
  });

  it("maps severity bands from score thresholds", () => {
    expect(mapSeverityBand(90, DEFAULT_TRIAGE_SEVERITY_POLICY)).toBe("critical");
    expect(mapSeverityBand(70, DEFAULT_TRIAGE_SEVERITY_POLICY)).toBe("high");
    expect(mapSeverityBand(45, DEFAULT_TRIAGE_SEVERITY_POLICY)).toBe("medium");
    expect(mapSeverityBand(10, DEFAULT_TRIAGE_SEVERITY_POLICY)).toBe("low");
  });

  it("sorts deterministically using score, wait, createdAt, then requestId", () => {
    const scoreTieA = buildActiveQueueItem(
      makeRow({
        requestId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        createdAt: "2026-02-27T10:00:00.000Z",
      }),
      DEFAULT_TRIAGE_SEVERITY_POLICY,
      now,
    );

    const scoreTieB = buildActiveQueueItem(
      makeRow({
        requestId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        createdAt: "2026-02-27T10:00:00.000Z",
      }),
      DEFAULT_TRIAGE_SEVERITY_POLICY,
      now,
    );

    const stronger = buildActiveQueueItem(
      makeRow({
        requestId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        status: "open",
        assignedNurseUserId: null,
        createdAt: "2026-02-27T09:00:00.000Z",
      }),
      DEFAULT_TRIAGE_SEVERITY_POLICY,
      now,
    );

    const sorted = sortQueueItems([scoreTieB, stronger, scoreTieA]);

    expect(sorted[0]?.requestId).toBe(stronger.requestId);
    expect(sorted[1]?.requestId).toBe(scoreTieA.requestId);
    expect(sorted[2]?.requestId).toBe(scoreTieB.requestId);
  });

  it("masks location into a coarse hint", () => {
    const item = buildActiveQueueItem(
      makeRow({
        lat: "42.662900",
        lng: "21.165500",
      }),
      DEFAULT_TRIAGE_SEVERITY_POLICY,
      now,
    );

    expect(item.locationHint).toBe("~42.66,21.17");
  });
});
