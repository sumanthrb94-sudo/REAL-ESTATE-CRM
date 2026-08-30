import { MobileNav } from "@/components/layout/mobile-nav";
import { GlobalSearch } from "@/components/layout/global-search";
import { Notifications } from "@/components/layout/notifications";
import { AccountMenu } from "@/components/layout/account-menu";
import { getAlerts } from "@/server/modules/alerts";
import { db } from "@/server/db";
import type { NavGroup } from "@/config/nav";
import type { PublicUser } from "@/types/domain";

export async function Topbar({
  user,
  visibleNav,
}: {
  user: PublicUser;
  visibleNav: NavGroup[];
}) {
  // getAlerts needs the full User for its role checks; re-read rather than
  // threading the secret-bearing record down through the component tree.
  const full = await db.users.find(user.id);
  const alerts = full ? await getAlerts(full) : [];

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-card/80 px-4 backdrop-blur sm:px-6">
      <div className="flex flex-1 items-center gap-3">
        <MobileNav visibleNav={visibleNav} />
        <GlobalSearch />
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <Notifications alerts={alerts} />
        <AccountMenu user={user} />
      </div>
    </header>
  );
}
