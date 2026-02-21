"use client";

import { logClientError } from "@/server/telemetry/ops-logger";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const route = typeof window === "undefined" ? "/global-error" : window.location.pathname;
  logClientError(error, {
    route,
    action: "ui.global_error",
    requestId: typeof window === "undefined" || typeof window.crypto?.randomUUID !== "function"
      ? undefined
      : window.crypto.randomUUID(),
  });

  return (
    <html>
      <body style={{ padding: 20 }}>
        <h2>App crashed</h2>
        <pre style={{ whiteSpace: "pre-wrap" }}>{error.message}</pre>
        <button onClick={() => reset()}>Reload</button>
      </body>
    </html>
  );
}
