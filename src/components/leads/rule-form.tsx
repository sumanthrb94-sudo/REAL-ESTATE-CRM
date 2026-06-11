"use client";

// Collapsible "New Rule" form for the lead distribution manager. The condition
// inputs shown depend on the chosen strategy.

import * as React from "react";
import { useActionState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { createRuleAction } from "@/server/modules/distribution.actions";
import type { ActionState } from "@/server/modules/leads.actions";
import { LEAD_SOURCES, type DistributionStrategy } from "@/types/domain";
import { humanize } from "@/lib/utils";
import type { Option } from "@/components/leads/lead-form";

const STRATEGIES: DistributionStrategy[] = ["ROUND_ROBIN", "LOAD_BALANCED", "SOURCE_BASED", "PROJECT_BASED"];

export function RuleForm({ projects, agents }: { projects: Option[]; agents: Option[] }) {
  const [open, setOpen] = React.useState(false);
  const [strategy, setStrategy] = React.useState<DistributionStrategy>("ROUND_ROBIN");
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createRuleAction, {});

  React.useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  if (!open) {
    return (
      <div className="flex flex-col items-end gap-2">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New Rule
        </Button>
        {state.success ? <p className="text-xs font-medium text-success">{state.success}</p> : null}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>New Distribution Rule</CardTitle>
        <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close form">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="rule-name">Rule Name *</Label>
            <Input id="rule-name" name="name" placeholder="e.g. Facebook leads → West team" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rule-strategy">Strategy</Label>
            <Select
              id="rule-strategy"
              name="strategy"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as DistributionStrategy)}
            >
              {STRATEGIES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rule-priority">Priority (0–100)</Label>
            <Input id="rule-priority" name="priority" type="number" min={0} max={100} defaultValue={5} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rule-source">
              Lead Source {strategy === "SOURCE_BASED" ? "*" : "(optional filter)"}
            </Label>
            <Select id="rule-source" name="source" defaultValue="" required={strategy === "SOURCE_BASED"}>
              <option value="">Any source</option>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rule-project">
              Project {strategy === "PROJECT_BASED" ? "*" : "(optional filter)"}
            </Label>
            <Select id="rule-project" name="projectId" defaultValue="" required={strategy === "PROJECT_BASED"}>
              <option value="">Any project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rule-assignee">Fixed Assignee (optional)</Label>
            <Select id="rule-assignee" name="assigneeId" defaultValue="">
              <option value="">Resolve via strategy</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create Rule"}
            </Button>
            {state.error ? <p className="text-sm font-medium text-destructive">{state.error}</p> : null}
            {state.success ? <p className="text-sm font-medium text-success">{state.success}</p> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
