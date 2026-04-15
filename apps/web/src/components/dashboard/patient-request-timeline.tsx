"use client";

import type { RequestEvent } from "@nurseconnect/contracts";
import { useCallback, useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PatientRequestTimelineProps = {
  requestId: string;
  live?: boolean;
};

const LIVE_POLL_INTERVAL_MS = 3_000;

function describeEvent(type: RequestEvent["type"]) {
  switch (type) {
    case "request_created":
      return "Request created";
    case "request_assigned":
      return "Assigned to a nurse";
    case "request_accepted":
      return "Accepted by nurse";
    case "request_rejected":
      return "Rejected by nurse";
    case "request_enroute":
      return "Nurse en route";
    case "request_completed":
      return "Visit completed";
    case "request_canceled":
      return "Request canceled";
    case "request_reassigned":
      return "Reassigned to another nurse";
    default:
      return type;
  }
}

export function PatientRequestTimeline({ requestId, live = false }: PatientRequestTimelineProps) {
  const [events, setEvents] = useState<RequestEvent[]>([]);

  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch(`/api/requests/${requestId}/events`, {
        cache: "no-store",
      });
      if (!response.ok) {
        return;
      }
      const nextEvents = (await response.json()) as RequestEvent[];
      setEvents(nextEvents);
    } catch (error) {
      console.error("Failed to fetch request events:", error);
    }
  }, [requestId]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (!live) {
      return;
    }

    const interval = window.setInterval(() => {
      void fetchEvents();
    }, LIVE_POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [fetchEvents, live]);

  if (events.length === 0) {
    return null;
  }

  return (
    <Card data-testid="patient-request-timeline">
      <CardHeader>
        <CardTitle>Request timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {events.map((event) => (
            <li
              key={event.id}
              className="rounded-lg border border-border/70 bg-muted/20 p-3"
            >
              <p className="font-medium text-foreground">{describeEvent(event.type)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {new Date(event.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
