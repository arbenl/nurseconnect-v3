"use client";

import type { ServiceAreaStatus } from "@nurseconnect/contracts";
import { PauseCircle, PlayCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

type ServiceAreaStatusActionsProps = {
  id: string;
  status: ServiceAreaStatus;
};

export function ServiceAreaStatusActions({
  id,
  status,
}: ServiceAreaStatusActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const nextStatus: ServiceAreaStatus = status === "active" ? "paused" : "active";

  async function submit() {
    setError(null);
    const response = await fetch(`/api/admin/service-areas/${id}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(typeof body?.error === "string" ? body.error : `Request failed with status ${response.status}`);
      return;
    }

    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col items-start gap-2 md:items-end">
      <Button
        type="button"
        variant={status === "active" ? "outline" : "default"}
        size="sm"
        disabled={isPending}
        onClick={() => void submit()}
      >
        {nextStatus === "paused" ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
        {nextStatus === "paused" ? "Pause" : "Reactivate"}
      </Button>
      {error ? <p className="max-w-64 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
