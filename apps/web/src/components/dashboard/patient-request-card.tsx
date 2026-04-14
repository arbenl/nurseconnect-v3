"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { PatientRequestStatusCard } from "./patient-request-status-card";

interface ServiceRequest {
  id: string;
  status: string;
  address: string;
  assignedNurseUserId: string | null;
  createdAt: string;
  requestType: string;
  scheduledFor: string | null;
  careType: string | null;
}

export function PatientRequestCard() {
  const [address, setAddress] = useState("");
  const [requestType, setRequestType] = useState<"same_day" | "scheduled">("same_day");
  const [scheduledFor, setScheduledFor] = useState("");
  const [careType, setCareType] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeRequest, setActiveRequest] = useState<ServiceRequest | null>(null);
  const { toast } = useToast();

  const fetchActiveRequest = useCallback(async () => {
    try {
      const response = await fetch("/api/requests/mine");
      if (!response.ok) return;
      const requests = (await response.json()) as ServiceRequest[];
      const active = requests.find((r) =>
        ["open", "assigned", "accepted", "enroute"].includes(r.status)
      );
      setActiveRequest(active || requests[0] || null);
    } catch (error) {
      console.error("Failed to fetch patient requests:", error);
    }
  }, []);

  useEffect(() => {
    fetchActiveRequest();
  }, [fetchActiveRequest]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!address.trim()) {
      toast({
        title: "Address required",
        description: "Please enter your address",
        variant: "destructive",
      });
      return;
    }

    if (requestType === "scheduled" && !scheduledFor) {
      toast({
        title: "Schedule required",
        description: "Choose when the visit should happen.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // For MVP, use mock coordinates (center of Pristina, Kosovo)
      const lat = 42.6629;
      const lng = 21.1655;

      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          lat,
          lng,
          requestType,
          scheduledFor:
            requestType === "scheduled"
              ? new Date(scheduledFor).toISOString()
              : undefined,
          referralSource: "consumer",
          careType: careType.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create request");
      }

      const data = await response.json();

      toast({
        title: "Request created",
        description: data.assignedNurseUserId
          ? "A nurse has been assigned to your request!" 
          : "Your request is pending. We'll assign a nurse soon.",
      });

      setAddress("");
      setRequestType("same_day");
      setScheduledFor("");
      setCareType("");
      await fetchActiveRequest();
    } catch (error) {
      console.error("Request creation failed:", error);
      toast({
        title: "Error",
        description: "Failed to create request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request a Nurse Visit</CardTitle>
        <CardDescription>
          Enter your address to request an at-home nurse visit
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="requestType">Visit type</Label>
            <select
              id="requestType"
              aria-label="Visit type"
              value={requestType}
              onChange={(event) => setRequestType(event.target.value as "same_day" | "scheduled")}
              disabled={loading}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="same_day">Same day</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              placeholder="Enter your full address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={loading}
            />
          </div>
          {requestType === "scheduled" && (
            <div className="space-y-2">
              <Label htmlFor="scheduledFor">Scheduled for</Label>
              <Input
                id="scheduledFor"
                type="datetime-local"
                value={scheduledFor}
                onChange={(event) => setScheduledFor(event.target.value)}
                disabled={loading}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="careType">Care type</Label>
            <Input
              id="careType"
              placeholder="e.g. Wellness check, follow-up visit"
              value={careType}
              onChange={(event) => setCareType(event.target.value)}
              disabled={loading}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating request..." : "Request Visit"}
          </Button>
        </form>
        {activeRequest && (
          <div className="mt-4 border-t pt-4">
            <PatientRequestStatusCard request={activeRequest} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
