import { describe, expect, it } from "vitest";

import {
  exportRequestToA2A,
  exportResultToA2A,
  importRequestFromA2A,
  importResultFromA2A,
} from "../lib/a2a-adapter.mjs";

describe("A2A adapter", () => {
  it("roundtrips internal request through A2A envelope", () => {
    const request = {
      runId: "run-123",
      taskId: "patient-intake-hardening",
      mode: "multi",
      budgetUsd: 40,
      estimatedCostUsd: 18,
      lanes: ["preflight-agent", "gatekeeper", "testing-agent", "compliance-agent", "verification-agent", "finalizer-agent"],
      metadata: {
        actor: "release-manager",
      },
      createdAt: "2026-02-27T10:00:00.000Z",
    };

    const envelope = exportRequestToA2A(request, {
      source: "nurseconnect",
      target: "external-a2a",
    });

    const parsedRequest = importRequestFromA2A(envelope);

    expect(parsedRequest).toEqual(request);
  });

  it("imports A2A result envelope into internal result format", () => {
    const internalResult = {
      runId: "run-456",
      status: "pass",
      lanes: [
        {
          lane: "testing-agent",
          status: "pass",
          costUsd: 2.4,
          latencyMs: 1200,
          notes: ["all gate checks green"],
        },
      ],
      artifacts: {
        roleScorecard: "tmp/multi-agent/run-456/role-scorecard.json",
      },
      finishedAt: "2026-02-27T10:30:00.000Z",
    };

    const envelope = exportResultToA2A(internalResult, {
      source: "external-a2a",
      target: "nurseconnect",
    });

    const parsedResult = importResultFromA2A(envelope);

    expect(parsedResult).toEqual(internalResult);
  });

  it("fails validation for malformed envelopes", () => {
    expect(() => importRequestFromA2A({ protocol: "a2a/1.0" })).toThrow(/A2A envelope validation failed/);
  });
});
