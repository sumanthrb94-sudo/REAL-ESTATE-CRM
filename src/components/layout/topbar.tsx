import { Search, Bell } from "lucide-react";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { MobileNav } from "@/components/layout/mobile-nav";
import { humanize } from "@/lib/utils";
import type { NavGroup } from "@/config/nav";
import type { User } from "@/types/domain";

export function Topbar({ user, visibleNav }: { user: User; visibleNav: NavGroup[] }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-card/80 px-4 backdrop-blur sm:px-6">
      <div className="flex flex-1 items-center gap-3">
        <MobileNav visibleNav={visibleNav} />
        <div className="relative hidden w-full max-w-sm items-center sm:flex">
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search leads, projects, partners…"
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button className="relative rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
        </button>
        <div className="flex items-center gap-3">
          <Avatar name={user.name} />
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <Badge tone="muted" className="mt-1">{humanize(user.role)}</Badge>
          </div>
        </div>
      </div>
    </header>
  );
}
