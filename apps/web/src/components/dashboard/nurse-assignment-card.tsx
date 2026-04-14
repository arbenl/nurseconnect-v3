"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

interface ServiceRequest {
  id: string;
  address: string;
  status: string;
  createdAt: string;
  requestType: string;
  scheduledFor: string | null;
  careType: string | null;
}

interface NurseAssignmentCardProps {
  isAvailable: boolean;
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

export function NurseAssignmentCard({ isAvailable, specialization }: NurseAssignmentCardProps) {
  const [assignment, setAssignment] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<null | "accept" | "reject" | "enroute" | "complete">(null);
  const { toast } = useToast();

  const fetchAssignment = useCallback(async () => {
    try {
      const response = await fetch("/api/requests/mine");
      if (!response.ok) throw new Error("Failed to fetch assignments");

      const requests = await response.json();

      const active = requests.find(
        (r: ServiceRequest) => r.status === "assigned" || r.status === "accepted" || r.status === "enroute"
      );

      setAssignment(active || null);
    } catch (error) {
      console.error("Failed to fetch assignment:", error);
      toast({
        title: "Error",
        description: "Failed to load assignments. Please refresh and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleAction = async (action: "accept" | "reject" | "enroute" | "complete") => {
    if (!assignment) return;
    setActionLoading(action);
    try {
      const response = await fetch(`/api/requests/${assignment.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "reject" ? JSON.stringify({ reason: "Nurse rejected assignment" }) : "{}",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Failed to ${action}`);
      }

      await fetchAssignment();
    } catch (error) {
      console.error(`Failed to ${action} request:`, error);
      toast({
        title: "Action failed",
        description: `Could not ${action} this request. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    fetchAssignment();
  }, [fetchAssignment]);

  if (loading) {
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

  if (!assignment) {
    return (
      <Card data-testid="nurse-assignment-card">
        <CardHeader>
          <CardTitle>Current Assignment</CardTitle>
          <CardDescription>No active visit right now</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {isAvailable
              ? "Stay available and keep your phone nearby. New visit requests will appear here."
              : "You are currently paused for new visit requests. Turn on dispatch availability when you are ready."}
          </p>
          {specialization ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Specialization</span>
              <Badge variant="outline">{specialization}</Badge>
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
          <p className="text-sm text-muted-foreground">{assignment.address}</p>
        </div>
        <div>
          <p className="text-sm font-medium">Status</p>
          <Badge variant={assignment.status === "assigned" ? "default" : "secondary"}>
            {assignment.status}
          </Badge>
        </div>
        <div>
          <p className="text-sm font-medium">Visit type</p>
          <p className="text-sm text-muted-foreground">{formatRequestType(assignment.requestType)}</p>
        </div>
        <div>
          <p className="text-sm font-medium">Care type</p>
          <p className="text-sm text-muted-foreground">{assignment.careType ?? "General visit"}</p>
        </div>
        <div>
          <p className="text-sm font-medium">Requested</p>
          <p className="text-sm text-muted-foreground">
            {new Date(assignment.createdAt).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium">Requested for</p>
          <p className="text-sm text-muted-foreground">{formatRequestedFor(assignment)}</p>
        </div>
        {assignment.status === "assigned" && (
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
        {assignment.status === "accepted" && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleAction("enroute")}
            disabled={actionLoading !== null}
          >
            {actionLoading === "enroute" ? "Updating..." : "Mark En Route"}
          </Button>
        )}
        {assignment.status === "enroute" && (
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
