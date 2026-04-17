"use client";

import type { NurseVisitSummary } from "@nurseconnect/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

type ServiceRequest = NurseVisitSummary;

interface NurseAssignmentCardProps {
  activeAssignment: ServiceRequest | null;
  recentAssignments: ServiceRequest[];
  isLoading: boolean;
  specialization?: string | null;
}

function formatRequestType(requestType: string) {
  return requestType === "scheduled" ? "Scheduled" : "Same day";
}

function formatRequestedFor(request: ServiceRequest) {
  if (request.requestType === "scheduled" && request.scheduledFor) {
    return new Date(request.scheduledFor).toLocaleString();
  }

  return "As soon as possible";
}

export function NurseAssignmentCard({
  activeAssignment,
  recentAssignments,
  isLoading,
  specialization,
}: NurseAssignmentCardProps) {
  const [actionLoading, setActionLoading] = useState<null | "accept" | "reject" | "enroute" | "complete">(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleAction = async (action: "accept" | "reject" | "enroute" | "complete") => {
    if (!activeAssignment) return;
    setActionLoading(action);
    try {
      const response = await fetch(`/api/requests/${activeAssignment.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "reject" ? JSON.stringify({ reason: "Nurse rejected assignment" }) : "{}",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Failed to ${action}`);
      }
    } catch (error) {
      console.error(`Failed to ${action} request:`, error);
      toast({
        title: "Action failed",
        description: `Could not ${action} this request. Please try again.`,
        variant: "destructive",
      });
    } finally {
      await queryClient.invalidateQueries({ queryKey: ["nurse-assignment-feed"] });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <Card data-testid="nurse-assignment-card">
        <CardHeader>
          <CardTitle>Current Assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (!activeAssignment) {
    return (
      <Card data-testid="nurse-assignment-card">
        <CardHeader>
          <CardTitle>Current Assignment</CardTitle>
          <CardDescription>No active visit right now</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Stay available and keep your phone nearby. New visit requests will appear here.
          </p>
          {specialization ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Specialization</span>
              <Badge variant="outline">{specialization}</Badge>
            </div>
          ) : null}
          {recentAssignments.length > 0 ? (
            <div className="space-y-3 border-t pt-3">
              <p className="text-sm font-medium text-foreground">Recent assignment history</p>
              {recentAssignments.slice(0, 3).map((assignment) => (
                <div
                  key={assignment.id}
                  className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{assignment.status}</Badge>
                    <Badge variant="outline">{formatRequestType(assignment.requestType)}</Badge>
                  </div>
                  <p className="mt-2 font-medium text-foreground">{assignment.address}</p>
                  <p className="text-muted-foreground">{assignment.careType ?? "General visit"}</p>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="nurse-assignment-card">
      <CardHeader>
        <CardTitle>Current Assignment</CardTitle>
        <CardDescription>Active visit request</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium">Address</p>
          <p className="text-sm text-muted-foreground">{activeAssignment.address}</p>
        </div>
        <div>
          <p className="text-sm font-medium">Status</p>
          <Badge variant={activeAssignment.status === "assigned" ? "default" : "secondary"}>
            {activeAssignment.status}
          </Badge>
        </div>
        <div>
          <p className="text-sm font-medium">Visit type</p>
          <p className="text-sm text-muted-foreground">{formatRequestType(activeAssignment.requestType)}</p>
        </div>
        <div>
          <p className="text-sm font-medium">Care type</p>
          <p className="text-sm text-muted-foreground">{activeAssignment.careType ?? "General visit"}</p>
        </div>
        <div>
          <p className="text-sm font-medium">Requested</p>
          <p className="text-sm text-muted-foreground">
            {new Date(activeAssignment.createdAt).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium">Requested for</p>
          <p className="text-sm text-muted-foreground">{formatRequestedFor(activeAssignment)}</p>
        </div>
        {activeAssignment.status === "assigned" && (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => handleAction("accept")}
              disabled={actionLoading !== null}
            >
              {actionLoading === "accept" ? "Accepting..." : "Accept"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleAction("reject")}
              disabled={actionLoading !== null}
            >
              {actionLoading === "reject" ? "Rejecting..." : "Reject"}
            </Button>
          </div>
        )}
        {activeAssignment.status === "accepted" && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleAction("enroute")}
            disabled={actionLoading !== null}
          >
            {actionLoading === "enroute" ? "Updating..." : "Mark En Route"}
          </Button>
        )}
        {activeAssignment.status === "enroute" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAction("complete")}
            disabled={actionLoading !== null}
          >
            {actionLoading === "complete" ? "Completing..." : "Mark Complete"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
