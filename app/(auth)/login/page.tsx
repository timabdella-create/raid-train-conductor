import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Log in</CardTitle>
          <CardDescription>Welcome back to Raid Train Conductor.</CardDescription>
        </CardHeader>
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
      </Card>
    </main>
  );
}
