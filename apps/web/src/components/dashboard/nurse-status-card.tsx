"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

interface NurseStatusCardProps {
  isAvailable: boolean;
}

export function NurseStatusCard({ isAvailable: initialAvailability }: NurseStatusCardProps) {
  const [isAvailable, setIsAvailable] = useState(initialAvailability);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

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
        throw new Error("Failed to update status");
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
          <CardDescription>
            {isAvailable
              ? "You can receive new visit requests right now."
              : "Turn this on when you are ready to receive new visit requests."}
          </CardDescription>
        </div>
        <div className={`h-3 w-3 rounded-full ${isAvailable ? "bg-green-500" : "bg-gray-300"}`} />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center space-x-4">
          <Switch
            checked={isAvailable}
            onCheckedChange={handleToggle}
            disabled={isLoading}
            aria-label="Toggle availability"
          />
          <span className="text-sm font-medium">
            {isAvailable ? "Available for new requests" : "Not receiving requests"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Availability does not guarantee an assignment.
        </p>
      </CardContent>
    </Card>
  );
}
