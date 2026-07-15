import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { GoogleButton } from "@/components/auth/google-button";
import { AuthShell } from "@/components/auth/auth-shell";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <AuthShell>
      <CardHeader>
        <CardTitle className="font-display">Log in</CardTitle>
        <CardDescription>Welcome back to Raid Train Conductor.</CardDescription>
      </CardHeader>

      <GoogleButton />

      <div className="my-4 flex items-center gap-3 text-xs uppercase text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or continue with email
        <span className="h-px flex-1 bg-border" />
      </div>

      <Suspense>
        <LoginForm />
      </Suspense>
      <div className="mt-4 flex items-center justify-between text-sm">
        <Link href="/reset-password" className="text-muted-foreground hover:underline">
          Forgot password?
        </Link>
        <Link href="/register" className="font-medium hover:underline">
          Create an account
        </Link>
      </div>
    </AuthShell>
  );
}
