import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import { GoogleButton } from "@/components/auth/google-button";
import { AuthShell } from "@/components/auth/auth-shell";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function RegisterPage() {
  return (
    <AuthShell>
      <CardHeader>
        <CardTitle className="font-display">Create your account</CardTitle>
        <CardDescription>
          Join as a seller to find raid trains, or an organizer to run your own.
        </CardDescription>
      </CardHeader>

      <GoogleButton />

      <div className="my-4 flex items-center gap-3 text-xs uppercase text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or continue with email
        <span className="h-px flex-1 bg-border" />
      </div>

      <RegisterForm />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
