// EstateCRM — marketing automation service.
// Campaigns (lifecycle + funnel analytics), templates (merge-tag rendering) and
// audience segments (filter evaluation against the lead base). All reads/writes
// go through the db singleton; inputs are validated with zod.

import { z } from "zod";
import { db } from "@/server/db";
import {
  FILTERABLE_LEAD_FIELDS,
  STATUS_TRANSITIONS,
  renderPreview,
  type MergeVars,
} from "@/components/marketing/shared";
import type {
  Campaign,
  CampaignChannel,
  CampaignStatus,
  Lead,
  Segment,
  SegmentFilter,
  Template,
} from "@/types/domain";

export { renderPreview };
export type { MergeVars };

// ─── Validation schemas ─────────────────────────────────────────────────────
const channelSchema = z.enum(["EMAIL", "SMS", "WHATSAPP", "MULTICHANNEL"]);
const statusSchema = z.enum(["DRAFT", "SCHEDULED", "RUNNING", "COMPLETED", "PAUSED"]);

export const campaignCreateSchema = z.object({
  name: z.string().trim().min(2, "Campaign name must be at least 2 characters"),
  channel: channelSchema,
  templateId: z.string().trim().min(1).optional(),
  segmentId: z.string().trim().min(1).optional(),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
});
export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;

export const campaignUpdateSchema = campaignCreateSchema.partial();
export type CampaignUpdateInput = z.infer<typeof campaignUpdateSchema>;

export const templateCreateSchema = z.object({
  name: z.string().trim().min(2, "Template name must be at least 2 characters"),
  channel: channelSchema,
  subject: z.string().trim().max(200).optional(),
  body: z.string().trim().min(5, "Template body must be at least 5 characters"),
});
export type TemplateCreateInput = z.infer<typeof templateCreateSchema>;

export const templateUpdateSchema = templateCreateSchema.partial();
export type TemplateUpdateInput = z.infer<typeof templateUpdateSchema>;

const filterValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number()])),
]);

export const segmentFilterSchema = z.object({
  field: z.enum(FILTERABLE_LEAD_FIELDS),
  op: z.enum(["eq", "in", "gte", "lte", "contains"]),
  value: filterValueSchema,
});

export const segmentCreateSchema = z.object({
  name: z.string().trim().min(2, "Segment name must be at least 2 characters"),
  description: z.string().trim().max(300).optional(),
  filters: z.array(segmentFilterSchema).min(1, "Add at least one filter"),
});
export type SegmentCreateInput = z.infer<typeof segmentCreateSchema>;

export const segmentUpdateSchema = segmentCreateSchema.partial();
export type SegmentUpdateInput = z.infer<typeof segmentUpdateSchema>;

// ─── Campaigns ──────────────────────────────────────────────────────────────
export interface CampaignFilter {
  status?: CampaignStatus;
  channel?: CampaignChannel;
}

export async function listCampaigns(filter: CampaignFilter = {}): Promise<Campaign[]> {
  const where: Partial<Record<keyof Campaign, unknown>> = {};
  if (filter.status) where.status = filter.status;
  if (filter.channel) where.channel = filter.channel;
  return db.campaigns.list({
    where: Object.keys(where).length ? where : undefined,
    orderBy: { field: "createdAt", dir: "desc" },
  });
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  return db.campaigns.find(id);
}

export async function createCampaign(input: CampaignCreateInput): Promise<Campaign> {
  const data = campaignCreateSchema.parse(input);
  return db.campaigns.create({
    name: data.name,
    channel: data.channel,
    status: data.scheduledAt ? "SCHEDULED" : "DRAFT",
    templateId: data.templateId,
    segmentId: data.segmentId,
    scheduledAt: data.scheduledAt,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    converted: 0,
    createdAt: new Date().toISOString(),
  });
}

export async function updateCampaign(id: string, input: CampaignUpdateInput): Promise<Campaign | null> {
  const patch = campaignUpdateSchema.parse(input);
  return db.campaigns.update(id, patch);
}

/** Enforced lifecycle: DRAFT→SCHEDULED→RUNNING→COMPLETED/PAUSED (pause↔resume). */
export async function setCampaignStatus(id: string, status: CampaignStatus): Promise<Campaign> {
  const next = statusSchema.parse(status);
  const campaign = await db.campaigns.find(id);
  if (!campaign) throw new Error("Campaign not found");
  const allowed = STATUS_TRANSITIONS[campaign.status];
  if (!allowed.includes(next)) {
    throw new Error(`Cannot move campaign from ${campaign.status} to ${next}`);
  }
  const patch: Partial<Campaign> = { status: next };
  if (next === "SCHEDULED" && !campaign.scheduledAt) {
    patch.scheduledAt = new Date().toISOString();
  }
  const updated = await db.campaigns.update(id, patch);
  if (!updated) throw new Error("Campaign not found");
  return updated;
}

// ─── Funnel analytics ───────────────────────────────────────────────────────
export interface FunnelStage {
  stage: "Sent" | "Delivered" | "Opened" | "Clicked" | "Converted";
  count: number;
  /** % of the previous stage (0–100). */
  rateOfPrevious: number;
  /** % of total sent (0–100). */
  rateOfSent: number;
}

export interface CampaignFunnel {
  campaign: Campaign;
  stages: FunnelStage[];
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
}

const rate = (part: number, whole: number): number =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;

export function buildFunnel(campaign: Campaign): CampaignFunnel {
  const { sent, delivered, opened, clicked, converted } = campaign;
  const counts: [FunnelStage["stage"], number][] = [
    ["Sent", sent],
    ["Delivered", delivered],
    ["Opened", opened],
    ["Clicked", clicked],
    ["Converted", converted],
  ];
  const stages: FunnelStage[] = counts.map(([stage, count], i) => {
    const prev = i === 0 ? sent : counts[i - 1]?.[1] ?? 0;
    return {
      stage,
      count,
      rateOfPrevious: i === 0 ? 100 : rate(count, prev),
      rateOfSent: i === 0 ? (sent > 0 ? 100 : 0) : rate(count, sent),
    };
  });
  return {
    campaign,
    stages,
    deliveryRate: rate(delivered, sent),
    openRate: rate(opened, delivered),
    clickRate: rate(clicked, opened),
    conversionRate: rate(converted, sent),
  };
}

export async function getCampaignFunnel(id: string): Promise<CampaignFunnel | null> {
  const campaign = await db.campaigns.find(id);
  return campaign ? buildFunnel(campaign) : null;
}

export interface MarketingStats {
  totalCampaigns: number;
  activeCampaigns: number;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalConverted: number;
  /** opened / delivered, % 0–100 */
  openRate: number;
  /** clicked / opened, % 0–100 */
  clickRate: number;
  /** converted / sent, % 0–100 */
  conversionRate: number;
}

export async function getMarketingStats(): Promise<MarketingStats> {
  const campaigns = await db.campaigns.list();
  const sum = (fn: (c: Campaign) => number) => campaigns.reduce((acc, c) => acc + fn(c), 0);
  const totalSent = sum((c) => c.sent);
  const totalDelivered = sum((c) => c.delivered);
  const totalOpened = sum((c) => c.opened);
  const totalClicked = sum((c) => c.clicked);
  const totalConverted = sum((c) => c.converted);
  return {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter((c) => c.status === "RUNNING" || c.status === "SCHEDULED").length,
    totalSent,
    totalDelivered,
    totalOpened,
    totalClicked,
    totalConverted,
    openRate: rate(totalOpened, totalDelivered),
    clickRate: rate(totalClicked, totalOpened),
    conversionRate: rate(totalConverted, totalSent),
  };
}

// ─── Templates ──────────────────────────────────────────────────────────────
export async function listTemplates(channel?: CampaignChannel): Promise<Template[]> {
  return db.templates.list({
    where: channel ? { channel } : undefined,
    orderBy: { field: "createdAt", dir: "desc" },
  });
}

export async function createTemplate(input: TemplateCreateInput): Promise<Template> {
  const data = templateCreateSchema.parse(input);
  return db.templates.create({
    name: data.name,
    channel: data.channel,
    subject: data.channel === "EMAIL" ? data.subject : undefined,
    body: data.body,
    createdAt: new Date().toISOString(),
  });
}

export async function updateTemplate(id: string, input: TemplateUpdateInput): Promise<Template | null> {
  const patch = templateUpdateSchema.parse(input);
  if (patch.channel && patch.channel !== "EMAIL") {
    patch.subject = undefined;
  }
  return db.templates.update(id, patch);
}

export async function deleteTemplate(id: string): Promise<boolean> {
  return db.templates.delete(id);
}

// ─── Segments ───────────────────────────────────────────────────────────────
export async function listSegments(): Promise<Segment[]> {
  return db.segments.list({ orderBy: { field: "createdAt", dir: "desc" } });
}

export async function createSegment(input: SegmentCreateInput): Promise<Segment> {
  const data = segmentCreateSchema.parse(input);
  return db.segments.create({
    name: data.name,
    description: data.description,
    filters: data.filters as SegmentFilter[],
    createdAt: new Date().toISOString(),
  });
}

export async function updateSegment(id: string, input: SegmentUpdateInput): Promise<Segment | null> {
  const data = segmentUpdateSchema.parse(input);
  const patch: Partial<Segment> = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.description !== undefined) patch.description = data.description;
  if (data.filters !== undefined) patch.filters = data.filters as SegmentFilter[];
  return db.segments.update(id, patch);
}

export async function deleteSegment(id: string): Promise<boolean> {
  return db.segments.delete(id);
}

/** Apply a single segment filter to a lead. */
function matchesFilter(lead: Lead, filter: SegmentFilter): boolean {
  const raw = lead[filter.field];
  switch (filter.op) {
    case "eq":
      return raw === filter.value;
    case "in": {
      if (!Array.isArray(filter.value)) return false;
      return (filter.value as unknown[]).includes(raw);
    }
    case "gte": {
      const n = typeof raw === "number" ? raw : Number(raw);
      const v = Number(filter.value);
      return !Number.isNaN(n) && !Number.isNaN(v) && n >= v;
    }
    case "lte": {
      const n = typeof raw === "number" ? raw : Number(raw);
      const v = Number(filter.value);
      return !Number.isNaN(n) && !Number.isNaN(v) && n <= v;
    }
    case "contains": {
      const needle = String(filter.value).toLowerCase();
      if (Array.isArray(raw)) {
        return raw.some((item) => String(item).toLowerCase().includes(needle));
      }
      if (raw == null) return false;
      return String(raw).toLowerCase().includes(needle);
    }
    default:
      return false;
  }
}

export interface SegmentEvaluation {
  leads: Lead[];
  count: number;
}

/**
 * The core automation primitive: run a segment's filters (AND semantics)
 * against the entire lead base and return the matching audience.
 */
export async function evaluateSegment(
  segment: Pick<Segment, "filters">,
): Promise<SegmentEvaluation> {
  const leads = await db.leads.list();
  const matched = leads.filter((lead) => segment.filters.every((f) => matchesFilter(lead, f)));
  return { leads: matched, count: matched.length };
}
