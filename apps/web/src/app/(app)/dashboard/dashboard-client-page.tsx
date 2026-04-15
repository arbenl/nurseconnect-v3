"use client";

import { BecomeNurseCard } from "@/components/dashboard/become-nurse-card";
import { DashboardWelcomeCard } from "@/components/dashboard/dashboard-welcome-card";
import { NurseApplicationStatusCard } from "@/components/dashboard/nurse-application-status-card";
import { NurseAssignmentCard } from "@/components/dashboard/nurse-assignment-card";
import { NurseStatusCard } from "@/components/dashboard/nurse-status-card";
import { PatientRequestCard } from "@/components/dashboard/patient-request-card";
import { useNurseAssignmentFeed } from "@/hooks/use-nurse-assignment-feed";
import { useUserProfile } from "@/hooks/use-user-profile";

export default function DashboardClientPage() {
  const { user, isLoading, error } = useUserProfile();
  const shouldLoadNurseAssignments =
    user?.role === "nurse" && user.nurseProfile?.status === "verified";
  const nurseAssignmentFeed = useNurseAssignmentFeed(shouldLoadNurseAssignments);

  // Keep the dashboard stable during background refetches.
  const showInitialLoading = isLoading && !user && !error;

  if (showInitialLoading) return <div data-testid="dashboard-loading">Loading...</div>;
  if (error && !user) return <div>Error: {error.message}</div>;
  if (!user) return <div data-testid="dashboard-empty">Dashboard unavailable.</div>;

  const activeNurseAssignment = nurseAssignmentFeed.data?.activeAssignment ?? null;
  const recentNurseAssignments = nurseAssignmentFeed.data?.recentAssignments ?? [];
  const isVerifiedNurse = user.role === "nurse" && user.nurseProfile?.status === "verified";

  return (
    <div className="space-y-6" data-testid="dashboard-ready">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>

      <DashboardWelcomeCard user={user} />

      {isVerifiedNurse && (
        <div className="grid gap-6 md:grid-cols-2 mb-6">
          <NurseStatusCard
            isAvailable={user.nurseProfile?.isAvailable ?? false}
            status={user.nurseProfile?.status ?? "submitted"}
            licenseValidUntil={user.nurseProfile?.licenseValidUntil ?? null}
            activeAssignmentStatus={activeNurseAssignment?.status ?? null}
          />
          <NurseAssignmentCard
            specialization={user.nurseProfile?.specialization ?? null}
            activeAssignment={activeNurseAssignment}
            recentAssignments={recentNurseAssignments}
            isLoading={nurseAssignmentFeed.isLoading}
          />
        </div>
      )}

      {user.role === "nurse" && user.nurseProfile?.status && user.nurseProfile.status !== "verified" && (
        <NurseApplicationStatusCard status={user.nurseProfile.status} />
      )}

      {user.role !== "nurse" && (
        <div className="grid gap-6 md:grid-cols-2 mb-6">
          <PatientRequestCard />
          {user.nurseProfile?.status && user.nurseProfile.status !== "verified" ? (
            <NurseApplicationStatusCard status={user.nurseProfile.status} />
          ) : (
            <BecomeNurseCard />
          )}
        </div>
      )}
    </div>
  );
}
