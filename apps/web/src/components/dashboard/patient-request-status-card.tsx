"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type PatientServiceRequestSummary = {
  id: string;
  status: string;
  address: string;
  assignedNurseUserId: string | null;
  createdAt: string;
  requestType: string;
  scheduledFor: string | null;
  careType: string | null;
};

type PatientRequestStatusCardProps = {
  request: PatientServiceRequestSummary;
};

function getStatusCopy(status: string) {
  switch (status) {
    case "assigned":
      return "Assigned to a nurse";
    case "accepted":
      return "Nurse accepted the visit";
    case "enroute":
      return "Nurse is on the way";
    case "completed":
      return "Visit completed";
    case "canceled":
      return "Request canceled";
    case "rejected":
      return "Nurse could not take the visit";
    default:
      return "Waiting for assignment";
  }
}

export function formatRequestType(requestType: string) {
  return requestType === "scheduled" ? "Scheduled" : "Same day";
}

export function formatScheduledFor(value: string | null) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleString();
}

export function PatientRequestStatusCard({ request }: PatientRequestStatusCardProps) {
  return (
    <Card data-testid="patient-request-status-card">
      <CardHeader className="gap-2">
        <CardTitle>Current request status</CardTitle>
        <p className="text-sm text-muted-foreground">{getStatusCopy(request.status)}</p>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={request.status === "completed" ? "secondary" : "default"}>
            {request.status}
          </Badge>
          <Badge variant="outline">{formatRequestType(request.requestType)}</Badge>
        </div>
        <div>
          <p className="font-medium text-foreground">Address</p>
          <p className="text-muted-foreground">{request.address}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="font-medium text-foreground">Care type</p>
            <p className="text-muted-foreground">{request.careType || "General visit"}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Requested for</p>
            <p className="text-muted-foreground">
              {request.requestType === "scheduled"
                ? formatScheduledFor(request.scheduledFor)
                : "As soon as possible"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
