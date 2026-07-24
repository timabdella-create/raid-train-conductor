"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function RegisterForm({ defaultRole }: { defaultRole?: "seller" | "organizer" }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: defaultRole ?? "seller" },
  });

  const selectedRole = watch("role");

  async function onSubmit(values: RegisterInput) {
    setFormError(null);
    const supabase = createClient();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          role: values.role,
          display_name: values.displayName,
          timezone,
        },
      },
    });

    if (error) {
      setFormError(error.message);
      return;
    }

    // If email confirmation is disabled in Supabase Auth settings, signUp
    // returns an active session immediately and we can go straight in.
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setConfirmationSent(true);
  }

  if (confirmationSent) {
    return (
      <div className="space-y-2 rounded-md bg-primary/10 p-4 text-sm">
        <p className="font-medium">Check your email to confirm your account.</p>
        <p className="text-muted-foreground">
          We sent a confirmation link to finish setting up your account. Once
          confirmed, log in and we'll walk you through completing your
          profile.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {formError && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {formError}
        </p>
      )}

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">I am joining as a…</legend>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex min-h-[44px] cursor-pointer items-center justify-center rounded-md border border-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10">
            <input type="radio" value="seller" className="sr-only" {...register("role")} />
            Seller
          </label>
          <label className="flex min-h-[44px] cursor-pointer items-center justify-center rounded-md border border-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10">
            <input type="radio" value="organizer" className="sr-only" {...register("role")} />
            Organizer
          </label>
        </div>
        {errors.role && <p className="mt-1 text-sm text-destructive">{errors.role.message}</p>}
      </fieldset>

      <div>
        <Label htmlFor="displayName">Name</Label>
        <Input id="displayName" autoComplete="name" {...register("displayName")} />
        {errors.displayName && (
          <p className="mt-1 text-sm text-destructive">{errors.displayName.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        {errors.email && (
          <p className="mt-1 text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...register("password")}
        />
        {errors.password && (
          <p className="mt-1 text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="mt-1 text-sm text-destructive">{errors.confirmPassword.message}</p>
        )}
      </div>

      <Button type="submit" isLoading={isSubmitting} className="w-full">
        {selectedRole === "organizer" ? "Create My Organizer Account" : "Create My Free Seller Account"}
      </Button>
    </form>
  );
}
