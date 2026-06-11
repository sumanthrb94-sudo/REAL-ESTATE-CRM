// EstateCRM — /marketing/segments: audience segments.
// Each segment is evaluated live against the lead base to show its current
// matching count and sample leads; the builder creates/edits filter rules.

import { Filter, Users } from "lucide-react";
import { PageHeader, StatCard } from "@/components/ui/misc";
import { SegmentsView, type SegmentWithAudience } from "@/components/marketing/segments-view";
import { can } from "@/server/auth/rbac";
import { getCurrentUser } from "@/server/auth/session";
import { evaluateSegment, listSegments } from "@/server/modules/marketing";
import { formatNumber } from "@/lib/utils";

export default async function SegmentsPage() {
  const [user, segments] = await Promise.all([getCurrentUser(), listSegments()]);
  const canWrite = can(user.role, "marketing.write");

  const evaluated: SegmentWithAudience[] = await Promise.all(
    segments.map(async (segment) => {
      const { leads, count } = await evaluateSegment(segment);
      return {
        segment,
        count,
        sample: leads.slice(0, 4).map((l) => ({
          id: l.id,
          name: l.name,
          status: l.status,
          temperature: l.temperature,
          score: l.score,
        })),
      };
    }),
  );

  const totalAudience = evaluated.reduce((sum, e) => sum + e.count, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audience Segments"
        description="Rule-based lead audiences that power campaign targeting. Counts are evaluated live against the lead base."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Segments" value={segments.length.toString()} icon={<Filter className="h-5 w-5" />} />
        <StatCard
          label="Total Matched Leads"
          value={formatNumber(totalAudience)}
          delta={{ value: "across all segments", positive: true }}
          icon={<Users className="h-5 w-5" />}
        />
      </div>

      <SegmentsView segments={evaluated} canWrite={canWrite} />
    </div>
  );
}
