"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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

function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

export default function AdminNursesQueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/nurses")
      .then((res) => res.json())
      .then((data) => {
        if (data.items) {
          setItems(data.items);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container py-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Credential Review Queue</h1>
        <p className="text-muted-foreground mt-2">
          Review and verify nurses that have applied to join the network.
        </p>
      </div>

      {loading ? (
        <div className="py-4">Loading queue...</div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground h-48 flex items-center justify-center">
            No pending nurse applications.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <div className="flex flex-col sm:flex-row items-start sm:items-center p-6 gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{item.user.name || "Unknown User"}</h3>
                    <Badge variant={item.status === "rejected" ? "destructive" : "secondary"}>
                      {item.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-x-2">
                    <span>{item.user.email}</span>
                    <span>•</span>
                    <span>License: {item.licenseNumber || "N/A"} ({item.licenseJurisdiction || "N/A"})</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Applied: {formatRelativeTime(item.updatedAt)}
                  </div>
                </div>
                <div>
                  <Link
                    href={`/admin/nurses/${item.id}`}
                    className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
                  >
                    Review
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
