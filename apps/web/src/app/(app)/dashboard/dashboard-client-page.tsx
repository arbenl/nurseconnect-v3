"use client";

import { NurseStatusCard } from "@/components/dashboard/nurse-status-card";
import { useUserProfile } from "@/hooks/use-user-profile";


export default function DashboardClientPage() {

  const { user, isLoading, error } = useUserProfile();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>
      
      {user?.role === "nurse" && (
        <div className="mb-6">
          {/* We need to pass initial availability. 
              Since useUserProfile might not populate detailed nurse fields yet, 
              we rely on the card to fetch or we need to update useUserProfile.
              For now, let's assume useUserProfile returns the extended profile or we fetch it.
              Actually, the user object from /api/me (which useUserProfile uses) 
              should be updated to include nurse details if we want to pass initial state.
              
              However, for optimized rendering, the NurseStatusCard could fetch its own initial state 
              OR we update /api/me to include 'isAvailable'.
              
              Let's check useUserProfile implementation briefly.
          */}
          <NurseStatusCard isAvailable={user.nurseProfile?.isAvailable ?? false} />
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
