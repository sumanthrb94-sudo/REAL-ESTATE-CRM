import { PageHeader } from "@/components/ui/misc";
import { UserManager } from "@/components/settings/user-manager";
import { requirePermission } from "@/server/auth/guard";
import { MIN_PASSWORD_LENGTH } from "@/server/auth/password";
import { listUsers } from "@/server/modules/users";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users · EstateCRM" };

export default async function UsersPage() {
  const [user, users] = await Promise.all([requirePermission("user.manage"), listUsers()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Who can sign in, and what each of them is allowed to see."
      />
      <UserManager
        users={users}
        currentUserId={user.id}
        minPasswordLength={MIN_PASSWORD_LENGTH}
      />
    </div>
  );
}
