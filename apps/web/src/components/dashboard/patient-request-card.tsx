"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

import { PatientRequestHistoryCard } from "./patient-request-history-card";
import {
  PatientRequestStatusCard,
  type PatientServiceRequestSummary,
} from "./patient-request-status-card";
import { PatientRequestTimeline } from "./patient-request-timeline";

const ACTIVE_REQUEST_STATUSES = ["open", "assigned", "accepted", "enroute"] as const;
const ACTIVE_POLL_INTERVAL_MS = 3_000;

function isActiveRequest(request: PatientServiceRequestSummary) {
  return ACTIVE_REQUEST_STATUSES.includes(
    request.status as (typeof ACTIVE_REQUEST_STATUSES)[number],
  );
}

export function PatientRequestCard() {
  const [address, setAddress] = useState("");
  const [dispatchLat, setDispatchLat] = useState("");
  const [dispatchLng, setDispatchLng] = useState("");
  const [requestType, setRequestType] = useState<"same_day" | "scheduled">("same_day");
  const [scheduledFor, setScheduledFor] = useState("");
  const [careType, setCareType] = useState("");
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<PatientServiceRequestSummary[]>([]);
  const { toast } = useToast();

  const fetchRequests = useCallback(async () => {
    try {
      const response = await fetch("/api/requests/mine", { cache: "no-store" });
      if (!response.ok) return;
      const nextRequests = (await response.json()) as PatientServiceRequestSummary[];
      setRequests(nextRequests);
    } catch (error) {
      console.error("Failed to fetch patient requests:", error);
    }
  }, []);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  const activeRequest = requests.find(isActiveRequest) ?? null;
  const activeRequestId = activeRequest?.id ?? null;
  const requestHistory = activeRequest
    ? requests.filter((request) => request.id !== activeRequest.id)
    : requests;

  useEffect(() => {
    if (!activeRequestId) {
      return;
    }

    const interval = window.setInterval(() => {
      void fetchRequests();
    }, ACTIVE_POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [activeRequestId, fetchRequests]);

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

    const lat = Number.parseFloat(dispatchLat);
    const lng = Number.parseFloat(dispatchLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast({
        title: "Dispatch coordinates required",
        description: "Enter the latitude and longitude the nurse should route to.",
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
      setScheduledFor("");
      setCareType("");
      await fetchRequests();
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
          Enter the visit address and the exact coordinates nurses should route to.
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
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
            Matching currently uses the coordinate fields below. Until map search or geocoding is
            added, the dispatch engine does not infer location from the address line alone.
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dispatchLat">Dispatch latitude</Label>
              <Input
                id="dispatchLat"
                inputMode="decimal"
                placeholder="e.g. 42.6629"
                value={dispatchLat}
                onChange={(event) => setDispatchLat(event.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dispatchLng">Dispatch longitude</Label>
              <Input
                id="dispatchLng"
                inputMode="decimal"
                placeholder="e.g. 21.1655"
                value={dispatchLng}
                onChange={(event) => setDispatchLng(event.target.value)}
                disabled={loading}
              />
            </div>
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
          <div className="mt-4 space-y-4 border-t pt-4">
            <PatientRequestStatusCard request={activeRequest} />
            <PatientRequestTimeline requestId={activeRequest.id} live />
          </div>
        )}
        {!activeRequest && requestHistory.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <PatientRequestHistoryCard requests={requestHistory} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
