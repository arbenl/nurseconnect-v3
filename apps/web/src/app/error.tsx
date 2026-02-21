"use client";

import { useEffect } from "react";

import { logClientError } from "@/server/telemetry/ops-logger";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    logClientError(error, {
      route: typeof window === "undefined" ? "/(app)" : window.location.pathname,
      action: "ui.error",
      requestId:
        typeof window === "undefined" || typeof window.crypto?.randomUUID !== "function"
          ? undefined
        : window.crypto.randomUUID(),
    });
  }, [error]);

  return (
    <div style={{ padding: 20 }}>
      <h2>Something went wrong</h2>
      <pre style={{ whiteSpace: "pre-wrap" }}>{error.message}</pre>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
