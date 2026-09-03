// The content engine: briefs derived from inventory, the HyperFrames
// composition contract, and the narration that must agree with both.

import { describe, expect, it } from "vitest";
import { deriveBrief, briefVariables } from "@/server/content/brief";
import { slideElement, SLIDES, SLIDE_COUNT } from "@/server/content/carousel";
import { formatMoney, MARKETS, resolveMarket, spokenMoney } from "@/server/content/market";
import { IMAGE_PRESETS } from "@/server/content/presets";
import { buildReelComposition, reelCompositionId, reelProjectFiles, REEL_DURATION_S } from "@/server/content/reel";
import { directNarration, isV3, narrationText, reelNarration, stripAudioTags, synthesizeNarration, voiceConfig } from "@/server/content/voiceover";
import type { Project, Unit } from "@/types/domain";

const project: Project = {
  id: "proj_test",
  name: "Agartha",
  developer: "Modcon Developers",
  city: "Hyderabad",
  locality: "Kokapet",
  status: "ONGOING",
  description: "Sky homes over the Financial District.",
  reraId: "P02400001234",
  amenities: ["Clubhouse", "Infinity pool", "Gym", "Kids play area", "Jogging track", "Co-working", "Spa"],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as Project;

function unit(overrides: Partial<Unit>): Unit {
  return {
    id: `unit_${Math.random().toString(36).slice(2)}`,
    projectId: project.id,
    towerId: "tower_a",
    number: "A-1001",
    floor: 10,
    type: "3BHK",
    carpetArea: 1450,
    basePrice: 12_000_000,
    status: "AVAILABLE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as Unit;
}

const units = [
  unit({ type: "3BHK", basePrice: 12_000_000, carpetArea: 1450 }),
  unit({ type: "2BHK", basePrice: 8_800_000, carpetArea: 1100 }),
  unit({ type: "2BHK", basePrice: 7_500_000, carpetArea: 1050, status: "SOLD" }),
  unit({ type: "4BHK", basePrice: 21_000_000, carpetArea: 2400, status: "BLOCKED" }),
];

describe("deriveBrief", () => {
  const brief = deriveBrief(project, units, MARKETS.IN);

  it("prices from available units only, never a sold one", () => {
    // The cheapest unit is SOLD at 75 L; advertising it would be a false claim.
    expect(brief.priceFrom).toBe(8_800_000);
    expect(brief.priceFromLabel).toBe("₹88.00 L");
  });

  it("orders configurations by bedroom count and dedupes", () => {
    expect(brief.unitTypes).toEqual(["2BHK", "3BHK", "4BHK"]);
  });

  it("caps amenities at six and keeps the project's order", () => {
    expect(brief.amenities).toHaveLength(6);
    expect(brief.amenities[0]).toBe("Clubhouse");
  });

  it("names the market's regulator on the registration label", () => {
    expect(brief.registrationLabel).toBe("RERA P02400001234");
    expect(deriveBrief(project, units, MARKETS.AE).registrationLabel).toBe("DLD P02400001234");
    expect(deriveBrief({ ...project, reraId: undefined }, units).registrationLabel).toBeUndefined();
    // Seeded ids already carry the prefix; never print "RERA RERA/…".
    expect(deriveBrief({ ...project, reraId: "RERA/TG/2026/AGR/001" }, units, MARKETS.IN).registrationLabel).toBe("RERA/TG/2026/AGR/001");
  });

  it("handles a project with no inventory", () => {
    const empty = deriveBrief(project, []);
    expect(empty.hasInventory).toBe(false);
    expect(empty.priceFrom).toBeUndefined();
    expect(empty.unitTypes).toEqual([]);
    expect(empty.totalUnits).toBe(0);
  });

  it("exposes template variables", () => {
    const vars = briefVariables(brief);
    expect(vars.price_from).toBe("₹88.00 L");
    expect(vars.unit_types).toBe("2BHK & 3BHK & 4BHK");
    expect(vars.registration).toBe("RERA P02400001234");
  });
});

describe("markets", () => {
  it("formats India in lakh and crore, elsewhere compact currency", () => {
    expect(formatMoney(8_800_000, MARKETS.IN)).toBe("₹88.00 L");
    expect(formatMoney(13_800_000, MARKETS.IN)).toBe("₹1.38 Cr");
    expect(formatMoney(1_500_000, MARKETS.AE)).toMatch(/AED\s?1\.5M/);
    expect(formatMoney(920_000, MARKETS.US)).toBe("$920K");
  });

  it("speaks money in words", () => {
    expect(spokenMoney(13_800_000, MARKETS.IN)).toBe("1.38 crore");
    expect(spokenMoney(9_000_000, MARKETS.IN)).toBe("90 lakh");
    expect(spokenMoney(920_000, MARKETS.US)).toBe("920,000 US dollars");
  });

  it("falls back to India for an unknown id", () => {
    expect(resolveMarket("ZZ").id).toBe("IN");
    expect(resolveMarket("GB").currency).toBe("GBP");
  });
});

describe("carousel", () => {
  const brief = deriveBrief(project, units, MARKETS.IN);

  it("builds every slide for every preset without throwing", () => {
    for (const preset of Object.keys(IMAGE_PRESETS) as Array<keyof typeof IMAGE_PRESETS>) {
      for (let i = 0; i < SLIDE_COUNT; i++) {
        expect(slideElement(brief, i, preset)).toBeTruthy();
      }
    }
  });

  it("rejects a slide index past the end", () => {
    expect(() => slideElement(brief, SLIDES.length)).toThrow(/does not exist/);
  });

  it("stays inside Satori's subset: every multi-child element is flex", () => {
    // Walk the element tree; any element with 2+ element children must declare display:flex.
    type El = { props?: { style?: Record<string, unknown>; children?: unknown } };
    const violations: string[] = [];
    const walk = (node: unknown, path: string) => {
      if (!node || typeof node !== "object") return;
      const el = node as El;
      // Text nodes count too: "Life at {name}" is two children to Satori.
      const all = ([] as unknown[]).concat(el.props?.children ?? []).flat().filter((k) => k !== null && k !== undefined && k !== false && k !== "");
      const kids = all.filter((k) => k && typeof k === "object");
      if (all.length >= 2 && el.props?.style?.display !== "flex") violations.push(path);
      kids.forEach((k, i) => walk(k, `${path}/${i}`));
    };
    for (let i = 0; i < SLIDE_COUNT; i++) walk(slideElement(brief, i), `slide${i}`);
    expect(violations).toEqual([]);
  });
});

describe("reel composition", () => {
  const brief = deriveBrief(project, units, MARKETS.IN);
  const html = buildReelComposition(brief);

  it("declares one root composition with the Reel's duration and size", () => {
    expect(html).toContain(`data-composition-id="${reelCompositionId(brief)}"`);
    expect(html).toContain(`data-duration="${REEL_DURATION_S}"`);
    expect(html).toContain('data-width="1080"');
    expect(html).toContain('data-height="1920"');
    expect(html.match(/data-composition-id=/g)).toHaveLength(1);
  });

  it("registers exactly one paused timeline under the composition id", () => {
    expect(html.match(/window\.__timelines\[/g)).toHaveLength(1);
    expect(html).toContain(`window.__timelines["${reelCompositionId(brief)}"] = tl;`);
    expect(html).toContain("gsap.timeline({ paused: true })");
  });

  it("gives every audio element an id and a local source", () => {
    const audios = html.match(/<audio[^>]*>/g) ?? [];
    expect(audios.length).toBeGreaterThanOrEqual(8);
    for (const tag of audios) {
      expect(tag).toMatch(/\bid="[^"]+"/);
      expect(tag).toMatch(/src="assets\//);
      expect(tag).not.toContain("crossorigin");
    }
    const ids = audios.map((t) => /\bid="([^"]+)"/.exec(t)?.[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never reaches the network or a clock", () => {
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/Math\.random|Date\.now|new Date|repeat:\s*-1/);
  });

  it("keeps clips inside the composition window", () => {
    const clips = [...html.matchAll(/class="clip" data-start="([\d.]+)" data-duration="([\d.]+)"/g)];
    expect(clips).toHaveLength(4);
    const end = Math.max(...clips.map((m) => Number(m[1]) + Number(m[2])));
    expect(end).toBeCloseTo(REEL_DURATION_S, 5);
  });

  it("escapes project data", () => {
    const hostile = deriveBrief({ ...project, name: 'Tower <script>alert("x")</script>' }, units);
    expect(buildReelComposition(hostile)).not.toContain("<script>alert");
  });

  it("adds the narration track only when asked", () => {
    expect(html).not.toContain('id="vo"');
    const withVo = buildReelComposition(brief, { voiceover: true });
    expect(withVo).toContain('<audio id="vo" src="assets/vo.mp3" data-start="0"');
  });

  it("ships a runnable project", () => {
    const files = reelProjectFiles(brief);
    expect(Object.keys(files).sort()).toEqual(["README.md", "hyperframes.json", "index.html", "meta.json", "package.json"]);
    expect(JSON.parse(files["package.json"] as string).scripts.render).toContain("hyperframes@");
  });
});

describe("narration", () => {
  const brief = deriveBrief(project, units, MARKETS.IN);

  it("says the slide's price the way a narrator would", () => {
    const cues = reelNarration(brief);
    expect(cues).toHaveLength(4);
    expect(cues[1]?.text).toBe("2 BHK, 3 BHK and 4 BHK homes from 88 lakh.");
    expect(reelNarration(deriveBrief(project, units, MARKETS.AE))[1]?.text).toBe("2 BHK, 3 BHK and 4 BHK homes from 8,800,000 UAE dirhams.");
    expect(cues[2]?.text).toBe("With Clubhouse, Infinity pool and Gym.");
  });

  it("starts each cue after its scene begins, in order", () => {
    const cues = reelNarration(brief);
    for (let i = 1; i < cues.length; i++) expect(cues[i]!.start).toBeGreaterThan(cues[i - 1]!.start);
    expect(cues[cues.length - 1]!.start).toBeLessThan(REEL_DURATION_S);
  });

  it("stays short enough for twelve seconds", () => {
    const words = narrationText(reelNarration(brief)).replace(/<[^>]+>/g, "").split(/\s+/).filter(Boolean);
    expect(words.length).toBeLessThanOrEqual(40);
  });

  it("defaults to the log driver and refuses to synthesise without a key", async () => {
    expect(voiceConfig({}).driver).toBe("log");
    expect(voiceConfig({ VOICE_DRIVER: "elevenlabs" }).driver).toBe("log");
    expect(voiceConfig({ VOICE_DRIVER: "elevenlabs", ELEVENLABS_API_KEY: "k" }).driver).toBe("elevenlabs");
    await expect(synthesizeNarration("hi", { env: {} })).rejects.toThrow(/not configured/);
  });

  it("posts the script to the configured voice", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": "audio/mpeg" } });
    }) as unknown as typeof fetch;
    const result = await synthesizeNarration("Hello.", {
      fetchImpl,
      env: { VOICE_DRIVER: "elevenlabs", ELEVENLABS_API_KEY: "secret", ELEVENLABS_VOICE_ID: "voice_1" },
    });
    expect(result.audio.byteLength).toBe(3);
    expect(calls[0]?.url).toContain("/text-to-speech/voice_1");
    expect((calls[0]?.init.headers as Record<string, string>)["xi-api-key"]).toBe("secret");
    expect(JSON.parse(calls[0]?.init.body as string).model_id).toBe("eleven_v3");
  });
});

describe("ElevenLabs v3", () => {
  it("defaults to the expressive model", () => {
    expect(voiceConfig({ VOICE_DRIVER: "elevenlabs", ELEVENLABS_API_KEY: "k" }).modelId).toBe("eleven_v3");
    expect(isV3("eleven_v3")).toBe(true);
    expect(isV3("eleven_v3_conversational")).toBe(true);
    expect(isV3("eleven_multilingual_v2")).toBe(false);
  });

  it("directs each scene with an audio tag on v3", () => {
    const brief = deriveBrief(project, units, MARKETS.IN);
    const directed = directNarration(reelNarration(brief), "eleven_v3");
    expect(directed[0]?.text.startsWith("[warmly]")).toBe(true);
    expect(directed[3]?.text.startsWith("[excited]")).toBe(true);
    // Timing is untouched: direction changes delivery, not the schedule.
    expect(directed.map((c) => c.start)).toEqual(reelNarration(brief).map((c) => c.start));
  });

  it("strips tags for a model that would read them aloud", () => {
    const brief = deriveBrief(project, units, MARKETS.IN);
    const tagged = directNarration(reelNarration(brief), "eleven_v3");
    const plain = directNarration(tagged, "eleven_multilingual_v2");
    expect(plain.some((c) => /\[/.test(c.text))).toBe(false);
    expect(stripAudioTags("[whispers] Book a [laughs] visit")).toBe("Book a visit");
  });

  it("sends v3 only the stability values it accepts", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(new Uint8Array([1]), { status: 200 });
    }) as unknown as typeof fetch;
    const env = { VOICE_DRIVER: "elevenlabs", ELEVENLABS_API_KEY: "k", ELEVENLABS_VOICE_ID: "v" };

    await synthesizeNarration("hi", { fetchImpl, env });
    const v3 = JSON.parse(calls[0]!.init.body as string);
    expect(v3.model_id).toBe("eleven_v3");
    // v3 rejects anything but 0, 0.5 or 1, and has no style parameter.
    expect([0, 0.5, 1]).toContain(v3.voice_settings.stability);
    expect(v3.voice_settings.style).toBeUndefined();

    await synthesizeNarration("hi", { fetchImpl, env: { ...env, ELEVENLABS_MODEL_ID: "eleven_multilingual_v2" } });
    expect(JSON.parse(calls[1]!.init.body as string).voice_settings.style).toBe(0.2);
  });

  it("refuses a script longer than the model accepts", async () => {
    await expect(
      synthesizeNarration("x".repeat(5_001), {
        env: { VOICE_DRIVER: "elevenlabs", ELEVENLABS_API_KEY: "k" },
        fetchImpl: (async () => new Response(new Uint8Array([1]))) as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/5000 characters; eleven_v3 accepts 5000|accepts 5,?000/);
  });
});
