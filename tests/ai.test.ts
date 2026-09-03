// The operator: an OpenAI-compatible model behind a log default, copy that
// cannot invent a number, and a ledger that caps generations per month.

import { beforeEach, describe, expect, it } from "vitest";
import { chat, extractJson, isLlmEnabled, llmConfig } from "@/server/ai/llm";
import { factViolations, templateAdCopy, writeAdCopy, writeNarration } from "@/server/ai/copy";
import { deriveBrief } from "@/server/content/brief";
import { MARKETS } from "@/server/content/market";
import { createNvidiaImageProvider, nvidiaImageConfig } from "@/server/media/nvidia-image";
import { monthlyCap, promptHash, usageSummary, withLedger, BudgetExceededError } from "@/server/media/ledger";
import { db } from "@/server/db";
import type { Project, Unit } from "@/types/domain";

const project = {
  id: "proj_ai",
  name: "Agartha",
  developer: "Modcon Developers",
  city: "Hyderabad",
  locality: "Gachibowli",
  status: "ONGOING",
  reraId: "RERA/TG/2026/AGR/001",
  amenities: ["Clubhouse", "Infinity Pool", "Gym"],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as Project;

const units = [
  { id: "u1", projectId: "proj_ai", towerId: "t", number: "A-1001", floor: 10, type: "3BHK", carpetArea: 1450, basePrice: 13_800_000, status: "AVAILABLE", createdAt: "", updatedAt: "" },
] as unknown as Unit[];

const brief = deriveBrief(project, units, MARKETS.IN);

function fakeFetch(body: unknown, status = 200) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const completion = (content: string) => ({ model: "test-model", choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 20 } });

describe("llm config", () => {
  it("is log until a provider and key are set", () => {
    expect(llmConfig({}).driver).toBe("log");
    expect(llmConfig({ AI_PROVIDER: "nvidia" }).driver).toBe("log");
    expect(isLlmEnabled({ AI_PROVIDER: "nvidia", AI_API_KEY: "nvapi-x" })).toBe(true);
    expect(isLlmEnabled({ AI_PROVIDER: "ollama" })).toBe(true);
  });

  it("uses provider presets and honours overrides", () => {
    const c = llmConfig({ AI_PROVIDER: "openrouter", AI_API_KEY: "k" });
    expect(c.baseUrl).toBe("https://openrouter.ai/api/v1");
    expect(c.model).toBe("openrouter/free");
    expect(llmConfig({ AI_PROVIDER: "nvidia", AI_API_KEY: "k", AI_MODEL: "nvidia/nemotron-3-super" }).model).toBe("nvidia/nemotron-3-super");
    expect(llmConfig({ AI_PROVIDER: "custom", AI_BASE_URL: "http://lm:1234/v1/", AI_MODEL: "qwen" }).baseUrl).toBe("http://lm:1234/v1");
  });

  it("refuses to call anything under the log driver", async () => {
    await expect(chat([{ role: "user", content: "hi" }], { env: {} })).rejects.toThrow(/No language model/);
  });

  it("posts an OpenAI-shaped request and reads the completion", async () => {
    const { impl, calls } = fakeFetch(completion("hello"));
    const r = await chat([{ role: "user", content: "hi" }], { env: { AI_PROVIDER: "nvidia", AI_API_KEY: "nvapi-1" }, fetchImpl: impl, json: true });
    expect(r.text).toBe("hello");
    expect(calls[0]?.url).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
    const body = JSON.parse(calls[0]?.init.body as string);
    expect(body.model).toBe("meta/llama-3.3-70b-instruct");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect((calls[0]?.init.headers as Record<string, string>).Authorization).toBe("Bearer nvapi-1");
  });

  it("extracts JSON from fenced or chatty completions", () => {
    expect(extractJson('Sure! ```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(() => extractJson("no json here")).toThrow();
  });
});

describe("fact guard", () => {
  it("allows the brief's figures and flags invented ones", () => {
    expect(factViolations("3 BHK from ₹1.38 Cr, carpet up to 1,450 sq ft", brief)).toEqual([]);
    expect(factViolations("from ₹99 L, 2,000 sq ft", brief)).toEqual(["₹99 L", "2,000 sq ft"]);
  });
});

describe("copy", () => {
  it("falls back to the template with no model", async () => {
    const n = await writeNarration(brief, { env: {} });
    expect(n.source).toBe("template");
    expect(n.cues).toHaveLength(4);
    const c = await writeAdCopy(brief, { env: {} });
    expect(c.source).toBe("template");
    expect(c.copy.google.headlines.every((h) => h.length <= 30)).toBe(true);
  });

  it("accepts a valid AI narration", async () => {
    const { impl } = fakeFetch(
      completion(
        JSON.stringify({
          cues: [
            { scene: "hook", text: "Agartha, by Modcon Developers, in Gachibowli." },
            { scene: "homes", text: "3 BHK homes from 1.38 crore." },
            { scene: "amenities", text: "Clubhouse, infinity pool and a gym." },
            { scene: "cta", text: "Message us to book your site visit." },
          ],
        }),
      ),
    );
    const n = await writeNarration(brief, { env: { AI_PROVIDER: "groq", AI_API_KEY: "g" }, fetchImpl: impl });
    expect(n.source).toBe("ai");
    expect(n.cues[1]?.text).toBe("3 BHK homes from 1.38 crore.");
    expect(n.cues[1]?.start).toBeGreaterThan(n.cues[0]!.start);
  });

  it("rejects AI copy that invents a price", async () => {
    const { impl } = fakeFetch(
      completion(
        JSON.stringify({
          hook: "Ready to move up?",
          instagram: { caption: "Agartha in Gachibowli. Homes from ₹95 L. Book a visit with us today.", hashtags: ["#agartha"] },
          google: { headlines: ["Agartha Gachibowli", "3BHK from ₹95 L", "Book a site visit"], longHeadline: "Agartha in Gachibowli", descriptions: ["Homes by Modcon in Gachibowli.", "Book a site visit today."] },
        }),
      ),
    );
    const c = await writeAdCopy(brief, { env: { AI_PROVIDER: "groq", AI_API_KEY: "g" }, fetchImpl: impl });
    expect(c.source).toBe("template");
    expect(c.rejected).toMatch(/Invented figure: ₹95 L/);
    expect(JSON.stringify(c.copy)).toContain("₹1.38 Cr");
  });

  it("drops Google lines that overflow rather than truncating them", async () => {
    const { impl } = fakeFetch(
      completion(
        JSON.stringify({
          hook: "Ready to move up?",
          instagram: { caption: "Agartha in Gachibowli. Three bedroom homes. Book a visit with us today.", hashtags: [] },
          google: {
            headlines: ["Agartha, Gachibowli", "3 BHK from ₹1.38 Cr", "Book a site visit", "This headline is far too long for a Google responsive ad"],
            longHeadline: "Agartha: 3 BHK homes in Gachibowli from ₹1.38 Cr",
            descriptions: ["Homes by Modcon Developers in Gachibowli.", "Book a site visit today."],
          },
        }),
      ),
    );
    const c = await writeAdCopy(brief, { env: { AI_PROVIDER: "groq", AI_API_KEY: "g" }, fetchImpl: impl });
    expect(c.source).toBe("ai");
    expect(c.copy.google.headlines).toHaveLength(3);
  });

  it("template copy never exceeds Google limits", () => {
    const t = templateAdCopy(brief);
    expect(t.google.longHeadline.length).toBeLessThanOrEqual(90);
    expect(t.google.descriptions.every((d) => d.length <= 90)).toBe(true);
  });
});

describe("nvidia images", () => {
  it("requires a key and defaults to FLUX schnell", () => {
    expect(nvidiaImageConfig({}).apiKey).toBeUndefined();
    expect(nvidiaImageConfig({ NVIDIA_API_KEY: "nvapi-1" }).model).toBe("flux.1-schnell");
    expect(() => createNvidiaImageProvider({})).toThrow(/NVIDIA_API_KEY/);
  });

  it("posts the model-specific request and decodes the image", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]).toString("base64");
    const { impl, calls } = fakeFetch({ image: png });
    const provider = createNvidiaImageProvider({ NVIDIA_API_KEY: "nvapi-1" });
    const r = await provider.generateImage({ prompt: "evening skyline, Gachibowli", aspect: "9:16", seed: 7 }, { fetchImpl: impl });
    expect(calls[0]?.url).toBe("https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell");
    const body = JSON.parse(calls[0]?.init.body as string);
    expect(body).toMatchObject({ width: 768, height: 1344, steps: 4, seed: 7 });
    expect(r.mimeType).toBe("image/png");
    expect(r.bytes.length).toBe(7);
    expect(r.estimatedCostUsd).toBe(0);
  });
});

describe("ledger", () => {
  beforeEach(async () => {
    for (const row of await db.mediaGenerations.list()) await db.mediaGenerations.delete(row.id);
  });

  it("reads caps from env with sane defaults", () => {
    expect(monthlyCap("image", {})).toBe(200);
    expect(monthlyCap("image", { MEDIA_MONTHLY_IMAGE_CAP: "3" })).toBe(3);
    expect(promptHash("a")).toHaveLength(24);
    expect(promptHash("a", { aspect: "1:1" })).not.toBe(promptHash("a"));
  });

  it("records done, failed and refused rows and enforces the cap", async () => {
    const env = { MEDIA_MONTHLY_IMAGE_CAP: "2" };
    const input = { kind: "image" as const, provider: "nvidia", model: "flux.1-schnell", prompt: "x" };
    await withLedger(input, async () => ({ estimatedCostUsd: 0 }), env);
    await expect(withLedger(input, async () => { throw new Error("boom"); }, env)).rejects.toThrow("boom");
    await expect(withLedger(input, async () => ({ estimatedCostUsd: 0 }), env)).rejects.toBeInstanceOf(BudgetExceededError);
    const rows = await db.mediaGenerations.list();
    expect(rows.map((r) => r.status).sort()).toEqual(["done", "failed", "refused"]);
    const summary = await usageSummary(env);
    expect(summary.find((s) => s.kind === "image")).toMatchObject({ used: 3, cap: 2, remaining: 0 });
  });
});
