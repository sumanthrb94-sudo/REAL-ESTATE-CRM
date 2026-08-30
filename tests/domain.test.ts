import { describe, expect, it } from "vitest";
import { fieldLabel, formatINR, humanize } from "@/lib/utils";
import { isPaymentConsistent, paymentStatusPatch } from "@/server/modules/bookings";
import { describeFilter } from "@/components/marketing/shared";
import { LEAD_SOURCES } from "@/types/domain";

describe("humanize", () => {
  it("title-cases enum tokens", () => {
    expect(humanize("SITE_VISIT_SCHEDULED")).toBe("Site Visit Scheduled");
    expect(humanize("SALES_MANAGER")).toBe("Sales Manager");
  });

  it("keeps acronyms and brand names intact", () => {
    // These used to render as "Sms" and "Whatsapp" — as section headings on a
    // page about messaging.
    expect(humanize("SMS")).toBe("SMS");
    expect(humanize("WHATSAPP")).toBe("WhatsApp");
    expect(humanize("PORTAL_MAGICBRICKS")).toBe("Portal MagicBricks");
    expect(humanize("PORTAL_99ACRES")).toBe("Portal 99acres");
  });

  it("handles null and empty input", () => {
    expect(humanize(null)).toBe("—");
    expect(humanize(undefined)).toBe("—");
    expect(humanize("")).toBe("—");
  });

  it("renders every lead source without producing a mangled acronym", () => {
    for (const source of LEAD_SOURCES) {
      const label = humanize(source);
      expect(label).not.toBe("—");
      expect(label).not.toMatch(/Sms|Whatsapp|Rera/);
    }
  });
});

describe("fieldLabel", () => {
  it("splits camelCase into words", () => {
    expect(fieldLabel("budgetMax")).toBe("Budget max");
    expect(fieldLabel("lastContactAt")).toBe("Last contact at");
  });

  it("handles snake_case", () => {
    expect(fieldLabel("channel_partner_id")).toBe("Channel partner ID");
  });

  it("returns the input for an empty string", () => {
    expect(fieldLabel("")).toBe("");
  });
});

describe("formatINR", () => {
  it("uses crore and lakh above their thresholds", () => {
    expect(formatINR(20_000_000)).toBe("₹2.00 Cr");
    expect(formatINR(8_500_000)).toBe("₹85.00 L");
    expect(formatINR(50_000)).toBe("₹50,000");
  });

  it("renders nothing for null", () => {
    expect(formatINR(null)).toBe("—");
    expect(formatINR(undefined)).toBe("—");
  });
});

describe("describeFilter", () => {
  it("writes a segment rule the way a person would read it", () => {
    // This chip used to read "Budgetmax is at least 20000000".
    expect(
      describeFilter({ field: "budgetMax", op: "gte", value: 20_000_000 }, formatINR),
    ).toBe("Budget Max (₹) is at least ₹2.00 Cr");
  });

  it("humanizes enum values", () => {
    expect(describeFilter({ field: "temperature", op: "eq", value: "HOT" }, formatINR)).toBe(
      "Temperature equals Hot",
    );
    expect(
      describeFilter({ field: "source", op: "in", value: ["INSTAGRAM", "FACEBOOK"] }, formatINR),
    ).toBe("Source is one of Instagram, Facebook");
  });

  it("falls back to a readable label for an unknown field", () => {
    expect(describeFilter({ field: "someNewField", op: "eq", value: "x" }, formatINR)).toBe(
      "Some new field equals x",
    );
  });
});

describe("payment status invariant", () => {
  it("always sets paidAt alongside PAID", () => {
    const patch = paymentStatusPatch("PAID");
    expect(patch.status).toBe("PAID");
    expect(patch.paidAt).toBeTruthy();
  });

  it("clears paidAt when a payment is not PAID", () => {
    for (const status of ["PENDING", "OVERDUE"] as const) {
      const patch = paymentStatusPatch(status);
      expect(patch.paidAt).toBeUndefined();
    }
  });

  it("recognises the inconsistent state the old seed produced", () => {
    // A green "Paid" badge beside an em-dash in the Paid On column.
    expect(isPaymentConsistent({ status: "PAID", paidAt: undefined })).toBe(false);
    expect(isPaymentConsistent({ status: "PAID", paidAt: "2026-08-01T00:00:00Z" })).toBe(true);
    expect(isPaymentConsistent({ status: "PENDING", paidAt: undefined })).toBe(true);
  });

  it("produces a consistent record for every status", () => {
    for (const status of ["PENDING", "PAID", "OVERDUE"] as const) {
      expect(isPaymentConsistent(paymentStatusPatch(status))).toBe(true);
    }
  });
});
