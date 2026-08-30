import { describe, expect, it } from "vitest";
import { blankToUndefined } from "@/lib/zod-helpers";
import { activityInputSchema } from "@/server/modules/leads";
import { visitInputSchema } from "@/server/modules/site-visits";
import { ruleInputSchema } from "@/server/modules/distribution";

// FormData.get() returns null for any field the form did not render. Every
// optional schema field fed straight from FormData has to survive that, or the
// whole form fails with "Expected string, received null" — the bug that made
// it impossible to log a call, email or WhatsApp against a lead.
describe("blankToUndefined", () => {
  it("treats null, undefined and blank strings as absent", () => {
    for (const v of [null, undefined, "", "   ", "\t\n"]) {
      expect(blankToUndefined(v)).toBeUndefined();
    }
  });

  it("passes real values through untouched", () => {
    expect(blankToUndefined("Mumbai")).toBe("Mumbai");
    expect(blankToUndefined(0)).toBe(0);
    expect(blankToUndefined(false)).toBe(false);
  });
});

describe("schemas accept FormData nulls for unrendered fields", () => {
  it("logs a CALL when the TASK-only dueAt field was never rendered", () => {
    const parsed = activityInputSchema.safeParse({
      type: "CALL",
      subject: "Intro call",
      body: null,
      outcome: null,
      dueAt: null, // formData.get("dueAt") when the input is not on the page
      completed: true,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.dueAt).toBeUndefined();
  });

  it("schedules a visit with the optional project and agent left blank", () => {
    const parsed = visitInputSchema.safeParse({
      leadId: "lead_1",
      projectId: null,
      agentId: "",
      scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(parsed.success).toBe(true);
  });

  it("creates a catch-all rule with no source filter", () => {
    const parsed = ruleInputSchema.safeParse({
      name: "Catch all",
      strategy: "ROUND_ROBIN",
      priority: "10",
      source: null,
      projectId: null,
      assigneeId: null,
      active: true,
    });
    expect(parsed.success).toBe(true);
  });
});
