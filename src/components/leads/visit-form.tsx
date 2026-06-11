"use client";

// Collapsible "Schedule Visit" form for the /site-visits page.

import * as React from "react";
import { useActionState } from "react";
import { CalendarPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import type { ActionState } from "@/server/modules/leads.actions";
import { scheduleVisitAction } from "@/server/modules/site-visits.actions";
import type { Option } from "@/components/leads/lead-form";

export function VisitForm({
  leads,
  projects,
  agents,
}: {
  leads: Option[];
  projects: Option[];
  agents: Option[];
}) {
  const [open, setOpen] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(scheduleVisitAction, {});

  React.useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  if (!open) {
    return (
      <div className="flex flex-col items-end gap-2">
        <Button onClick={() => setOpen(true)}>
          <CalendarPlus className="h-4 w-4" /> Schedule Visit
        </Button>
        {state.success ? <p className="text-xs font-medium text-success">{state.success}</p> : null}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Schedule Site Visit</CardTitle>
        <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close form">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="visit-lead">Lead *</Label>
            <Select id="visit-lead" name="leadId" defaultValue="" required>
              <option value="" disabled>
                Pick a lead…
              </option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="visit-project">Project</Label>
            <Select id="visit-project" name="projectId" defaultValue="">
              <option value="">Lead&apos;s project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="visit-agent">Agent</Label>
            <Select id="visit-agent" name="agentId" defaultValue="">
              <option value="">Lead&apos;s owner</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="visit-when">Date &amp; Time *</Label>
            <Input id="visit-when" name="scheduledAt" type="datetime-local" required />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
            <Button type="submit" disabled={pending}>
              {pending ? "Scheduling…" : "Schedule Visit"}
            </Button>
            {state.error ? <p className="text-sm font-medium text-destructive">{state.error}</p> : null}
            {state.success ? <p className="text-sm font-medium text-success">{state.success}</p> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
