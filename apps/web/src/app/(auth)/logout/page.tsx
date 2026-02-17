"use client";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LogoutPage() {
  const router = useRouter();

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/auth/login");
        },
      },
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
            <CardTitle>Sign Out</CardTitle>
            <CardDescription>Are you sure you want to sign out?</CardDescription>
        </CardHeader>
        <CardContent>
            <Button variant="destructive" onClick={handleLogout} className="w-full">
                Sign Out
            </Button>
            <Button variant="ghost" onClick={() => router.back()} className="mt-2 w-full">
                Cancel
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}
