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
        description: `You are now ${checked ? "active and valid for new jobs" : "unavailable"}.`,
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle>Availability Status</CardTitle>
          <CardDescription>
            {isAvailable 
              ? "You are visible to patients in your area." 
              : "You are currently hidden from search results."}
          </CardDescription>
        </div>
        <div className={`h-3 w-3 rounded-full ${isAvailable ? "bg-green-500" : "bg-gray-300"}`} />
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-4">
          <Switch
            checked={isAvailable}
            onCheckedChange={handleToggle}
            disabled={isLoading}
            aria-label="Toggle availability"
          />
          <span className="text-sm font-medium">
            {isAvailable ? "Active" : "Inactive"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
