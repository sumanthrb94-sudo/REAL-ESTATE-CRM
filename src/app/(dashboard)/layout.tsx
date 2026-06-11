import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { NAV } from "@/config/nav";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  // RBAC-filter the navigation for this user's role.
  const visibleNav = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || can(user.role, item.permission)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex min-h-screen">
      <Sidebar visibleNav={visibleNav} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} />
        <main className="flex-1 space-y-6 p-6">{children}</main>
      </div>
    </div>
  );
}
