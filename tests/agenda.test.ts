// The working day: what one person sees when they sign in, and the morning
// sweep that puts a lead in front of them in the first place.

import { beforeEach, describe, expect, it } from "vitest";
import { getDailyAgenda, greeting } from "@/server/modules/agenda";
import { distributeUnassigned } from "@/server/modules/distribution";
import { db } from "@/server/db";
import type { Lead, User } from "@/types/domain";

const HOUR = 3_600_000;
const DAY = 86_400_000;
const now = new Date("2026-09-03T10:00:00.000Z");
const iso = (offsetMs: number) => new Date(now.getTime() + offsetMs).toISOString();

async function makeUser(over: Partial<User>): Promise<User> {
  return db.users.create({
    name: "Priya Nair",
    email: `${Math.random().toString(36).slice(2)}@estatecrm.local`,
    role: "SALES_AGENT",
    active: true,
    createdAt: iso(-30 * DAY),
    updatedAt: iso(-30 * DAY),
    ...over,
  } as Omit<User, "id">);
}

async function makeLead(over: Partial<Lead>): Promise<Lead> {
  return db.leads.create({
    name: "Test Buyer",
    phone: `9${Math.floor(Math.random() * 1e9)}`.slice(0, 10),
    status: "NEW",
    source: "WEBSITE",
    temperature: "WARM",
    score: 50,
    tags: [],
    createdAt: iso(-DAY),
    updatedAt: iso(-DAY),
    ...over,
  } as Omit<Lead, "id">);
}

async function reset() {
  for (const l of await db.leads.list()) await db.leads.delete(l.id);
  for (const a of await db.activities.list()) await db.activities.delete(a.id);
  for (const v of await db.siteVisits.list()) await db.siteVisits.delete(v.id);
  for (const r of await db.assignmentRules.list()) await db.assignmentRules.delete(r.id);
  for (const u of await db.users.list()) await db.users.delete(u.id);
}

describe("greeting", () => {
  it("changes through the day", () => {
    expect(greeting(new Date("2026-09-03T08:00:00"))).toBe("Good morning");
    expect(greeting(new Date("2026-09-03T14:00:00"))).toBe("Good afternoon");
    expect(greeting(new Date("2026-09-03T20:00:00"))).toBe("Good evening");
  });
});

describe("the daily agenda", () => {
  let agent: User;

  beforeEach(async () => {
    await reset();
    agent = await makeUser({ name: "Priya Nair" });
  });

  it("is clear when nothing is waiting", async () => {
    const agenda = await getDailyAgenda(agent, now);
    expect(agenda.clear).toBe(true);
    expect(agenda.greetingName).toBe("Priya");
    expect(agenda.scope).toBe("mine");
  });

  it("lists leads never contacted, longest wait first", async () => {
    const old = await makeLead({ ownerId: agent.id, createdAt: iso(-3 * DAY), score: 10 });
    const fresh = await makeLead({ ownerId: agent.id, createdAt: iso(-2 * HOUR), score: 90 });

    const agenda = await getDailyAgenda(agent, now);
    expect(agenda.newLeads.map((n) => n.lead.id)).toEqual([old.id, fresh.id]);
    expect(agenda.newLeads[0]?.waitingDays).toBe(3);
    expect(agenda.counts.newLeads).toBe(2);
    expect(agenda.clear).toBe(false);
  });

  it("drops a lead off the call list as soon as it is contacted", async () => {
    const lead = await makeLead({ ownerId: agent.id });
    expect((await getDailyAgenda(agent, now)).counts.newLeads).toBe(1);

    await db.activities.create({
      type: "CALL", leadId: lead.id, userId: agent.id,
      subject: "Called", completed: true, createdAt: iso(-HOUR),
    });
    expect((await getDailyAgenda(agent, now)).counts.newLeads).toBe(0);
  });

  it("does not count a note as having contacted someone", async () => {
    const lead = await makeLead({ ownerId: agent.id });
    await db.activities.create({
      type: "NOTE", leadId: lead.id, userId: agent.id,
      subject: "Assigned in the daily distribution", completed: true, createdAt: iso(-HOUR),
    });
    // The assignment note must not make a lead look worked.
    expect((await getDailyAgenda(agent, now)).counts.newLeads).toBe(1);
  });

  it("flags leads that have gone a week without contact", async () => {
    const warm = await makeLead({ ownerId: agent.id, status: "QUALIFIED", createdAt: iso(-20 * DAY) });
    const cold = await makeLead({ ownerId: agent.id, status: "QUALIFIED", createdAt: iso(-20 * DAY) });
    await db.activities.create({ type: "CALL", leadId: warm.id, userId: agent.id, subject: "x", completed: true, createdAt: iso(-2 * DAY) });
    await db.activities.create({ type: "CALL", leadId: cold.id, userId: agent.id, subject: "x", completed: true, createdAt: iso(-9 * DAY) });

    const agenda = await getDailyAgenda(agent, now);
    expect(agenda.goingCold.map((c) => c.lead.id)).toEqual([cold.id]);
    expect(agenda.goingCold[0]?.waitingDays).toBe(9);
  });

  it("ignores leads that are already booked or lost", async () => {
    await makeLead({ ownerId: agent.id, status: "BOOKED" });
    await makeLead({ ownerId: agent.id, status: "LOST" });
    expect((await getDailyAgenda(agent, now)).counts.newLeads).toBe(0);
  });

  it("separates today's follow-ups from overdue ones", async () => {
    const lead = await makeLead({ ownerId: agent.id });
    await db.activities.create({ type: "TASK", leadId: lead.id, userId: agent.id, subject: "Call back", completed: false, dueAt: iso(2 * HOUR), createdAt: iso(-DAY) });
    await db.activities.create({ type: "TASK", leadId: lead.id, userId: agent.id, subject: "Send brochure", completed: false, dueAt: iso(-2 * DAY), createdAt: iso(-3 * DAY) });
    await db.activities.create({ type: "TASK", leadId: lead.id, userId: agent.id, subject: "Done already", completed: true, dueAt: iso(-DAY), createdAt: iso(-2 * DAY) });

    const agenda = await getDailyAgenda(agent, now);
    expect(agenda.counts.tasksDue).toBe(1);
    expect(agenda.counts.tasksOverdue).toBe(1);
    // Oldest first, so the overdue one leads.
    expect(agenda.tasks[0]?.activity.subject).toBe("Send brochure");
    expect(agenda.tasks.map((t) => t.activity.subject)).not.toContain("Done already");
  });

  it("shows today's visits and anything left open from earlier", async () => {
    const lead = await makeLead({ ownerId: agent.id });
    await db.siteVisits.create({ leadId: lead.id, agentId: agent.id, status: "SCHEDULED", scheduledAt: iso(4 * HOUR), createdAt: iso(-DAY), updatedAt: iso(-DAY) } as never);
    await db.siteVisits.create({ leadId: lead.id, agentId: agent.id, status: "CONFIRMED", scheduledAt: iso(-2 * DAY), createdAt: iso(-3 * DAY), updatedAt: iso(-3 * DAY) } as never);
    await db.siteVisits.create({ leadId: lead.id, agentId: agent.id, status: "COMPLETED", scheduledAt: iso(-DAY), createdAt: iso(-2 * DAY), updatedAt: iso(-2 * DAY) } as never);

    const agenda = await getDailyAgenda(agent, now);
    expect(agenda.counts.visitsToday).toBe(1);
    expect(agenda.counts.visitsOverdue).toBe(1);
    expect(agenda.visits).toHaveLength(2);
  });

  it("never shows one agent another agent's work", async () => {
    const other = await makeUser({ name: "Karan Singh" });
    await makeLead({ ownerId: other.id });
    await makeLead({ ownerId: agent.id });

    expect((await getDailyAgenda(agent, now)).counts.newLeads).toBe(1);
    expect((await getDailyAgenda(other, now)).counts.newLeads).toBe(1);
  });

  it("gives an admin the whole desk", async () => {
    const admin = await makeUser({ name: "Administrator", role: "ADMIN" });
    const other = await makeUser({ name: "Karan Singh" });
    await makeLead({ ownerId: other.id });
    await makeLead({ ownerId: agent.id });

    const agenda = await getDailyAgenda(admin, now);
    expect(agenda.scope).toBe("everyone");
    expect(agenda.counts.newLeads).toBe(2);
  });

  it("counts ownerless leads for whoever can assign them", async () => {
    await makeLead({ ownerId: undefined });
    await makeLead({ ownerId: undefined, status: "LOST" });
    const admin = await makeUser({ name: "Administrator", role: "ADMIN" });
    expect((await getDailyAgenda(admin, now)).unassigned).toBe(1);
  });
});

describe("the morning sweep", () => {
  beforeEach(reset);

  it("reports honestly when there is nothing to place", async () => {
    const result = await distributeUnassigned();
    expect(result).toMatchObject({ considered: 0, assigned: 0, remaining: 0, perAgent: [] });
  });

  it("places every ownerless lead and leaves owned ones alone", async () => {
    const a = await makeUser({ name: "Priya Nair" });
    const b = await makeUser({ name: "Karan Singh" });
    await db.assignmentRules.create({
      name: "Everything", strategy: "ROUND_ROBIN", priority: 0, active: true,
      createdAt: iso(-DAY), updatedAt: iso(-DAY),
    } as never);

    const owned = await makeLead({ ownerId: a.id });
    await makeLead({ ownerId: undefined, createdAt: iso(-2 * DAY) });
    await makeLead({ ownerId: undefined, createdAt: iso(-DAY) });
    await makeLead({ ownerId: undefined, createdAt: iso(-HOUR) });

    const result = await distributeUnassigned();
    expect(result.considered).toBe(3);
    expect(result.assigned).toBe(3);
    expect(result.remaining).toBe(0);
    // Round robin across two agents: nobody takes all three.
    expect(result.perAgent.every((p) => p.count > 0)).toBe(true);
    expect(result.perAgent.reduce((n, p) => n + p.count, 0)).toBe(3);

    const leads = await db.leads.list();
    expect(leads.every((l) => l.ownerId)).toBe(true);
    // The already-owned lead kept its owner.
    expect((await db.leads.find(owned.id))?.ownerId).toBe(a.id);

    const ids = new Set([a.id, b.id]);
    expect(leads.every((l) => ids.has(l.ownerId!))).toBe(true);
  });

  it("leaves a note on each lead it places", async () => {
    const a = await makeUser({ name: "Priya Nair" });
    await db.assignmentRules.create({
      name: "Everything", strategy: "ROUND_ROBIN", priority: 0, active: true,
      createdAt: iso(-DAY), updatedAt: iso(-DAY),
    } as never);
    const lead = await makeLead({ ownerId: undefined });

    await distributeUnassigned();
    const notes = (await db.activities.list()).filter((n) => n.leadId === lead.id);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.subject).toContain(a.name);
    expect(notes[0]?.subject).toContain("daily distribution");
  });

  it("is safe to run twice", async () => {
    await makeUser({ name: "Priya Nair" });
    await db.assignmentRules.create({
      name: "Everything", strategy: "ROUND_ROBIN", priority: 0, active: true,
      createdAt: iso(-DAY), updatedAt: iso(-DAY),
    } as never);
    await makeLead({ ownerId: undefined });

    expect((await distributeUnassigned()).assigned).toBe(1);
    const second = await distributeUnassigned();
    expect(second.considered).toBe(0);
    expect(second.assigned).toBe(0);
    expect((await db.activities.list())).toHaveLength(1);
  });

  it("reports leads it could not place rather than silently dropping them", async () => {
    // A rule exists but there is nobody to receive the lead.
    await db.assignmentRules.create({
      name: "Everything", strategy: "ROUND_ROBIN", priority: 0, active: true,
      createdAt: iso(-DAY), updatedAt: iso(-DAY),
    } as never);
    await makeLead({ ownerId: undefined });

    const result = await distributeUnassigned();
    expect(result.considered).toBe(1);
    expect(result.assigned).toBe(0);
    expect(result.remaining).toBe(1);
  });

  it("never hands a lead to an inactive agent", async () => {
    await makeUser({ name: "Retired", active: false });
    const active = await makeUser({ name: "Priya Nair" });
    await db.assignmentRules.create({
      name: "Everything", strategy: "ROUND_ROBIN", priority: 0, active: true,
      createdAt: iso(-DAY), updatedAt: iso(-DAY),
    } as never);
    await makeLead({ ownerId: undefined });
    await makeLead({ ownerId: undefined });

    await distributeUnassigned();
    const leads = await db.leads.list();
    expect(leads.every((l) => l.ownerId === active.id)).toBe(true);
  });
});
