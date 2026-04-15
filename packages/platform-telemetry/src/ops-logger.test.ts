import { describe, expect, it } from "vitest";

import { createApiLogContext, getRequestId, withRequestId } from "./ops-logger";

describe("ops-logger", () => {
  it("reuses a valid incoming request id", () => {
    const headers = new Headers({
      "x-request-id": "req_12345678",
    });

    expect(getRequestId(headers)).toBe("req_12345678");
  });

  it("creates a request context with the derived action", () => {
    const context = createApiLogContext(
      {
        method: "POST",
        headers: new Headers(),
      },
      "/api/admin/nurses",
    );

    expect(context.method).toBe("POST");
    expect(context.route).toBe("/api/admin/nurses");
    expect(context.action).toBe("/api/admin/nurses.nurses");
    expect(context.requestId).toMatch(/^req_|^[0-9a-f-]{36}$/);
  });

  it("attaches the request id header to the response", () => {
    const response = withRequestId(new Response(null), "req_attach_1234");

    expect(response.headers.get("x-request-id")).toBe("req_attach_1234");
  });
});
