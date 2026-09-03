"use client";

// Three-step lead import for any channel: choose a file (.xlsx, .csv or .tsv),
// confirm how columns map onto lead fields, then commit. Nothing is written
// until the last step, and the preview runs the same validation and the same
// merge planner the import does, so what it shows is what you get.

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { CheckCircle2, FileUp, Loader2, TriangleAlert, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  commitImportAction,
  previewImportAction,
  remapAction,
  type CommitState,
  type PreviewState,
} from "@/server/modules/import.actions";
import { FIELD_LABELS, IMPORT_FIELDS, type ImportField } from "@/lib/import-fields";
import type { DuplicateStrategy } from "@/server/modules/import";
import { formatNumber } from "@/lib/utils";

type Mapping = Record<number, ImportField | "">;

export function ImportWizard() {
  const [state, formAction, uploading] = useActionState<PreviewState, FormData>(
    previewImportAction,
    {},
  );

  const [mapping, setMapping] = React.useState<Mapping | null>(null);
  const [strategy, setStrategy] = React.useState<DuplicateStrategy>("merge");
  const [preview, setPreview] = React.useState<PreviewState["preview"]>();
  const [remapping, setRemapping] = React.useState(false);
  const [commit, setCommit] = React.useState<CommitState>({});
  const [committing, setCommitting] = React.useState(false);

  // Adopt the server's suggested mapping the first time a preview arrives.
  React.useEffect(() => {
    if (state.preview) {
      setPreview(state.preview);
      setMapping(state.preview.mapping);
      setCommit({});
    }
  }, [state.preview]);

  const csvText = state.csvText;
  const fileName = state.meta?.fileName ?? "an upload";

  async function refresh(nextMapping: Mapping, nextStrategy: DuplicateStrategy) {
    if (!csvText) return;
    setRemapping(true);
    const result = await remapAction(csvText, nextMapping, nextStrategy, fileName);
    setRemapping(false);
    if (result.preview) setPreview(result.preview);
  }

  function onMapColumn(index: number, field: ImportField | "") {
    if (!mapping) return;
    const next: Mapping = { ...mapping };
    // A lead field can only come from one column — clear any previous claim.
    if (field) {
      for (const key of Object.keys(next)) {
        if (next[Number(key)] === field) next[Number(key)] = "";
      }
    }
    next[index] = field;
    setMapping(next);
    void refresh(next, strategy);
  }

  function onStrategy(value: DuplicateStrategy) {
    setStrategy(value);
    if (mapping) void refresh(mapping, value);
  }

  async function onCommit() {
    if (!csvText || !mapping) return;
    setCommitting(true);
    const result = await commitImportAction(csvText, mapping, strategy, fileName);
    setCommitting(false);
    setCommit(result);
  }

  // ── Done ──
  if (commit.result) {
    const { created, merged, errors } = commit.result;
    return (
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-success" />
            <div>
              <p className="text-lg font-semibold">
                {formatNumber(created)} lead{created === 1 ? "" : "s"} added
                {merged > 0 ? `, ${formatNumber(merged)} combined` : ""}
              </p>
              <p className="text-sm text-muted-foreground">
                New leads were routed through your distribution rules.
                {merged > 0
                  ? " Each combined lead kept its owner and history, and carries a note naming this file."
                  : ""}
              </p>
            </div>
          </div>

          {errors.length > 0 ? <IssueList title="Rows that were skipped" issues={errors} /> : null}

          <div className="flex gap-2 pt-2">
            <Link
              href="/leads"
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              View leads
            </Link>
            <Button
              variant="outline"
              onClick={() => {
                setCommit({});
                setPreview(undefined);
                setMapping(null);
              }}
            >
              Import another file
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Step 2: map and confirm ──
  if (preview && mapping) {
    // A file can be entirely repeat enquiries: that is a valid import too.
    const blocked = preview.valid === 0 && !(strategy === "merge" && preview.merges.length > 0);
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Check the column mapping</CardTitle>
            <CardDescription>
              {preview.channel
                ? `This looks like a ${preview.channel} export, so the columns below were matched automatically. `
                : "We guessed these from your header row. "}
              Change anything that looks wrong — Name and Phone are required, the rest are optional.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>Column in your file</TH>
                  <TH>Sample values</TH>
                  <TH className="w-56">Import as</TH>
                </TR>
              </THead>
              <TBody>
                {preview.headers.map((header, i) => (
                  <TR key={`${header}-${i}`}>
                    <TD className="font-medium">{header || <em className="text-muted-foreground">(no header)</em>}</TD>
                    <TD className="max-w-64 truncate text-xs text-muted-foreground">
                      {preview.sample
                        .map((r) => r[i])
                        .filter((v) => v && v.trim())
                        .slice(0, 3)
                        .join(" · ") || "—"}
                    </TD>
                    <TD>
                      <Select
                        aria-label={`Import column ${header || i + 1} as`}
                        value={mapping[i] ?? ""}
                        onChange={(e) => onMapColumn(i, e.target.value as ImportField | "")}
                      >
                        <option value="">— Ignore —</option>
                        {IMPORT_FIELDS.map((f) => (
                          <option key={f} value={f}>
                            {FIELD_LABELS[f]}
                          </option>
                        ))}
                      </Select>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What will happen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label="Rows in file" value={formatNumber(preview.totalRows)} />
              <Stat label="Will import" value={formatNumber(preview.valid)} tone="success" />
              <Stat
                label={strategy === "merge" ? "Will combine" : "Duplicates"}
                value={formatNumber(
                  strategy === "merge"
                    ? preview.merges.length
                    : preview.duplicatesInFile + preview.duplicatesInDb,
                )}
                tone={preview.duplicatesInFile + preview.duplicatesInDb > 0 ? "warning" : undefined}
              />
              <Stat
                label="Rows with errors"
                value={formatNumber(preview.errors.length)}
                tone={preview.errors.length > 0 ? "destructive" : undefined}
              />
            </div>

            <fieldset className="space-y-2 border-t border-border pt-4">
              <legend className="text-sm font-medium">
                When someone in this file is already in your CRM
              </legend>
              {(
                [
                  ["merge", "Combine them", "Keep the existing lead, its owner and its history. Fill in anything blank, add the new tags, append the new requirement, widen the budget, and note the repeat enquiry on the timeline."],
                  ["skip", "Leave them alone", "Import only the people who are new. Nothing on an existing lead changes."],
                  ["create", "Add anyway", "Create a second lead. Use this only when you know the file holds genuinely different people who share a number."],
                ] as const
              ).map(([value, label, help]) => (
                <label key={value} className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="duplicate-strategy"
                    value={value}
                    checked={strategy === value}
                    onChange={() => onStrategy(value)}
                    className="mt-1 h-4 w-4 border-input"
                  />
                  <span>
                    <span className="font-medium">{label}</span>
                    <span className="block text-xs text-muted-foreground">{help}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {strategy === "merge" && preview.merges.length > 0 ? (
              <div className="rounded-md border border-border">
                <p className="border-b border-border px-3 py-2 text-sm font-medium">
                  {formatNumber(preview.merges.length)} lead
                  {preview.merges.length === 1 ? "" : "s"} will be combined
                </p>
                <ul className="max-h-64 divide-y divide-border overflow-y-auto text-sm">
                  {preview.merges.slice(0, 50).map((m) => (
                    <li key={`${m.leadId}-${m.rowNumber}`} className="px-3 py-2">
                      <p className="font-medium">
                        {m.existingName}
                        {m.incomingName.trim() && m.incomingName.trim() !== m.existingName ? (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            ← “{m.incomingName}” in row {m.rowNumber}
                          </span>
                        ) : (
                          <span className="font-normal text-muted-foreground"> · row {m.rowNumber}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        matched on {m.matchedOn} · {m.changes.length ? m.changes.join(", ") : "no new details"}
                      </p>
                    </li>
                  ))}
                </ul>
                {preview.merges.length > 50 ? (
                  <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                    and {formatNumber(preview.merges.length - 50)} more
                  </p>
                ) : null}
              </div>
            ) : null}

            {preview.errors.length > 0 ? (
              <IssueList title="Rows that will be skipped" issues={preview.errors} />
            ) : null}

            {commit.error ? (
              <p role="alert" className="text-sm font-medium text-destructive">
                {commit.error}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <Button onClick={onCommit} disabled={blocked || committing || remapping}>
                {committing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Importing…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" /> Import {formatNumber(preview.valid)} lead
                    {preview.valid === 1 ? "" : "s"}
                    {strategy === "merge" && preview.merges.length > 0
                      ? `, combine ${formatNumber(preview.merges.length)}`
                      : ""}
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setPreview(undefined);
                  setMapping(null);
                }}
              >
                Start over
              </Button>
              {remapping ? (
                <span className="text-xs text-muted-foreground">Rechecking…</span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Step 1: choose a file ──
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload leads from any channel</CardTitle>
        <CardDescription>
          Meta lead ads, WhatsApp, your website, a portal export or a walk-in register kept in
          Excel — upload the file as it comes. Columns are matched by their header text, and anyone
          already in your CRM is combined rather than duplicated. Nothing is saved until you confirm
          on the next step.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="file">Excel or CSV file</Label>
            <Input
              id="file"
              name="file"
              type="file"
              accept=".xlsx,.csv,.tsv,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
            />
            <p className="text-xs text-muted-foreground">
              .xlsx, .csv or .tsv, up to 5 MB and 5,000 rows. Commas, semicolons and tabs are
              detected automatically, and an Excel file is read from its first sheet.
            </p>
          </div>

          <p className="text-sm">
            Not sure of the format?{" "}
            <a href="/api/leads/template" className="font-medium text-primary hover:underline" download>
              Download the unified template
            </a>{" "}
            — one sheet that works for every channel.
          </p>

          {state.error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" disabled={uploading}>
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Reading…
              </>
            ) : (
              <>
                <FileUp className="h-4 w-4" /> Continue
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 rounded-md border border-border bg-muted/40 p-4">
          <p className="text-sm font-medium">Expected columns</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Only <strong>Name</strong> and <strong>Phone</strong> are required. We also recognise
            headers like email, source, stage, temperature, budget, project, requirement, tags and
            created date — and you can remap anything on the next step.
          </p>
          <pre className="mt-3 overflow-x-auto rounded bg-card p-3 text-xs">
{`name,phone,email,source,budget,project,requirement
Asha Kulkarni,+91 98200 11223,asha@example.com,Instagram,1.2 Cr,Agartha,3BHK with a balcony
Ravi Menon,9820044556,,Instagram,85 L,SYL,2BHK`}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning" | "destructive";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "destructive"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function IssueList({ title, issues }: { title: string; issues: Array<{ row: number; message: string }> }) {
  const shown = issues.slice(0, 20);
  return (
    <div className="rounded-md border border-warning/40 bg-warning/5 p-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <TriangleAlert className="h-4 w-4 text-warning" />
        {title} ({issues.length})
      </p>
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
        {shown.map((issue, i) => (
          <li key={`${issue.row}-${i}`}>
            <span className="font-medium text-foreground">Row {issue.row}:</span> {issue.message}
          </li>
        ))}
      </ul>
      {issues.length > shown.length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          …and {issues.length - shown.length} more.
        </p>
      ) : null}
    </div>
  );
}
