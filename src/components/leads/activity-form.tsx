"use client";

// Activity logging for the lead detail page: one-click quick actions
// (Call / Email / WhatsApp / SMS) plus a full "Add Activity" form.

import * as React from "react";
import { useActionState } from "react";
import { Mail, MessageCircle, MessageSquare, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  addActivityAction,
  quickLogAction,
  type ActionState,
} from "@/server/modules/leads.actions";
import { humanize } from "@/lib/utils";

const QUICK_ACTIONS = [
  { type: "CALL", label: "Log Call", icon: Phone },
  { type: "EMAIL", label: "Log Email", icon: Mail },
  { type: "WHATSAPP", label: "Log WhatsApp", icon: MessageCircle },
  { type: "SMS", label: "Log SMS", icon: MessageSquare },
] as const;

const FORM_TYPES = ["NOTE", "CALL", "EMAIL", "SMS", "WHATSAPP", "MEETING", "TASK"] as const;

export function ActivityForm({ leadId }: { leadId: string }) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(addActivityAction, {});
  const [quickMessage, setQuickMessage] = React.useState<ActionState>({});
  const [isQuickPending, startTransition] = React.useTransition();
  const [type, setType] = React.useState<(typeof FORM_TYPES)[number]>("NOTE");

  React.useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  const runQuick = (quickType: "CALL" | "EMAIL" | "WHATSAPP" | "SMS") => {
    startTransition(async () => {
      setQuickMessage(await quickLogAction(leadId, quickType));
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick Actions</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map(({ type: t, label, icon: Icon }) => (
            <Button key={t} variant="outline" size="sm" disabled={isQuickPending} onClick={() => runQuick(t)}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </Button>
          ))}
        </div>
        {quickMessage.error ? <p className="mt-2 text-xs font-medium text-destructive">{quickMessage.error}</p> : null}
        {quickMessage.success ? <p className="mt-2 text-xs font-medium text-success">{quickMessage.success}</p> : null}
      </div>

      <form ref={formRef} action={formAction} className="space-y-3 border-t border-border pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add Activity</p>
        <input type="hidden" name="leadId" value={leadId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`act-type-${leadId}`}>Type</Label>
            <Select
              id={`act-type-${leadId}`}
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as (typeof FORM_TYPES)[number])}
            >
              {FORM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {humanize(t)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`act-subject-${leadId}`}>Subject *</Label>
            <Input id={`act-subject-${leadId}`} name="subject" placeholder="e.g. Discussed pricing" required />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`act-body-${leadId}`}>Notes</Label>
          <Textarea id={`act-body-${leadId}`} name="body" rows={2} placeholder="Details of the interaction…" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`act-outcome-${leadId}`}>Outcome</Label>
            <Input id={`act-outcome-${leadId}`} name="outcome" placeholder="e.g. Wants site visit" />
          </div>
          {type === "TASK" ? (
            <div className="space-y-1.5">
              <Label htmlFor={`act-due-${leadId}`}>Due</Label>
              <Input id={`act-due-${leadId}`} name="dueAt" type="datetime-local" />
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save Activity"}
          </Button>
          {state.error ? <p className="text-xs font-medium text-destructive">{state.error}</p> : null}
          {state.success ? <p className="text-xs font-medium text-success">{state.success}</p> : null}
        </div>
      </form>
    </div>
  );
}
