type ClientErrorContext = {
  requestId?: string;
  route?: string;
  action?: string;
  actorId?: string;
  actorRole?: string;
};

function scrubClientErrorDetails(details: unknown) {
  if (details === null || details === undefined) {
    return details;
  }

  if (details instanceof Error) {
    return { name: details.name, message: details.message };
  }

  if (typeof details === "string") {
    return details.slice(0, 512);
  }

  if (typeof details === "number" || typeof details === "boolean") {
    return details;
  }

  if (Array.isArray(details)) {
    return details.slice(0, 10);
  }

  return "[redacted-object]";
}

function getClientRequestId(candidate?: string): string {
  if (candidate && /^[A-Za-z0-9._-]{8,128}$/.test(candidate)) {
    return candidate;
  }

  if (typeof window !== "undefined" && typeof window.crypto?.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function logClientError(
  error: unknown,
  context: ClientErrorContext = {},
  details: Record<string, unknown> = {},
) {
  const payload = {
    level: "error",
    event: "ui.request.error",
    timestamp: new Date().toISOString(),
    route: context.route,
    action: context.action,
    actorId: context.actorId,
    actorRole: context.actorRole,
    requestId: getClientRequestId(context.requestId),
    details,
    error: scrubClientErrorDetails(error),
  };

  console.error(JSON.stringify({
    ...payload,
    details: {
      ...Object.fromEntries(Object.entries(payload.details).map(([key, value]) => [key, scrubClientErrorDetails(value)])),
      error: scrubClientErrorDetails(payload.error),
    },
  }));
}
