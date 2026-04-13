"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type QueueItem = {
  id: string;
  userId: string;
  status: string;
  licenseNumber: string | null;
  licenseJurisdiction: string | null;
  specialization: string | null;
  updatedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}

export default function AdminNurseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [nurse, setNurse] = useState<QueueItem | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [validUntil, setValidUntil] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [reason, setReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    // A real app might have a direct GET /api/admin/nurses/[id] 
    // Here we fetch the queue and find the item
    fetch("/api/admin/nurses")
      .then((res) => res.json())
      .then((data) => {
        if (data.items) {
          const item = data.items.find((i: QueueItem) => i.id === resolvedParams.id);
          if (item) {
            setNurse(item);
            setJurisdiction(item.licenseJurisdiction || "");
          }
        }
      })
      .finally(() => setLoading(false));
  }, [resolvedParams.id]);

  const onVerify = async () => {
    if (!validUntil) return alert("Valid until date is required");
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/nurses/${resolvedParams.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseValidUntil: new Date(validUntil).toISOString(),
          licenseJurisdiction: jurisdiction || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to verify");
      router.push("/admin/nurses");
    } catch (error: unknown) {
      alert(getErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const onReject = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/nurses/${resolvedParams.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error("Failed to reject");
      router.push("/admin/nurses");
    } catch (error: unknown) {
      alert(getErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const onSuspend = async () => {
    if (!reason) return alert("Suspend reason is required");
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/nurses/${resolvedParams.id}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error("Failed to suspend");
      router.push("/admin/nurses");
    } catch (error: unknown) {
      alert(getErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="container py-8">Loading...</div>;
  if (!nurse) return <div className="container py-8">Nurse not found.</div>;

  return (
    <div className="container py-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Review Application</h1>
        <p className="text-muted-foreground mt-2">
          Verify credentials for {nurse.user.name || nurse.user.email}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Profile Details</span>
            <Badge variant="outline" className="uppercase">{nurse.status}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">User ID</Label>
              <div className="font-mono text-sm">{nurse.userId}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">Nurse ID</Label>
              <div className="font-mono text-sm">{nurse.id}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">Name</Label>
              <div>{nurse.user.name || "N/A"}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">Email</Label>
              <div>{nurse.user.email}</div>
            </div>
          </div>
          <hr />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">License Number</Label>
              <div className="font-mono">{nurse.licenseNumber || "N/A"}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">Specialization</Label>
              <div>{nurse.specialization || "N/A"}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verification Action</CardTitle>
          <CardDescription>
            Input the verified details to approve, or provide a reason to reject/suspend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="jurisdiction">License Jurisdiction (State/Region)</Label>
            <Input id="jurisdiction" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="validUntil">License Valid Until</Label>
            <Input id="validUntil" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
          <div className="grid gap-2 mt-4 pt-4 border-t">
            <Label htmlFor="reason">Reject / Suspend Reason</Label>
            <Input id="reason" placeholder="Required for suspension, optional for rejection" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </CardContent>
        <CardFooter className="flex gap-2 border-t pt-6">
          <Button onClick={onVerify} disabled={actionLoading || !validUntil} className="bg-green-600 hover:bg-green-700">
            Verify & Approve
          </Button>
          <Button onClick={onReject} disabled={actionLoading} variant="outline" className="text-red-600 border-red-200">
            Reject
          </Button>
          <Button onClick={onSuspend} disabled={actionLoading || !reason} variant="destructive">
            Suspend
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
