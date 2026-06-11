"use client";

// Collapsible "New Lead" form. Posts to createLeadAction; when no owner is
// picked the distribution engine auto-assigns one.

import * as React from "react";
import { useActionState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { createLeadAction, type ActionState } from "@/server/modules/leads.actions";
import { LEAD_SOURCES } from "@/types/domain";
import { humanize } from "@/lib/utils";

export interface Option {
  id: string;
  name: string;
}

export function LeadForm({
  projects,
  owners,
  canAssign,
}: {
  projects: Option[];
  owners: Option[];
  canAssign: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createLeadAction, {});

  React.useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  if (!open) {
    return (
      <div className="flex flex-col items-end gap-2">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New Lead
        </Button>
        {state.success ? <p className="text-xs font-medium text-success">{state.success}</p> : null}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>New Lead</CardTitle>
        <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close form">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="lead-name">Name *</Label>
            <Input id="lead-name" name="name" placeholder="Full name" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-phone">Phone *</Label>
            <Input id="lead-phone" name="phone" placeholder="+91 98xxx xxxxx" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-email">Email</Label>
            <Input id="lead-email" name="email" type="email" placeholder="name@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-source">Source</Label>
            <Select id="lead-source" name="source" defaultValue="WEBSITE">
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-temperature">Temperature</Label>
            <Select id="lead-temperature" name="temperature" defaultValue="WARM">
              <option value="HOT">Hot</option>
              <option value="WARM">Warm</option>
              <option value="COLD">Cold</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-project">Interested Project</Label>
            <Select id="lead-project" name="projectId" defaultValue="">
              <option value="">— None —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-budget-min">Budget Min (₹)</Label>
            <Input id="lead-budget-min" name="budgetMin" type="number" min={0} step={100000} placeholder="e.g. 8000000" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-budget-max">Budget Max (₹)</Label>
            <Input id="lead-budget-max" name="budgetMax" type="number" min={0} step={100000} placeholder="e.g. 12000000" />
          </div>
          {canAssign ? (
            <div className="space-y-1.5">
              <Label htmlFor="lead-owner">Owner</Label>
              <Select id="lead-owner" name="ownerId" defaultValue="">
                <option value="">Auto-assign via rules</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="lead-requirement">Requirement</Label>
            <Textarea
              id="lead-requirement"
              name="requirement"
              placeholder="e.g. 3BHK in Powai, east facing, possession within a year"
              rows={2}
            />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create Lead"}
            </Button>
            {state.error ? <p className="text-sm font-medium text-destructive">{state.error}</p> : null}
            {state.success ? <p className="text-sm font-medium text-success">{state.success}</p> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
