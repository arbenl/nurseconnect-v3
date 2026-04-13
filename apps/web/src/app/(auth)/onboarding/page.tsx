"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useUserProfile } from "@/hooks/use-user-profile";
import { authClient } from "@/lib/auth-client";
import { getCanonicalRouteForRole } from "@/lib/canonical-routes";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().min(1, "Phone number is required"),
  city: z.string().min(1, "City is required"),
  address: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function OnboardingPage() {
  const { data: session } = authClient.useSession();
  const { user, profileComplete, isLoading, mutateProfile } = useUserProfile();
  const didRedirectRef = useRef(false);

  const navigateToDashboard = useCallback(() => {
    if (didRedirectRef.current) return;
    didRedirectRef.current = true;
    // Force a full navigation to avoid stale client-side route cache loops
    // between /onboarding and /dashboard after profile completion.
    const target = getCanonicalRouteForRole(user?.role) ?? "/dashboard";
    window.location.assign(target);
  }, [user?.role]);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      city: "",
      address: "",
    },
  });

  // Pre-fill form if data exists
  useEffect(() => {
    if (user?.profile) {
      form.reset({
        firstName: user.profile.firstName || "",
        lastName: user.profile.lastName || "",
        phone: user.profile.phone || "",
        city: user.profile.city || "",
        address: user.profile.address || "",
      });
    }
  }, [user, form]);

  // Redirect if already complete
  useEffect(() => {
    if (profileComplete) {
      navigateToDashboard();
    }
  }, [navigateToDashboard, profileComplete]);

  async function onProfileSubmit(data: ProfileFormValues) {
    try {
      await mutateProfile.mutateAsync(data);
      navigateToDashboard();
    } catch (error) {
      console.error("Profile update error:", error);
    }
  }



  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (!session) {
    // return null; 
  }



  // Step 1: Basic Profile
  return (
    <div key="step1" className="container max-w-md mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Complete Your Profile</h1>
      <p className="text-muted-foreground mb-6">
        Please provide your details to continue to the dashboard.
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onProfileSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input placeholder="John" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input placeholder="Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <Input placeholder="+1234567890" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input placeholder="New York" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="123 Main St" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full">
            Save and Continue
          </Button>
        </form>
      </Form>
    </div>
  );
}
