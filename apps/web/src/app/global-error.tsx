"use client";

import { useEffect } from "react";
import { logClientError } from "@/server/telemetry/ops-logger";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    logClientError(error, {
      route: typeof window === "undefined" ? "/global-error" : window.location.pathname,
      action: "ui.global_error",
      requestId:
        typeof window === "undefined" || typeof window.crypto?.randomUUID !== "function"
          ? undefined
        : window.crypto.randomUUID(),
    });
  }, [error]);

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
