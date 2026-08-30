import { Building2 } from "lucide-react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Sign in · EstateCRM" };

export default async function LoginPage() {
  // Already signed in? Don't show the form again.
  if (await getSessionUser()) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">EstateCRM</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to continue.</p>
        </div>

        <LoginForm />
      </div>
    </div>
  );
}
