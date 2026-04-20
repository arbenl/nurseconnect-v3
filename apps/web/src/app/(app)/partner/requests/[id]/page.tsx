"use client";

import { useEffect, useState } from "react";

import { PartnerRequestDetail } from "@/components/partner/partner-request-detail";

type PartnerRequestDetailPageProps = {
  params: {
    id: string;
  };
};

type Detail = {
  id: string;
  status: string;
  address: string;
  requestType: string;
  scheduledFor: string | null;
  careType: string | null;
  createdAt: string;
  patient: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    city: string | null;
  };
};

export default function PartnerRequestDetailPage({ params }: PartnerRequestDetailPageProps) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    fetch(`/api/partner/requests/${params.id}`)
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error ?? "Failed to load request detail");
        }
        return response.json();
      })
      .then((payload) => {
        if (mounted) {
          setDetail(payload);
        }
      })
      .catch((detailError) => {
        if (mounted) {
          setError(detailError instanceof Error ? detailError.message : "Failed to load request detail");
        }
      });

    return () => {
      mounted = false;
    };
  }, [params.id]);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
        Loading referral detail...
      </div>
    );
  }

  return <PartnerRequestDetail detail={detail} />;
}
