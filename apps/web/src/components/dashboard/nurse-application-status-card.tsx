"use client";

import { Clock3, ShieldAlert, ShieldX } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type NurseApplicationStatusCardProps = {
  status: string;
};

type StatusCopy = {
  title: string;
  description: string;
  guidance: string;
  nextStep: string;
  icon: typeof Clock3;
};

const STATUS_COPY = {
  draft: {
    title: "Application In Progress",
    description: "Finish submitting your licensing details to enter review.",
    guidance: "You can still request care as a patient while you finish the application.",
    nextStep: "Complete the remaining credential fields so the review can begin.",
    icon: Clock3,
  },
  submitted: {
    title: "Application Under Review",
    description: "Your nurse application is waiting for admin review.",
    guidance: "You can still request care as a patient while we review your credentials.",
    nextStep: "Nurse access will only be enabled after license verification is complete.",
    icon: Clock3,
  },
  under_review: {
    title: "Application Under Review",
    description: "Your credentials are currently being reviewed by the NurseConnect team.",
    guidance: "You can still request care as a patient while we review your credentials.",
    nextStep: "Nurse access will only be enabled after license verification is complete.",
    icon: Clock3,
  },
  rejected: {
    title: "Application Rejected",
    description: "Your last nurse application was rejected. Contact support before reapplying.",
    guidance: "Your patient access is unaffected while the application stays closed.",
    nextStep: "Contact NurseConnect support before submitting new license details.",
    icon: ShieldX,
  },
  suspended: {
    title: "Application Suspended",
    description: "Your nurse access is suspended. NurseConnect support will need to review your account.",
    guidance: "You cannot receive visits while the account remains suspended.",
    nextStep: "A NurseConnect admin must review your account before supply access can return.",
    icon: ShieldAlert,
  },
  expired: {
    title: "License Expired",
    description: "Your license has expired and must be renewed before you can re-enter supply.",
    guidance: "You cannot receive visits until a valid license is on file again.",
    nextStep: "Submit updated license details so the renewal review can begin.",
    icon: ShieldAlert,
  },
  renewal_pending: {
    title: "Renewal Under Review",
    description: "Your renewal is pending review. You cannot take visits until it is approved.",
    guidance: "You remain out of supply until the renewal is approved.",
    nextStep: "Nurse access will return after the renewed license is verified.",
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
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Current status: <strong className="capitalize text-foreground">{status.replace(/_/g, " ")}</strong>
        </p>
        <div className="rounded-lg border bg-muted/40 p-4 text-sm">
          <p className="font-medium text-foreground">{copy.guidance}</p>
          <p className="mt-2 text-muted-foreground">{copy.nextStep}</p>
        </div>
      </CardContent>
    </Card>
  );
}
