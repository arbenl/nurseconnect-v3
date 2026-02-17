"use client";

import * as React from "react";
import { useForm } from "react-hook-form";

import { Form, FormField, FormItem, FormControl, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

type LoginFormValues = { email: string; password: string };

export default function LoginForm() {
  const form = useForm<LoginFormValues>({ defaultValues: { email: "", password: "" } });

  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const onSubmit = async (_data: LoginFormValues) => {
    // You can call your sign-in action here (emulator-aware).
    // e.g. await signInWithEmailAndPassword(getAuth(app), values.email, values.password);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <button className="btn btn-primary" type="submit">
          Sign in
        </button>
      </form>
    </Form>
  );
}