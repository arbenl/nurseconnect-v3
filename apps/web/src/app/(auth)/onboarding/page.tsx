"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useRef, useState } from "react";
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

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().min(1, "Phone number is required"),
  city: z.string().min(1, "City is required"),
  address: z.string().optional(),
});

const nurseSchema = z.object({
  licenseNumber: z.string().min(1, "License number is required"),
  specialization: z.string().min(1, "Specialization is required"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type NurseFormValues = z.infer<typeof nurseSchema>;

export default function OnboardingPage() {
  const { data: session } = authClient.useSession();
  const { user, profileComplete, isLoading, mutateProfile, mutateNurseProfile } = useUserProfile();
  const [step, setStep] = useState(1);
  const didRedirectRef = useRef(false);

  const navigateToDashboard = useCallback(() => {
    if (didRedirectRef.current) return;
    didRedirectRef.current = true;
    // Force a full navigation to avoid stale client-side route cache loops
    // between /onboarding and /dashboard after profile completion.
    window.location.assign("/dashboard");
  }, []);

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

  const nurseForm = useForm<NurseFormValues>({
    resolver: zodResolver(nurseSchema),
    defaultValues: {
      licenseNumber: "",
      specialization: "",
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
    if (user?.nurseProfile) {
      nurseForm.reset({
        licenseNumber: user.nurseProfile.licenseNumber || "",
        specialization: user.nurseProfile.specialization || "",
      });
    }
  }, [user, form, nurseForm]);

  // Redirect if already complete
  useEffect(() => {
    if (profileComplete) {
      navigateToDashboard();
    }
  }, [navigateToDashboard, profileComplete]);

  async function onProfileSubmit(data: ProfileFormValues) {
    try {
      await mutateProfile.mutateAsync(data);
      if (user?.role === "nurse") {
        setStep(2);
      } else {
        navigateToDashboard();
      }
    } catch (error) {
      console.error("Profile update error:", error);
    }
  }

  async function onNurseSubmit(data: NurseFormValues) {
    try {
      if (mutateNurseProfile) {
        await mutateNurseProfile.mutateAsync(data);
        navigateToDashboard();
      }
    } catch (error) {
      console.error("Nurse profile update error:", error);
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

  // Step 2: Nurse Details
  if (step === 2 && user?.role === "nurse") {
    return (
      <div key="step2" className="container max-w-md mx-auto py-10">
        <h1 className="text-2xl font-bold mb-6">Nurse Details</h1>
        <p className="text-muted-foreground mb-6">
          Please provide your professional details.
        </p>

        <Form {...nurseForm}>
          <form onSubmit={nurseForm.handleSubmit(onNurseSubmit)} className="space-y-6" autoComplete="off">
            <FormField
              control={nurseForm.control}
              name="licenseNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>License Number</FormLabel>
                  <FormControl>
                    <Input placeholder="RN-12345" {...field} autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={nurseForm.control}
              name="specialization"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Specialization</FormLabel>
                  <FormControl>
                    <Input placeholder="Pediatrics, Geriatrics..." {...field} autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-4">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button type="submit" className="flex-1">
                Complete Onboarding
              </Button>
            </div>
          </form>
        </Form>
      </div>
    );
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
            {user?.role === "nurse" ? "Next: Nurse Details" : "Save and Continue"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
