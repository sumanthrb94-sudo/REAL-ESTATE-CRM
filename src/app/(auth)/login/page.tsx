import { Building2 } from "lucide-react";
import { db } from "@/server/db";
import { signInAs } from "@/server/auth/actions";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { humanize } from "@/lib/utils";

export default async function LoginPage() {
  const users = await db.users.list({ orderBy: { field: "role", dir: "asc" } });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">EstateCRM</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a demo account to explore role-based access.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-2 card-shadow">
          {users.map((u) => (
            <form key={u.id} action={signInAs.bind(null, u.id)}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-muted"
              >
                <Avatar name={u.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{u.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                </span>
                <Badge tone="muted">{humanize(u.role)}</Badge>
              </button>
            </form>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Demo build · no password required · in-memory data
        </p>
      </div>
    </div>
  );
}
