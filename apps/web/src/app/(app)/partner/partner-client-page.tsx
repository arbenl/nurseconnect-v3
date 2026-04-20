"use client";

import { useEffect, useState } from "react";

import { PartnerDashboardCard } from "@/components/partner/partner-dashboard-card";
import { PartnerRequestForm } from "@/components/partner/partner-request-form";
import { PartnerRequestList } from "@/components/partner/partner-request-list";

type PartnerRequestListItem = {
  id: string;
  status: string;
  address: string;
  requestType: string;
  careType: string | null;
  createdAt: string;
  patient: {
    firstName: string | null;
    lastName: string | null;
  };
};

export default function PartnerClientPage() {
  const [items, setItems] = useState<PartnerRequestListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadItems() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/partner/requests");
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to load partner requests");
      }
      const body = await res.json();
      setItems(body.items ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load partner requests");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
  }, []);

  return (
    <div className="space-y-6">
      <PartnerDashboardCard totalRequests={items.length} recentRequests={Math.min(items.length, 5)} />
      <PartnerRequestForm onCreated={loadItems} />
      {isLoading ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
          Loading referrals...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <PartnerRequestList items={items} />
      )}
    </div>
  );
}
