"use client";

import type { MeResponse } from "@/types/me";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type DashboardUser = NonNullable<Extract<MeResponse, { ok: true }>["user"]>;

type DashboardWelcomeCardProps = {
  user: DashboardUser;
};

function getRoleSummary(role: DashboardWelcomeCardProps["user"]["role"]) {
  switch (role) {
    case "nurse":
      return "Keep your availability current and respond to active assignments from the dashboard.";
    case "admin":
      return "Review operational queues and keep the NurseConnect network running safely.";
    default:
      return "Request care, review your current visit, and track the next action from one place.";
  }
}

export function DashboardWelcomeCard({ user }: DashboardWelcomeCardProps) {
  const displayName = user.profile.firstName || user.name || user.email || "there";

  return (
    <Card data-testid="dashboard-welcome-card">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-xl">Welcome, {displayName}</CardTitle>
          <Badge variant="outline" className="capitalize">
            {user.role}
          </Badge>
        </div>
        <CardDescription>{getRoleSummary(user.role)}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
        <div>
          <p className="font-medium text-foreground">Primary contact</p>
          <p>{user.profile.phone || "No phone added yet"}</p>
        </div>
        <div>
          <p className="font-medium text-foreground">City</p>
          <p>{user.profile.city || "No city added yet"}</p>
        </div>
        {user.role === "nurse" && user.nurseProfile && (
          <>
            <div>
              <p className="font-medium text-foreground">Credential status</p>
              <p className="capitalize">{user.nurseProfile.status.replace(/_/g, " ")}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Specialization</p>
              <p>{user.nurseProfile.specialization || "Not provided"}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
