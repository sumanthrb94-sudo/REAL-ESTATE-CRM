import { KeyRound } from "lucide-react";
import Link from "next/link";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { MIN_PASSWORD_LENGTH } from "@/server/auth/password";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Change password · EstateCRM" };

export default async function ChangePasswordPage() {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Change password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user.mustChangePassword
              ? "Your password was reset by an administrator. Choose a new one to continue."
              : `Update the password for ${user.email}.`}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 card-shadow">
          <ChangePasswordForm minLength={MIN_PASSWORD_LENGTH} />
        </div>

        {!user.mustChangePassword ? (
          <p className="text-center text-xs text-muted-foreground">
            <Link href="/dashboard" className="underline underline-offset-2">
              Back to dashboard
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
