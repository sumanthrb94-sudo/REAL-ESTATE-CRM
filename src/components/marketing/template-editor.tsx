"use client";

// EstateCRM Marketing — template create/edit form with live merge-tag preview.

import * as React from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { humanize } from "@/lib/utils";
import {
  createTemplateAction,
  updateTemplateAction,
} from "@/server/modules/marketing.actions";
import {
  MERGE_TAGS,
  SAMPLE_MERGE_VARS,
  TEMPLATE_CHANNELS,
  renderPreview,
} from "@/components/marketing/shared";
import type { CampaignChannel, Template } from "@/types/domain";

export function TemplateEditor({
  template,
  onClose,
}: {
  /** Existing template to edit; omit to create a new one. */
  template?: Template;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState(template?.name ?? "");
  const [channel, setChannel] = React.useState<CampaignChannel>(template?.channel ?? "EMAIL");
  const [subject, setSubject] = React.useState(template?.subject ?? "");
  const [body, setBody] = React.useState(template?.body ?? "");

  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  function insertTag(tag: string) {
    const token = `{{${tag}}}`;
    const el = bodyRef.current;
    if (el) {
      const start = el.selectionStart ?? body.length;
      const end = el.selectionEnd ?? body.length;
      setBody(body.slice(0, start) + token + body.slice(end));
    } else {
      setBody(body + token);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const input = {
      name,
      channel,
      subject: channel === "EMAIL" && subject ? subject : undefined,
      body,
    };
    startTransition(async () => {
      const result = template
        ? await updateTemplateAction(template.id, input)
        : await createTemplateAction(input);
      if (result.ok) {
        onClose();
        router.refresh();
      } else {
        setError(result.error ?? "Failed to save template");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{template ? `Edit: ${template.name}` : "New Template"}</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close editor">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tmpl-name">Name</Label>
                <Input
                  id="tmpl-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Possession Update"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tmpl-channel">Channel</Label>
                <Select
                  id="tmpl-channel"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as CampaignChannel)}
                >
                  {TEMPLATE_CHANNELS.map((c) => (
                    <option key={c} value={c}>{humanize(c)}</option>
                  ))}
                </Select>
              </div>
            </div>
            {channel === "EMAIL" ? (
              <div className="space-y-1.5">
                <Label htmlFor="tmpl-subject">Subject</Label>
                <Input
                  id="tmpl-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Your site visit at {{project}}"
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="tmpl-body">Body</Label>
              <Textarea
                id="tmpl-body"
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                placeholder="Hi {{name}}, …"
                required
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-xs text-muted-foreground">Insert tag:</span>
                {MERGE_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => insertTag(tag)}
                    className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground transition-colors hover:bg-accent/70"
                  >
                    {`{{${tag}}}`}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : template ? "Save Changes" : "Create Template"}
              </Button>
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Live preview <span className="font-normal text-muted-foreground">(sample lead data)</span></Label>
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Badge tone="primary">{humanize(channel)}</Badge>
                <span className="text-xs text-muted-foreground">to {SAMPLE_MERGE_VARS.name}</span>
              </div>
              {channel === "EMAIL" && subject ? (
                <p className="mb-2 text-sm font-semibold">{renderPreview(subject)}</p>
              ) : null}
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {body ? renderPreview(body) : <span className="text-muted-foreground">Start typing the body to preview…</span>}
              </p>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
