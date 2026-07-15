import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <CardHeader>
        <CardTitle className="font-display">Reset your password</CardTitle>
        <CardDescription>
          Enter the email on your account and we&apos;ll send you a reset link.
        </CardDescription>
      </CardHeader>
      <ResetPasswordForm />
    </AuthShell>
  );
}
