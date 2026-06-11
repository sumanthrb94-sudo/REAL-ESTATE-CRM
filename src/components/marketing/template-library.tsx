"use client";

// EstateCRM Marketing — template library grouped by channel, with body
// previews, merge-tag chips and inline create/edit/delete.

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Mail, MessageSquare, Pencil, Plus, Smartphone, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Section } from "@/components/ui/misc";
import { formatDate, humanize } from "@/lib/utils";
import { deleteTemplateAction } from "@/server/modules/marketing.actions";
import { TemplateEditor } from "@/components/marketing/template-editor";
import { extractMergeTags } from "@/components/marketing/shared";
import type { CampaignChannel, Template } from "@/types/domain";

const CHANNEL_GROUPS: { channel: CampaignChannel; icon: React.ReactNode }[] = [
  { channel: "EMAIL", icon: <Mail className="h-4 w-4" /> },
  { channel: "SMS", icon: <Smartphone className="h-4 w-4" /> },
  { channel: "WHATSAPP", icon: <MessageSquare className="h-4 w-4" /> },
];

export function TemplateLibrary({
  templates,
  canWrite,
}: {
  templates: Template[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [editor, setEditor] = React.useState<{ open: boolean; template?: Template }>({ open: false });
  const [pending, startTransition] = React.useTransition();
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  function remove(id: string) {
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteTemplateAction(id);
      if (!result.ok) setDeleteError(result.error ?? "Failed to delete template");
      else router.refresh();
    });
  }

  const groups = CHANNEL_GROUPS.map((g) => ({
    ...g,
    items: templates.filter((t) => t.channel === g.channel),
  }));
  const other = templates.filter((t) => !CHANNEL_GROUPS.some((g) => g.channel === t.channel));

  return (
    <div className="space-y-6">
      {canWrite && !editor.open ? (
        <div className="flex justify-end">
          <Button onClick={() => setEditor({ open: true })}>
            <Plus className="h-4 w-4" /> New Template
          </Button>
        </div>
      ) : null}

      {editor.open ? (
        <TemplateEditor
          key={editor.template?.id ?? "new"}
          template={editor.template}
          onClose={() => setEditor({ open: false })}
        />
      ) : null}

      {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}

      {templates.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="No templates yet"
          description="Create your first message template to power campaigns across email, SMS and WhatsApp."
          action={canWrite ? (
            <Button onClick={() => setEditor({ open: true })}>
              <Plus className="h-4 w-4" /> New Template
            </Button>
          ) : undefined}
        />
      ) : (
        [...groups, ...(other.length ? [{ channel: "MULTICHANNEL" as CampaignChannel, icon: <FileText className="h-4 w-4" />, items: other }] : [])].map((group) =>
          group.items.length === 0 ? null : (
            <Section
              key={group.channel}
              title={humanize(group.channel)}
              description={`${group.items.length} template${group.items.length === 1 ? "" : "s"}`}
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.items.map((t) => {
                  const tags = extractMergeTags(`${t.subject ?? ""} ${t.body}`);
                  return (
                    <Card key={t.id} className="flex flex-col">
                      <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{group.icon}</span>
                          <CardTitle className="text-base">{t.name}</CardTitle>
                        </div>
                        <Badge tone="muted">{formatDate(t.createdAt)}</Badge>
                      </CardHeader>
                      <CardContent className="flex flex-1 flex-col gap-3">
                        {t.subject ? (
                          <p className="text-sm font-medium">Subject: {t.subject}</p>
                        ) : null}
                        <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                          {t.body}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {tags.length > 0 ? (
                            tags.map((tag) => (
                              <Badge key={tag} tone="primary">{`{{${tag}}}`}</Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">No merge tags</span>
                          )}
                        </div>
                        {canWrite ? (
                          <div className="mt-auto flex items-center gap-2 pt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditor({ open: true, template: t })}
                            >
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={pending}
                              onClick={() => remove(t.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </Button>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </Section>
          ),
        )
      )}
    </div>
  );
}
