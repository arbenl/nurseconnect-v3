"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

interface NurseStatusCardProps {
  isAvailable: boolean;
  status: string;
  licenseValidUntil: string | null;
  activeAssignmentStatus: string | null;
}

function isLicenseExpired(licenseValidUntil: string | null) {
  if (!licenseValidUntil) {
    return false;
  }
  return new Date(licenseValidUntil) <= new Date();
}

export function NurseStatusCard({
  isAvailable: initialAvailability,
  status,
  licenseValidUntil,
  activeAssignmentStatus,
}: NurseStatusCardProps) {
  const [isAvailable, setIsAvailable] = useState(initialAvailability);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const hasActiveAssignment = activeAssignmentStatus === "assigned" || activeAssignmentStatus === "accepted" || activeAssignmentStatus === "enroute";
  const licenseExpired = isLicenseExpired(licenseValidUntil);
  const isSwitchDisabled = isLoading || hasActiveAssignment || status !== "verified" || licenseExpired;
  const displayAvailable = hasActiveAssignment ? false : isAvailable;

  const statusDescription = hasActiveAssignment
    ? "Availability is paused while you finish your active visit."
    : displayAvailable
      ? "You can receive new visit requests right now."
      : "Turn this on when you are ready to receive new visit requests.";

  const helperCopy = hasActiveAssignment
    ? "Availability resumes after you complete or reject the visit."
    : licenseExpired
      ? "Your license must be renewed before you can rejoin supply."
      : "Availability does not guarantee an assignment.";

  const handleToggle = async (checked: boolean) => {
    // Optimistic update
    setIsAvailable(checked);
    setIsLoading(true);

    try {
      const response = await fetch("/api/me/nurse", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isAvailable: checked }),
      });

      if (!response.ok) {
        let message = "Failed to update status";
        try {
          const body = (await response.json()) as { error?: string };
          if (body.error) {
            message = body.error;
          }
        } catch {
          // Ignore JSON parsing errors and keep the generic fallback.
        }
        throw new Error(message);
      }

      toast({
        title: "Status updated",
        description: checked
          ? "You can now receive new visit requests."
          : "You will stop receiving new visit requests.",
      });
      
      router.refresh(); // Refresh server state
    } catch (error) {
      console.error(error);
      // Revert on failure
      setIsAvailable(!checked);
      toast({
        title: "Error",
        description: "Could not update availability status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card data-testid="nurse-status-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle>Dispatch availability</CardTitle>
          <CardDescription>{statusDescription}</CardDescription>
        </div>
        <div className={`h-3 w-3 rounded-full ${displayAvailable ? "bg-green-500" : "bg-gray-300"}`} />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center space-x-4">
          <Switch
            checked={displayAvailable}
            onCheckedChange={handleToggle}
            disabled={isSwitchDisabled}
            aria-label="Toggle availability"
          />
          <span className="text-sm font-medium">
            {hasActiveAssignment
              ? "Paused during active visit"
              : displayAvailable
                ? "Available for new requests"
                : "Not receiving requests"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {helperCopy}
        </p>
      </CardContent>
    </Card>
  );
}
