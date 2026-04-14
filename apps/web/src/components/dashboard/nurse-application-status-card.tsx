"use client";

import { Clock3, ShieldAlert, ShieldX } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type NurseApplicationStatusCardProps = {
  status: string;
};

type StatusCopy = {
  title: string;
  description: string;
  icon: typeof Clock3;
};

const STATUS_COPY = {
  draft: {
    title: "Application In Progress",
    description: "Finish submitting your licensing details to enter review.",
    icon: Clock3,
  },
  submitted: {
    title: "Application Under Review",
    description: "Your nurse application is waiting for admin review.",
    icon: Clock3,
  },
  under_review: {
    title: "Application Under Review",
    description: "Your credentials are currently being reviewed by the NurseConnect team.",
    icon: Clock3,
  },
  rejected: {
    title: "Application Rejected",
    description: "Your last nurse application was rejected. Contact support before reapplying.",
    icon: ShieldX,
  },
  suspended: {
    title: "Application Suspended",
    description: "Your nurse access is suspended. NurseConnect support will need to review your account.",
    icon: ShieldAlert,
  },
  expired: {
    title: "License Expired",
    description: "Your license has expired and must be renewed before you can re-enter supply.",
    icon: ShieldAlert,
  },
  renewal_pending: {
    title: "Renewal Under Review",
    description: "Your renewal is pending review. You cannot take visits until it is approved.",
    icon: Clock3,
  },
} satisfies Record<string, StatusCopy>;

function getStatusCopy(status: string): StatusCopy {
  if (status in STATUS_COPY) {
    return STATUS_COPY[status as keyof typeof STATUS_COPY];
  }

  return STATUS_COPY.submitted;
}

export function NurseApplicationStatusCard({
  status,
}: NurseApplicationStatusCardProps) {
  const copy = getStatusCopy(status);
  const Icon = copy.icon;

  return (
    <Card data-testid="nurse-application-status-card">
      <CardHeader>
        <div className="mb-2 text-muted-foreground">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Current status: <strong className="capitalize text-foreground">{status.replace(/_/g, " ")}</strong>
        </p>
      </CardContent>
    </Card>
  );
}
