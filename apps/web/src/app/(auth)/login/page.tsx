"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    setLoading(true);
    await authClient.signIn.email({
        email,
        password,
    }, {
        onSuccess: () => {
            router.push("/dashboard");
        },
        onError: (ctx) => {
            alert(ctx.error.message);
            setLoading(false);
        },
    });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Welcome Back</CardTitle>
            <CardDescription className="text-center">Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                    id="email" 
                    type="email" 
                    placeholder="name@example.com"
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                    id="password" 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                />
            </div>
            <Button onClick={handleLogin} className="w-full" disabled={loading}>
                {loading ? "Signing In..." : "Sign In"}
            </Button>
        </CardContent>
        <CardFooter className="justify-center">
            <p className="text-sm text-gray-500">
                Don&apos;t have an account? <Link href="/auth/signup" className="text-blue-600 hover:underline">Sign up</Link>
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}
