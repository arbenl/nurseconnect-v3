import { requestEvents } from "@nurseconnect/database/schema";

export type VisitActorRole = "admin" | "nurse" | "patient";

export function serializeVisitEvent(event: typeof requestEvents.$inferSelect) {
  const meta =
    event.meta && typeof event.meta === "object" && !Array.isArray(event.meta)
      ? (event.meta as Record<string, unknown>)
      : null;

  return {
    ...event,
    fromStatus: event.fromStatus ?? null,
    toStatus: event.toStatus ?? null,
    actorUserId: event.actorUserId ?? null,
    meta,
    createdAt: event.createdAt.toISOString(),
  };
}
