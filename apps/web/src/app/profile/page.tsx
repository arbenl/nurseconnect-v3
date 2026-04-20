"use client";
import { useEffect, useState } from "react";

type Role = "patient" | "nurse" | "admin" | "referral_partner";
type Profile = { id: string; displayName?: string; role?: Role };

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => {
        if (mounted) setProfile(data);
      })
      .catch(async (r) => {
        const msg =
          typeof r?.json === "function"
            ? (await r.json())?.error
            : "Failed to load profile";
        if (mounted) setError(String(msg ?? "Failed to load profile"));
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!profile && !error) {
    return <div className="p-6 text-sm opacity-80">Loading profile…</div>;
  }

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <p className="text-sm text-yellow-700">
          <strong>Legacy Page:</strong> This is a read-only diagnostic view. Profile updates are now managed through the main dashboard.
        </p>
      </div>

      <h1 className="text-2xl font-semibold">Your Profile</h1>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {profile && (
        <div className="grid gap-6 mt-6">
          <div className="grid gap-1">
            <span className="text-sm font-medium text-gray-500">Email / ID</span>
            <span className="text-base font-mono bg-gray-50 p-2 rounded">{profile.id}</span>
          </div>

          <div className="grid gap-1">
            <span className="text-sm font-medium text-gray-500">Display Name</span>
            <span className="text-base">{profile.displayName || "Not set"}</span>
          </div>

          <div className="grid gap-1">
            <span className="text-sm font-medium text-gray-500">System Role</span>
            <span className="text-base font-semibold capitalize bg-gray-100 w-fit px-3 py-1 rounded inline-block">
              {profile.role ?? "patient"}
            </span>
          </div>
        </div>
      )}
    </main>
  );
}
