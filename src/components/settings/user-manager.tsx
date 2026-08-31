"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Plus, ShieldCheck, UserMinus, UserPlus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ResponsiveRecords } from "@/components/ui/record-list";
import { Avatar } from "@/components/ui/misc";
import {
  createUserAction,
  resetPasswordAction,
  setUserActiveAction,
  updateUserAction,
  type ActionState,
} from "@/server/modules/users.actions";
import type { UserRow } from "@/server/modules/users";
import { ROLES, type Role } from "@/types/domain";
import { cn, formatDate, humanize } from "@/lib/utils";

/**
 * One definition of a user's state, shared by the table and the phone list so
 * the two renderings cannot drift apart.
 */
function statusBadge(u: { active: boolean; passwordSet: boolean; mustChangePassword?: boolean }) {
  if (!u.active) return <Badge tone="destructive">Deactivated</Badge>;
  if (!u.passwordSet) return <Badge tone="warning">No password</Badge>;
  if (u.mustChangePassword) return <Badge tone="warning">Must reset</Badge>;
  return <Badge tone="success">Active</Badge>;
}

const ROLE_HELP: Record<Role, string> = {
  ADMIN: "Everything, including user management.",
  SALES_HEAD: "All leads and bookings, partner management, reports.",
  SALES_MANAGER: "Their team's leads, bookings, partners and reports.",
  SALES_AGENT: "Only their own leads, plus inventory and bookings.",
  MARKETING: "Campaigns, templates, segments and reports.",
  CHANNEL_PARTNER: "Read-only view of leads and inventory.",
  VIEWER: "Read-only across the app.",
};

export function UserManager({
  users,
  currentUserId,
  minPasswordLength,
}: {
  users: UserRow[];
  currentUserId: string;
  minPasswordLength: number;
}) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [resettingId, setResettingId] = React.useState<string | null>(null);
  const [rowState, setRowState] = React.useState<ActionState>({});
  const formRef = React.useRef<HTMLFormElement>(null);

  const [createState, createFormAction, creating] = useActionState<ActionState, FormData>(
    createUserAction,
    {},
  );

  React.useEffect(() => {
    if (createState.success) {
      formRef.current?.reset();
      setAdding(false);
      router.refresh();
    }
  }, [createState, router]);

  async function onToggleActive(user: UserRow) {
    const verb = user.active ? "Deactivate" : "Reactivate";
    if (!window.confirm(`${verb} ${user.name}?`)) return;
    setRowState(await setUserActiveAction(user.id, !user.active));
    router.refresh();
  }

  async function onChangeRole(user: UserRow, role: Role) {
    setRowState(await updateUserAction(user.id, { role }));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {createState.success ? (
        <p className="rounded-md border border-success/40 bg-success/5 px-4 py-3 text-sm font-medium text-success">
          {createState.success}
        </p>
      ) : null}
      {rowState.error ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
          {rowState.error}
        </p>
      ) : null}
      {rowState.success ? (
        <p className="rounded-md border border-success/40 bg-success/5 px-4 py-3 text-sm font-medium text-success">
          {rowState.success}
        </p>
      ) : null}

      {adding ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Add a user</CardTitle>
            <Button variant="ghost" size="icon" aria-label="Close" onClick={() => setAdding(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form ref={formRef} action={createFormAction} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="u-name">Name *</Label>
                <Input id="u-name" name="name" required maxLength={80} placeholder="Full name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-email">Email *</Label>
                <Input id="u-email" name="email" type="email" required placeholder="name@company.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-phone">Phone</Label>
                <Input id="u-phone" name="phone" placeholder="+91 98xxx xxxxx" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-role">Role *</Label>
                <Select id="u-role" name="role" defaultValue="SALES_AGENT">
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {humanize(r)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="u-password">Temporary password *</Label>
                <Input
                  id="u-password"
                  name="password"
                  type="password"
                  minLength={minPasswordLength}
                  required
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">
                  At least {minPasswordLength} characters. Share it with them once — they must
                  choose their own the first time they sign in.
                </p>
              </div>
              <div className="flex items-center gap-3 sm:col-span-2">
                <Button type="submit" disabled={creating}>
                  {creating ? "Creating…" : "Create user"}
                </Button>
                {createState.error ? (
                  <p role="alert" className="text-sm font-medium text-destructive">
                    {createState.error}
                  </p>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="flex justify-end">
          <Button onClick={() => setAdding(true)}>
            <UserPlus className="h-4 w-4" /> Add user
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="pt-5">
          <ResponsiveRecords
            items={users.map((u) => ({
              id: u.id,
              title: (
                <>
                  {u.name}
                  {u.id === currentUserId ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">you</span>
                  ) : null}
                </>
              ),
              subtitle: u.email,
              badges: statusBadge(u),
              meta: [
                humanize(u.role),
                u.lastLoginAt ? `Last seen ${formatDate(u.lastLoginAt)}` : "Never signed in",
              ],
              actions: (
                <div className="space-y-2">
                  <Select
                    aria-label={`Role for ${u.name}`}
                    value={u.role}
                    onChange={(e) => onChangeRole(u, e.target.value as Role)}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {humanize(r)}
                      </option>
                    ))}
                  </Select>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setResettingId(resettingId === u.id ? null : u.id)}
                    >
                      <KeyRound className="h-4 w-4" /> Reset
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn("flex-1", u.active ? "text-destructive" : "text-success")}
                      onClick={() => onToggleActive(u)}
                      disabled={u.id === currentUserId}
                    >
                      {u.active ? (
                        <>
                          <UserMinus className="h-4 w-4" /> Deactivate
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-4 w-4" /> Reactivate
                        </>
                      )}
                    </Button>
                  </div>
                  {resettingId === u.id ? (
                    <div className="rounded-md bg-muted/40 p-3">
                      <ResetPasswordForm
                        userId={u.id}
                        userName={u.name}
                        minLength={minPasswordLength}
                        onDone={() => setResettingId(null)}
                      />
                    </div>
                  ) : null}
                </div>
              ),
            }))}
          >
          <Table>
            <THead>
              <TR>
                <TH>User</TH>
                <TH className="w-48">Role</TH>
                <TH>Status</TH>
                <TH>Last sign-in</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {users.map((u) => (
                <React.Fragment key={u.id}>
                  <TR className={u.active ? undefined : "opacity-60"}>
                    <TD>
                      <span className="flex items-center gap-2.5">
                        <Avatar name={u.name} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {u.name}
                            {u.id === currentUserId ? (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">you</span>
                            ) : null}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                        </span>
                      </span>
                    </TD>
                    <TD>
                      <Select
                        aria-label={`Role for ${u.name}`}
                        value={u.role}
                        onChange={(e) => onChangeRole(u, e.target.value as Role)}
                        title={ROLE_HELP[u.role]}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {humanize(r)}
                          </option>
                        ))}
                      </Select>
                    </TD>
                    <TD>
                      {statusBadge(u)}
                    </TD>
                    <TD className="whitespace-nowrap text-xs text-muted-foreground">
                      {u.lastLoginAt ? formatDate(u.lastLoginAt) : "Never"}
                    </TD>
                    <TD>
                      <span className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setResettingId(resettingId === u.id ? null : u.id)}
                        >
                          <KeyRound className="h-4 w-4" /> Reset
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onToggleActive(u)}
                          disabled={u.id === currentUserId}
                          className={u.active ? "text-destructive" : "text-success"}
                        >
                          {u.active ? (
                            <>
                              <UserMinus className="h-4 w-4" /> Deactivate
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="h-4 w-4" /> Reactivate
                            </>
                          )}
                        </Button>
                      </span>
                    </TD>
                  </TR>
                  {resettingId === u.id ? (
                    <TR>
                      <TD colSpan={5} className="bg-muted/40">
                        <ResetPasswordForm
                          userId={u.id}
                          userName={u.name}
                          minLength={minPasswordLength}
                          onDone={() => setResettingId(null)}
                        />
                      </TD>
                    </TR>
                  ) : null}
                </React.Fragment>
              ))}
            </TBody>
          </Table>
          </ResponsiveRecords>
        </CardContent>
      </Card>
    </div>
  );
}

function ResetPasswordForm({
  userId,
  userName,
  minLength,
  onDone,
}: {
  userId: string;
  userName: string;
  minLength: number;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    resetPasswordAction.bind(null, userId),
    {},
  );

  React.useEffect(() => {
    if (state.success) {
      const t = setTimeout(onDone, 2500);
      return () => clearTimeout(t);
    }
  }, [state, onDone]);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 py-1">
      <div className="space-y-1.5">
        <Label htmlFor={`reset-${userId}`}>New password for {userName}</Label>
        <Input
          id={`reset-${userId}`}
          name="password"
          type="password"
          minLength={minLength}
          required
          autoComplete="new-password"
          className="w-64"
        />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Set password"}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onDone}>
        Cancel
      </Button>
      {state.error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.success ? <p className="text-sm font-medium text-success">{state.success}</p> : null}
    </form>
  );
}

export { Plus };
