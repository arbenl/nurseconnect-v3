"use client";

import { useUserProfile } from "@/hooks/use-user-profile";


export default function DashboardClientPage() {

  const { user, isLoading, error } = useUserProfile();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>
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
