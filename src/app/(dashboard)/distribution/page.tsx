// EstateCRM — /distribution. Lead distribution rules manager: strategy
// explainers, the prioritised rule list with active toggles, and rule creation.

import { Shuffle } from "lucide-react";
import { Badge, statusTone } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { RuleForm } from "@/components/leads/rule-form";
import { RuleToggle } from "@/components/leads/rule-toggle";
import { can } from "@/server/auth/rbac";
import { requirePermission } from "@/server/auth/guard";
import {
  DISTRIBUTION_STRATEGIES,
  listRules,
  STRATEGY_DESCRIPTIONS,
} from "@/server/modules/distribution";
import { getLeadFormOptions } from "@/server/modules/leads";
import { formatDate, humanize } from "@/lib/utils";

export default async function DistributionPage() {
  const [user, rules, options] = await Promise.all([
    requirePermission("lead.assign"),
    listRules(),
    getLeadFormOptions(),
  ]);
  const canManage = can(user.role, "lead.assign");
  const activeCount = rules.filter((r) => r.active).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Distribution"
        description={`Automatic lead routing — ${activeCount} of ${rules.length} rules active. New leads without an owner are matched against active rules in priority order.`}
        actions={canManage ? undefined : <Badge tone="muted">Read-only access</Badge>}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {DISTRIBUTION_STRATEGIES.map((strategy) => (
          <Card key={strategy}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{humanize(strategy)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{STRATEGY_DESCRIPTIONS[strategy]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {canManage ? (
        <RuleForm
          projects={options.projects.map((p) => ({ id: p.id, name: p.name }))}
          agents={options.owners.map((o) => ({ id: o.id, name: o.name }))}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Rules (highest priority wins)</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {rules.length === 0 ? (
            <EmptyState
              title="No distribution rules"
              description="Create a rule so new leads are routed automatically instead of sitting unassigned."
              icon={<Shuffle className="h-8 w-8" />}
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Rule</TH>
                  <TH>Strategy</TH>
                  <TH>Priority</TH>
                  <TH>Conditions</TH>
                  <TH>Fixed Assignee</TH>
                  <TH>Created</TH>
                  <TH>Active</TH>
                </TR>
              </THead>
              <TBody>
                {rules.map((rule) => (
                  <TR key={rule.id} className={rule.active ? undefined : "opacity-60"}>
                    <TD className="font-medium">{rule.name}</TD>
                    <TD>
                      <Badge tone={statusTone(rule.active ? "QUALIFIED" : "PENDING")}>
                        {humanize(rule.strategy)}
                      </Badge>
                    </TD>
                    <TD className="font-medium">{rule.priority}</TD>
                    <TD className="text-xs text-muted-foreground">
                      {rule.source || rule.project ? (
                        <span className="space-x-1">
                          {rule.source ? <Badge tone="muted">Source: {humanize(rule.source)}</Badge> : null}
                          {rule.project ? <Badge tone="muted">Project: {rule.project.name}</Badge> : null}
                        </span>
                      ) : (
                        "Any lead (catch-all)"
                      )}
                    </TD>
                    <TD className="text-muted-foreground">
                      {rule.assignee?.name ?? <span className="text-xs italic">Via strategy</span>}
                    </TD>
                    <TD className="whitespace-nowrap text-muted-foreground">{formatDate(rule.createdAt)}</TD>
                    <TD>
                      {canManage ? (
                        <RuleToggle ruleId={rule.id} active={rule.active} />
                      ) : (
                        <Badge tone={rule.active ? "success" : "muted"}>{rule.active ? "Active" : "Paused"}</Badge>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
