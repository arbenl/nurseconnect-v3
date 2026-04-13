
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

const formSchema = z.object({
  licenseNumber: z.string().min(1, "License number is required"),
  specialization: z.string().min(1, "Specialization is required"),
  licenseJurisdiction: z.string().min(1, "Jurisdiction is required"),
});

export function BecomeNurseCard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      licenseNumber: "",
      licenseJurisdiction: "",
      specialization: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const response = await fetch("/api/me/become-nurse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update role");
      }

      toast({
        title: "Application submitted",
        description: "You'll be notified when your application is reviewed.",
      });

      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.refresh();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card data-testid="become-nurse-card">
      <CardHeader>
        <CardTitle>Apply to Join as a Nurse</CardTitle>
        <CardDescription>
            Submit your credentials to join our care network. We will review your application shortly.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="licenseNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>License Number</FormLabel>
                  <FormControl>
                    <Input placeholder="RN-12345" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="licenseJurisdiction"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>License Jurisdiction</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. CA, NY" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="specialization"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Specialization</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Pediatrics, Geriatrics" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Submitting..." : "Submit Application"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
