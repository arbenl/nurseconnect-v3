"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

interface ServiceRequest {
  id: string;
  status: string;
  address: string;
  assignedNurseUserId: string | null;
  createdAt: string;
}

export function PatientRequestCard() {
  const [address, setAddress] = useState("");
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

    setLoading(true);

    try {
      // For MVP, use mock coordinates (center of Pristina, Kosovo)
      const lat = 42.6629;
      const lng = 21.1655;

      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, lat, lng }),
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
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              placeholder="Enter your full address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={loading}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating request..." : "Request Visit"}
          </Button>
        </form>
        {activeRequest && (
          <div className="mt-4 space-y-2 border-t pt-4">
            <p className="text-sm font-medium">Current request</p>
            <p className="text-sm text-muted-foreground">{activeRequest.address}</p>
            <Badge variant={activeRequest.status === "completed" ? "secondary" : "default"}>
              {activeRequest.status}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
