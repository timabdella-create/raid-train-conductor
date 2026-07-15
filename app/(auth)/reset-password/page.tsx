import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>
            Enter the email on your account and we'll send you a reset link.
          </CardDescription>
        </CardHeader>
        <ResetPasswordForm />
      </Card>
    </main>
  );
}
