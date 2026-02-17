"use client";

import { BecomeNurseCard } from "@/components/dashboard/become-nurse-card";
import { NurseAssignmentCard } from "@/components/dashboard/nurse-assignment-card";
import { NurseStatusCard } from "@/components/dashboard/nurse-status-card";
import { PatientRequestCard } from "@/components/dashboard/patient-request-card";
import { useUserProfile } from "@/hooks/use-user-profile";


export default function DashboardClientPage() {

  const { user, isLoading, error } = useUserProfile();

  if (isLoading) return <div data-testid="dashboard-loading">Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="p-8" data-testid="dashboard-ready">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>
      

      {user?.role === "nurse" && (
        <div className="grid gap-6 md:grid-cols-2 mb-6">
          <NurseStatusCard isAvailable={user.nurseProfile?.isAvailable ?? false} />
          <NurseAssignmentCard />
        </div>
      )}

      {user?.role !== "nurse" && (
        <div className="grid gap-6 md:grid-cols-2 mb-6">
          <PatientRequestCard />
          <BecomeNurseCard />
        </div>
      )}

      <p className="mt-4">Welcome, {user?.name || user?.email}!</p>
      <p>
        Your assigned role is: <strong>{user?.role}</strong>
      </p>
      <div className="mt-6 p-4 bg-gray-50 rounded-md overflow-x-auto">
        <h3 className="font-semibold">User Details:</h3>
        <pre className="text-sm">{JSON.stringify(user, null, 2)}</pre>
      </div>
    </div>
  );
}
