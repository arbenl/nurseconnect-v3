"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ServiceRequest {
  id: string;
  address: string;
  status: string;
  createdAt: string;
}

export function NurseAssignmentCard() {
  const [assignment, setAssignment] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAssignment = async () => {
      try {
        const response = await fetch("/api/requests/mine");
        if (!response.ok) throw new Error("Failed to fetch assignments");
        
        const requests = await response.json();
        
        // Find the most recent assigned request
        const active = requests.find((r: ServiceRequest) => 
          r.status === "assigned" || r.status === "enroute"
        );
        
        setAssignment(active || null);
      } catch (error) {
        console.error("Failed to fetch assignment:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAssignment();
  }, []);

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
      </CardContent>
    </Card>
  );
}
