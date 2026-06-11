"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "lucide-react";
import { NAV, type NavGroup } from "@/config/nav";
import { cn } from "@/lib/utils";

function Icon({ name, className }: { name: string; className?: string }) {
  const Cmp = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name] ?? Icons.Circle;
  return <Cmp className={className} />;
}

/**
 * Mobile navigation — a hamburger button + slide-in drawer.
 * Rendered only below the `md` breakpoint (the desktop <Sidebar/> covers ≥md).
 *
 * The overlay is rendered through a portal to <body> on purpose: the topbar
 * uses `backdrop-blur`, and a backdrop-filter makes its element the containing
 * block for `position: fixed` descendants — which would pin the drawer to the
 * 64px-tall header instead of the viewport. Portalling to <body> escapes that.
 */
export function MobileNav({ visibleNav }: { visibleNav: NavGroup[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const groups = visibleNav.length ? visibleNav : NAV;

  useEffect(() => setMounted(true), []);

  // Close on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const overlay = (
    <div className="fixed inset-0 z-[100] md:hidden">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close navigation menu"
        onClick={() => setOpen(false)}
        className="absolute inset-0 h-full w-full bg-foreground/40 backdrop-blur-sm"
      />
      {/* Drawer */}
      <aside className="absolute inset-y-0 left-0 flex h-full w-72 max-w-[82%] flex-col border-r border-border bg-card shadow-xl">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Icons.Building2 className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">EstateCRM</span>
          </Link>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Icons.X className="h-5 w-5" />
          </button>
        </div>
        <nav className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const active =
                    pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                          active
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <Icon name={item.icon} className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="shrink-0 border-t border-border px-6 py-4 text-xs text-muted-foreground">v1.0 · Demo data</div>
      </aside>
    </div>
  );

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label="Open navigation menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Icons.Menu className="h-5 w-5" />
      </button>

      {mounted && open ? createPortal(overlay, document.body) : null}
    </div>
  );
}
