"use client";

// EstateCRM Marketing — new campaign form (channel + template + segment + schedule).

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { humanize } from "@/lib/utils";
import { createCampaignAction } from "@/server/modules/marketing.actions";
import { CAMPAIGN_CHANNELS } from "@/components/marketing/shared";
import type { CampaignChannel, Segment, Template } from "@/types/domain";

export function CampaignForm({
  templates,
  segments,
}: {
  templates: Template[];
  segments: Segment[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState("");
  const [channel, setChannel] = React.useState<CampaignChannel>("EMAIL");
  const [templateId, setTemplateId] = React.useState("");
  const [segmentId, setSegmentId] = React.useState("");
  const [scheduledAt, setScheduledAt] = React.useState("");

  const channelTemplates = templates.filter(
    (t) => channel === "MULTICHANNEL" || t.channel === channel,
  );

  function reset() {
    setName("");
    setChannel("EMAIL");
    setTemplateId("");
    setSegmentId("");
    setScheduledAt("");
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createCampaignAction({
        name,
        channel,
        templateId: templateId || undefined,
        segmentId: segmentId || undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      });
      if (result.ok) {
        reset();
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error ?? "Failed to create campaign");
      }
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> New Campaign
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>New Campaign</CardTitle>
        <Button variant="ghost" size="icon" onClick={() => { setOpen(false); reset(); }} aria-label="Close form">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="camp-name">Name</Label>
            <Input
              id="camp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Monsoon Pre-Launch Blast"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="camp-channel">Channel</Label>
            <Select
              id="camp-channel"
              value={channel}
              onChange={(e) => {
                setChannel(e.target.value as CampaignChannel);
                setTemplateId("");
              }}
            >
              {CAMPAIGN_CHANNELS.map((c) => (
                <option key={c} value={c}>{humanize(c)}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="camp-template">Template</Label>
            <Select id="camp-template" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">— none —</option>
              {channelTemplates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="camp-segment">Segment</Label>
            <Select id="camp-segment" value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
              <option value="">— all leads —</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="camp-schedule">Schedule (optional)</Label>
            <Input
              id="camp-schedule"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : scheduledAt ? "Create & Schedule" : "Create Draft"}
            </Button>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
