"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, KeyRound, LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { signOut } from "@/server/auth/actions";
import { humanize } from "@/lib/utils";
import type { PublicUser } from "@/types/domain";

export function AccountMenu({ user }: { user: PublicUser }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-3 rounded-md p-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar name={user.name} />
        <span className="hidden text-right sm:block">
          <span className="block text-sm font-medium leading-none">{user.name}</span>
          <Badge tone="muted" className="mt-1">
            {humanize(user.role)}
          </Badge>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-md border border-border bg-card shadow-lg">
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <div className="py-1">
            <Link
              href="/account/password"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-muted"
            >
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              Change password
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-muted"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
