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
}

export function NurseAssignmentCard() {
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
      <Card>
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
      <Card>
        <CardHeader>
          <CardTitle>Current Assignment</CardTitle>
          <CardDescription>No active assignments</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You don&apos;t have any active assignments at the moment.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
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
          <p className="text-sm font-medium">Requested</p>
          <p className="text-sm text-muted-foreground">
            {new Date(assignment.createdAt).toLocaleString()}
          </p>
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
