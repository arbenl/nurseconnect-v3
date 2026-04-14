"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import {
  formatRequestType,
  formatScheduledFor,
  type PatientServiceRequestSummary,
} from "./patient-request-status-card";

type PatientRequestHistoryCardProps = {
  requests: PatientServiceRequestSummary[];
};

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

export function PatientRequestHistoryCard({ requests }: PatientRequestHistoryCardProps) {
  if (requests.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent request history</CardTitle>
        <CardDescription>
          Past requests stay visible here so completed or canceled visits do not look active.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.slice(0, 3).map((request) => (
          <div
            key={request.id}
            className="rounded-lg border border-border/70 bg-muted/20 p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{formatStatus(request.status)}</Badge>
              <Badge variant="outline">{formatRequestType(request.requestType)}</Badge>
            </div>
            <div className="mt-3 space-y-1 text-sm">
              <p className="font-medium text-foreground">{request.address}</p>
              <p className="text-muted-foreground">{request.careType || "General visit"}</p>
              <p className="text-muted-foreground">
                {request.requestType === "scheduled"
                  ? `Scheduled for ${formatScheduledFor(request.scheduledFor)}`
                  : `Requested ${new Date(request.createdAt).toLocaleString()}`}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
