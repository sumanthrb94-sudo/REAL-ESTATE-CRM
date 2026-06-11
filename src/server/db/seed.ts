// EstateCRM — deterministic demo seed.
// Produces a realistic dataset so the entire CRM is explorable with zero DB setup.

import type {
  Activity,
  AssignmentRule,
  Booking,
  Campaign,
  ChannelPartner,
  Lead,
  LeadSource,
  LeadStatus,
  LeadTemperature,
  Payment,
  Project,
  Segment,
  SiteVisit,
  Team,
  Template,
  Tower,
  Unit,
  User,
} from "@/types/domain";
import type { SeedData } from "./memory-store";

const now = new Date("2026-06-11T09:00:00.000Z").getTime();
const day = 86_400_000;
const iso = (offsetDays: number) => new Date(now + offsetDays * day).toISOString();

// Tiny seeded PRNG for deterministic output.
let s = 1337;
const rand = () => {
  s = (s * 1664525 + 1013904223) % 4294967296;
  return s / 4294967296;
};
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

// ─── Users & teams ──────────────────────────────────────────────────────────
const teams: Team[] = [
  { id: "team_west", name: "West Zone Sales", region: "Mumbai", managerId: "usr_mgr1", createdAt: iso(-120) },
  { id: "team_south", name: "South Zone Sales", region: "Bangalore", managerId: "usr_mgr2", createdAt: iso(-120) },
];

const users: User[] = [
  { id: "usr_admin", name: "Aarav Mehta", email: "admin@estatecrm.io", role: "ADMIN", phone: "+91 98200 10001", active: true, createdAt: iso(-200), updatedAt: iso(-2) },
  { id: "usr_head", name: "Diya Sharma", email: "head@estatecrm.io", role: "SALES_HEAD", phone: "+91 98200 10002", active: true, createdAt: iso(-190), updatedAt: iso(-2) },
  { id: "usr_mgr1", name: "Rohan Kapoor", email: "rohan@estatecrm.io", role: "SALES_MANAGER", phone: "+91 98200 10003", teamId: "team_west", active: true, createdAt: iso(-180), updatedAt: iso(-2) },
  { id: "usr_mgr2", name: "Neha Iyer", email: "neha@estatecrm.io", role: "SALES_MANAGER", phone: "+91 98200 10004", teamId: "team_south", active: true, createdAt: iso(-180), updatedAt: iso(-2) },
  { id: "usr_a1", name: "Karan Singh", email: "karan@estatecrm.io", role: "SALES_AGENT", phone: "+91 98200 10005", teamId: "team_west", active: true, createdAt: iso(-150), updatedAt: iso(-1) },
  { id: "usr_a2", name: "Priya Nair", email: "priya@estatecrm.io", role: "SALES_AGENT", phone: "+91 98200 10006", teamId: "team_west", active: true, createdAt: iso(-150), updatedAt: iso(-1) },
  { id: "usr_a3", name: "Vikram Rao", email: "vikram@estatecrm.io", role: "SALES_AGENT", phone: "+91 98200 10007", teamId: "team_south", active: true, createdAt: iso(-150), updatedAt: iso(-1) },
  { id: "usr_a4", name: "Ananya Gupta", email: "ananya@estatecrm.io", role: "SALES_AGENT", phone: "+91 98200 10008", teamId: "team_south", active: true, createdAt: iso(-150), updatedAt: iso(-1) },
  { id: "usr_mkt", name: "Ishaan Verma", email: "marketing@estatecrm.io", role: "MARKETING", phone: "+91 98200 10009", active: true, createdAt: iso(-150), updatedAt: iso(-1) },
];
const agentIds = ["usr_a1", "usr_a2", "usr_a3", "usr_a4"];

// ─── Projects, towers, units ──────────────────────────────────────────────────
const projectSeeds = [
  { id: "proj_skyline", name: "Skyline Heights", developer: "Prestige Group", city: "Mumbai", locality: "Powai", status: "ONGOING" as const, amenities: ["Clubhouse", "Pool", "Gym", "Kids Play Area"] },
  { id: "proj_riviera", name: "Emerald Riviera", developer: "Lodha", city: "Mumbai", locality: "Thane", status: "READY_TO_MOVE" as const, amenities: ["Sky Lounge", "Pool", "Spa", "Co-working"] },
  { id: "proj_grove", name: "Orchard Grove", developer: "Brigade", city: "Bangalore", locality: "Whitefield", status: "ONGOING" as const, amenities: ["Gym", "Tennis Court", "Amphitheatre"] },
  { id: "proj_central", name: "Central Park Residences", developer: "Sobha", city: "Bangalore", locality: "Hebbal", status: "UPCOMING" as const, amenities: ["Clubhouse", "Pool", "Jogging Track"] },
];

const projects: Project[] = projectSeeds.map((p, i) => ({
  ...p,
  description: `${p.name} by ${p.developer} — a premium residential development in ${p.locality}, ${p.city}.`,
  reraId: `RERA/${p.city.slice(0, 3).toUpperCase()}/2025/${1000 + i}`,
  createdAt: iso(-160 + i * 5),
  updatedAt: iso(-3),
}));

const towers: Tower[] = [];
const units: Unit[] = [];
const unitTypes = ["1BHK", "2BHK", "3BHK", "4BHK"];
const facings = ["North", "East", "West", "North-East", "South-East"];
for (const p of projects) {
  const towerCount = 2;
  for (let t = 0; t < towerCount; t++) {
    const towerId = `${p.id}_t${t + 1}`;
    const floors = int(12, 24);
    towers.push({ id: towerId, projectId: p.id, name: `Tower ${String.fromCharCode(65 + t)}`, floors });
    for (let f = 1; f <= floors; f++) {
      for (let u = 1; u <= 4; u++) {
        const type = pick(unitTypes);
        const carpet = type === "1BHK" ? int(450, 600) : type === "2BHK" ? int(650, 950) : type === "3BHK" ? int(1100, 1500) : int(1800, 2400);
        const statusRoll = rand();
        const status = statusRoll > 0.82 ? "SOLD" : statusRoll > 0.72 ? "BOOKED" : statusRoll > 0.66 ? "BLOCKED" : "AVAILABLE";
        units.push({
          id: `${towerId}_f${f}_u${u}`,
          projectId: p.id,
          towerId,
          unitNumber: `${String.fromCharCode(65 + t)}-${f}0${u}`,
          floor: f,
          type,
          carpetArea: carpet,
          builtUpArea: Math.round(carpet * 1.3),
          facing: pick(facings),
          basePrice: carpet * int(9000, 16000),
          status,
          createdAt: iso(-150),
        });
      }
    }
  }
}

// ─── Channel partners ─────────────────────────────────────────────────────────
const channelPartners: ChannelPartner[] = [
  { id: "cp_1", name: "Suresh Patil", company: "Patil Realty", email: "suresh@patilrealty.in", phone: "+91 99000 22001", reraId: "RERA/MH/AG/501", city: "Mumbai", status: "ACTIVE", commissionPct: 2.0, createdAt: iso(-100) },
  { id: "cp_2", name: "Meena Joshi", company: "Dream Homes Consultancy", email: "meena@dreamhomes.in", phone: "+91 99000 22002", reraId: "RERA/MH/AG/502", city: "Mumbai", status: "ACTIVE", commissionPct: 2.5, createdAt: iso(-90) },
  { id: "cp_3", name: "Arjun Reddy", company: "Reddy Associates", email: "arjun@reddyassoc.in", phone: "+91 99000 22003", reraId: "RERA/KA/AG/503", city: "Bangalore", status: "PENDING", commissionPct: 2.0, createdAt: iso(-20) },
  { id: "cp_4", name: "Fatima Khan", company: "Skyline Brokers", phone: "+91 99000 22004", city: "Bangalore", status: "SUSPENDED", commissionPct: 1.5, createdAt: iso(-140) },
];

// ─── Marketing: templates, segments, campaigns ────────────────────────────────
const templates: Template[] = [
  { id: "tmpl_welcome", name: "Welcome Email", channel: "EMAIL", subject: "Welcome to {{project}}", body: "Hi {{name}}, thank you for your interest in {{project}}. Our team will reach out shortly.", createdAt: iso(-80) },
  { id: "tmpl_sitevisit", name: "Site Visit Reminder", channel: "WHATSAPP", body: "Hi {{name}}, reminder for your site visit at {{project}} on {{date}}. Reply YES to confirm.", createdAt: iso(-70) },
  { id: "tmpl_offer", name: "Festive Offer SMS", channel: "SMS", body: "{{name}}, limited festive pricing at {{project}}! Book now & save up to 5%. Call {{phone}}.", createdAt: iso(-40) },
  { id: "tmpl_newsletter", name: "Monthly Newsletter", channel: "EMAIL", subject: "New launches this month", body: "Explore our newest inventory and exclusive pre-launch offers.", createdAt: iso(-30) },
];

const segments: Segment[] = [
  { id: "seg_hot", name: "Hot Leads", description: "Leads marked HOT and not yet booked", filters: [{ field: "temperature", op: "eq", value: "HOT" }], createdAt: iso(-60) },
  { id: "seg_portal", name: "Portal Leads", description: "Leads from 99acres & MagicBricks", filters: [{ field: "source", op: "in", value: ["PORTAL_99ACRES", "PORTAL_MAGICBRICKS"] }], createdAt: iso(-50) },
  { id: "seg_highbudget", name: "High Budget (>2Cr)", description: "Budget above 2 crore", filters: [{ field: "budgetMax", op: "gte", value: 20000000 }], createdAt: iso(-45) },
];

const campaigns: Campaign[] = [
  { id: "camp_diwali", name: "Diwali Festive Push", channel: "MULTICHANNEL", status: "COMPLETED", templateId: "tmpl_offer", segmentId: "seg_hot", scheduledAt: iso(-35), sent: 4200, delivered: 4050, opened: 2100, clicked: 640, converted: 38, createdAt: iso(-40) },
  { id: "camp_newsletter", name: "June Newsletter", channel: "EMAIL", status: "RUNNING", templateId: "tmpl_newsletter", segmentId: "seg_portal", scheduledAt: iso(-2), sent: 1800, delivered: 1760, opened: 880, clicked: 210, converted: 12, createdAt: iso(-5) },
  { id: "camp_welcome", name: "Always-On Welcome", channel: "EMAIL", status: "RUNNING", templateId: "tmpl_welcome", scheduledAt: iso(-90), sent: 5600, delivered: 5500, opened: 3300, clicked: 1100, converted: 95, createdAt: iso(-90) },
  { id: "camp_launch", name: "Central Park Pre-Launch", channel: "WHATSAPP", status: "SCHEDULED", templateId: "tmpl_sitevisit", segmentId: "seg_highbudget", scheduledAt: iso(5), sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0, createdAt: iso(-3) },
];

// ─── Leads ────────────────────────────────────────────────────────────────────
const firstNames = ["Rahul", "Sneha", "Amit", "Pooja", "Sanjay", "Kavya", "Manish", "Ritu", "Deepak", "Anjali", "Nikhil", "Shreya", "Varun", "Tanvi", "Akshay", "Divya"];
const lastNames = ["Agarwal", "Desai", "Pillai", "Chopra", "Bose", "Menon", "Shah", "Bhat", "Jain", "Kulkarni"];
const statuses: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "SITE_VISIT_SCHEDULED", "SITE_VISIT_DONE", "NEGOTIATION", "BOOKED", "LOST"];
const sources: LeadSource[] = ["WEBSITE", "PORTAL_99ACRES", "PORTAL_MAGICBRICKS", "PORTAL_HOUSING", "FACEBOOK", "GOOGLE_ADS", "WALK_IN", "REFERRAL", "CHANNEL_PARTNER", "CALL_CENTER"];
const temps: LeadTemperature[] = ["HOT", "WARM", "COLD"];

const leads: Lead[] = [];
const activities: Activity[] = [];
const siteVisits: SiteVisit[] = [];

for (let i = 0; i < 60; i++) {
  const status = pick(statuses);
  const source = pick(sources);
  const temperature = pick(temps);
  const project = pick(projects);
  const ownerId = pick(agentIds);
  const budgetMin = int(40, 120) * 100000;
  const id = `lead_${i + 1}`;
  const createdOffset = -int(1, 120);
  const lead: Lead = {
    id,
    name: `${pick(firstNames)} ${pick(lastNames)}`,
    email: `lead${i + 1}@example.com`,
    phone: `+91 9${int(1000000000, 1999999999)}`.slice(0, 14),
    status,
    source,
    temperature,
    score: temperature === "HOT" ? int(70, 99) : temperature === "WARM" ? int(40, 69) : int(5, 39),
    budgetMin,
    budgetMax: budgetMin + int(20, 100) * 100000,
    requirement: `${pick(unitTypes)} in ${project.locality}`,
    projectId: project.id,
    ownerId,
    channelPartnerId: source === "CHANNEL_PARTNER" ? pick(channelPartners).id : undefined,
    campaignId: rand() > 0.6 ? pick(campaigns).id : undefined,
    tags: temperature === "HOT" ? ["priority"] : [],
    lostReason: status === "LOST" ? pick(["Budget mismatch", "Bought elsewhere", "Not responsive", "Location preference"]) : undefined,
    createdAt: iso(createdOffset),
    updatedAt: iso(createdOffset + int(0, 5)),
    lastContactAt: status === "NEW" ? undefined : iso(createdOffset + int(1, 10)),
  };
  leads.push(lead);

  // Activities
  const actCount = int(1, 4);
  for (let a = 0; a < actCount; a++) {
    activities.push({
      id: `${id}_act${a + 1}`,
      type: pick(["NOTE", "CALL", "EMAIL", "WHATSAPP", "MEETING", "TASK"]),
      leadId: id,
      userId: ownerId,
      subject: pick(["Intro call", "Shared brochure", "Follow-up", "Discussed pricing", "Sent floor plan", "Negotiation call"]),
      body: "Auto-generated demo activity.",
      dueAt: rand() > 0.7 ? iso(int(1, 7)) : undefined,
      completed: rand() > 0.4,
      outcome: rand() > 0.5 ? pick(["Interested", "Call back later", "No answer", "Wants site visit"]) : undefined,
      createdAt: iso(createdOffset + a),
    });
  }

  // Site visits for relevant statuses
  if (["SITE_VISIT_SCHEDULED", "SITE_VISIT_DONE", "NEGOTIATION", "BOOKED"].includes(status)) {
    const past = status !== "SITE_VISIT_SCHEDULED";
    siteVisits.push({
      id: `${id}_sv1`,
      leadId: id,
      projectId: project.id,
      agentId: ownerId,
      scheduledAt: iso(past ? -int(1, 20) : int(1, 14)),
      status: past ? "COMPLETED" : pick(["SCHEDULED", "CONFIRMED"]),
      feedback: past ? pick(["Liked the layout", "Concerned about price", "Wants higher floor", "Very positive"]) : undefined,
      createdAt: iso(createdOffset + 1),
    });
  }
}

// ─── Bookings & payments (derived from BOOKED leads) ──────────────────────────
const bookings: Booking[] = [];
const payments: Payment[] = [];
const bookableUnits = units.filter((u) => u.status === "BOOKED" || u.status === "SOLD");
let bIdx = 0;
for (const lead of leads.filter((l) => l.status === "BOOKED")) {
  const unit = bookableUnits[bIdx % bookableUnits.length];
  if (!unit) break;
  bIdx++;
  const bookingId = `bkg_${bIdx}`;
  const totalValue = unit.basePrice;
  bookings.push({
    id: bookingId,
    leadId: lead.id,
    unitId: unit.id,
    projectId: unit.projectId,
    agentId: lead.ownerId,
    status: pick(["TOKEN", "AGREEMENT", "REGISTERED"]),
    totalValue,
    bookedAt: lead.updatedAt,
  });
  const milestones = [
    { milestone: "Booking Token", pct: 0.1 },
    { milestone: "Agreement", pct: 0.2 },
    { milestone: "Slab Completion", pct: 0.4 },
    { milestone: "Possession", pct: 0.3 },
  ];
  milestones.forEach((m, mi) => {
    payments.push({
      id: `${bookingId}_pay${mi + 1}`,
      bookingId,
      milestone: m.milestone,
      amount: Math.round(totalValue * m.pct),
      dueDate: iso(mi * 30 - 30),
      status: mi === 0 ? "PAID" : mi === 1 ? (rand() > 0.5 ? "PAID" : "OVERDUE") : "PENDING",
      paidAt: mi === 0 ? lead.updatedAt : undefined,
    });
  });
}

// ─── Lead assignment rules ────────────────────────────────────────────────────
const assignmentRules: AssignmentRule[] = [
  { id: "rule_portal", name: "Portal leads → West team round-robin", strategy: "ROUND_ROBIN", priority: 10, active: true, source: "PORTAL_99ACRES", createdAt: iso(-100) },
  { id: "rule_fb", name: "Facebook leads → load balanced", strategy: "LOAD_BALANCED", priority: 8, active: true, source: "FACEBOOK", createdAt: iso(-90) },
  { id: "rule_bangalore", name: "Orchard Grove → South team", strategy: "PROJECT_BASED", priority: 9, active: true, projectId: "proj_grove", assigneeId: "usr_a3", createdAt: iso(-80) },
  { id: "rule_default", name: "Default round-robin", strategy: "ROUND_ROBIN", priority: 0, active: true, createdAt: iso(-120) },
];

export function buildSeed(): SeedData {
  return {
    users,
    teams,
    leads,
    activities,
    siteVisits,
    assignmentRules,
    projects,
    towers,
    units,
    bookings,
    payments,
    channelPartners,
    campaigns,
    templates,
    segments,
  };
}
