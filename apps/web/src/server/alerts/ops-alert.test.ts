import { afterEach, describe, expect, it, vi } from "vitest";

import { notifyOpsAlert } from "./ops-alert";

describe("notifyOpsAlert", () => {
  const originalWebhookUrl = process.env.OPS_ALERT_WEBHOOK_URL;

  afterEach(() => {
    process.env.OPS_ALERT_WEBHOOK_URL = originalWebhookUrl;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("sends fire-and-forget alerts for payment and payout failures only", () => {
    process.env.OPS_ALERT_WEBHOOK_URL = "https://alerts.test/webhook";
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    notifyOpsAlert({
      action: "payment.authorization.failed",
      requestId: "11111111-1111-4111-8111-111111111111",
      actorUserId: "22222222-2222-4222-8222-222222222222",
    });
    notifyOpsAlert({
      action: "payout.failed",
      requestId: "33333333-3333-4333-8333-333333333333",
      actorUserId: "44444444-4444-4444-8444-444444444444",
    });
    notifyOpsAlert({
      action: "payment.authorization.recorded",
      requestId: "55555555-5555-4555-8555-555555555555",
      actorUserId: "66666666-6666-4666-8666-666666666666",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://alerts.test/webhook");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      event: "payment.authorization.failed",
      requestId: "11111111-1111-4111-8111-111111111111",
      actorUserId: "22222222-2222-4222-8222-222222222222",
    });
  });

  it("does nothing when the webhook URL is not configured", () => {
    delete process.env.OPS_ALERT_WEBHOOK_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    notifyOpsAlert({
      action: "payment.authorization.failed",
      requestId: "11111111-1111-4111-8111-111111111111",
      actorUserId: "22222222-2222-4222-8222-222222222222",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing when the webhook URL is blank", () => {
    process.env.OPS_ALERT_WEBHOOK_URL = "   ";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    notifyOpsAlert({
      action: "payment.authorization.failed",
      requestId: "11111111-1111-4111-8111-111111111111",
      actorUserId: "22222222-2222-4222-8222-222222222222",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("swallows webhook failures and logs instead of throwing", async () => {
    process.env.OPS_ALERT_WEBHOOK_URL = "https://alerts.test/webhook";
    const fetchMock = vi.fn().mockRejectedValue(new Error("webhook unavailable"));
    vi.stubGlobal("fetch", fetchMock);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      notifyOpsAlert({
        action: "payout.failed",
        requestId: "33333333-3333-4333-8333-333333333333",
        actorUserId: "44444444-4444-4444-8444-444444444444",
      }),
    ).not.toThrow();

    await Promise.resolve();
    await Promise.resolve();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("ops.alert"));
  });

  it("logs non-success webhook responses", async () => {
    process.env.OPS_ALERT_WEBHOOK_URL = "https://alerts.test/webhook";
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    notifyOpsAlert({
      action: "payment.authorization.failed",
      requestId: "11111111-1111-4111-8111-111111111111",
      actorUserId: "22222222-2222-4222-8222-222222222222",
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Ops alert webhook returned 500"),
    );
  });

  it("swallows synchronous fetch failures and logs instead of throwing", () => {
    process.env.OPS_ALERT_WEBHOOK_URL = "https://alerts.test/webhook";
    const fetchMock = vi.fn(() => {
      throw new TypeError("invalid webhook URL");
    });
    vi.stubGlobal("fetch", fetchMock);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      notifyOpsAlert({
        action: "payout.failed",
        requestId: "33333333-3333-4333-8333-333333333333",
        actorUserId: "44444444-4444-4444-8444-444444444444",
      }),
    ).not.toThrow();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("invalid webhook URL"));
  });
});
