// Copywriting for a project: narration lines and ad copy.
//
// The model writes words; the brief supplies every fact. Anything that looks
// like a price or an area in the output is checked against the brief and the
// whole result is discarded if a number was invented, because a wrong "from"
// price in an ad is a regulatory problem and not a typo.

import { z } from "zod";
import type { CreativeBrief } from "@/server/content/brief";
import { briefVariables } from "@/server/content/brief";
import { formatArea } from "@/server/content/market";
import { reelNarration, type NarrationCue } from "@/server/content/voiceover";
import { chat, extractJson, isLlmEnabled, type EnvLike } from "./llm";

export interface CopySource {
  source: "ai" | "template";
  model?: string;
  /** Present when the model answered but its output was rejected. */
  rejected?: string;
}

// --- fact guard ---------------------------------------------------------------

const MONEY = /₹\s?[\d.,]+\s?(?:Cr|L|lakh|crore)?/gi;
const AREA = /[\d,]+\s?sq\s?(?:ft|m)/gi;

function norm(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

/** Every money or area figure in `text` must be one the brief supplies. */
export function factViolations(text: string, brief: CreativeBrief): string[] {
  const allowed = new Set<string>();
  if (brief.priceFromLabel) allowed.add(norm(brief.priceFromLabel));
  if (brief.carpetMax) allowed.add(norm(formatArea(brief.carpetMax, brief.market)));
  const bad: string[] = [];
  for (const m of text.match(MONEY) ?? []) if (!allowed.has(norm(m))) bad.push(m.trim());
  for (const m of text.match(AREA) ?? []) if (!allowed.has(norm(m))) bad.push(m.trim());
  return bad;
}

function factSheet(brief: CreativeBrief): string {
  const v = briefVariables(brief);
  return [
    `Project: ${v.project}`,
    `Developer: ${v.developer}`,
    `Location: ${v.location}`,
    `Configurations: ${v.unit_types || "not disclosed"}`,
    `Starting price: ${v.price_from || "not disclosed, say 'pricing on request'"}`,
    brief.carpetMax ? `Largest carpet area: ${formatArea(brief.carpetMax, brief.market)}` : "Carpet area: not disclosed",
    `Available now: ${brief.availableCount} of ${brief.totalUnits} homes`,
    `Amenities: ${brief.amenities.join(", ") || "none listed"}`,
    v.registration ? `Registration: ${v.registration}` : "",
    brief.description ? `Description: ${brief.description}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const RULES =
  "Rules: use only the facts given; never invent a price, area, count, distance or date; " +
  "no exclamation marks; no emoji; plain confident language; Indian English.";

// --- narration -------------------------------------------------------------------

const narrationSchema = z.object({
  cues: z
    .array(
      z.object({
        scene: z.enum(["hook", "homes", "amenities", "cta"]),
        text: z.string().min(4).max(140),
      }),
    )
    .length(4),
});

export interface NarrationResult extends CopySource {
  cues: NarrationCue[];
}

export interface NarrationOptions {
  language?: string;
  audience?: string;
  env?: EnvLike;
  fetchImpl?: typeof fetch;
}

/** Four narration lines for the Reel: AI when a model is configured, template otherwise. */
export async function writeNarration(brief: CreativeBrief, options: NarrationOptions = {}): Promise<NarrationResult> {
  const template = reelNarration(brief);
  if (!isLlmEnabled(options.env ?? process.env)) return { cues: template, source: "template" };

  const language = options.language ?? "English";
  const audience = options.audience ?? "home buyers in India browsing Instagram Reels";
  try {
    const result = await chat(
      [
        {
          role: "system",
          content:
            "You write 12-second real-estate Reel narration. Return JSON {\"cues\":[{\"scene\":\"hook|homes|amenities|cta\",\"text\":\"...\"}]} " +
            "with exactly four cues in that order, each one spoken sentence of at most 14 words. " +
            `Language: ${language}. Audience: ${audience}. ${RULES} ` +
            "Say prices the way a narrator does, e.g. 'from 1.38 crore', and write '3 BHK' with a space.",
        },
        { role: "user", content: factSheet(brief) },
      ],
      { json: true, temperature: 0.6, maxTokens: 400, env: options.env, fetchImpl: options.fetchImpl },
    );
    const parsed = narrationSchema.safeParse(extractJson(result.text));
    if (!parsed.success) return { cues: template, source: "template", model: result.model, rejected: "Malformed narration JSON." };
    const joined = parsed.data.cues.map((c) => c.text).join(" ");
    const bad = factViolations(joined, brief);
    if (bad.length) return { cues: template, source: "template", model: result.model, rejected: `Invented figure: ${bad.join(", ")}` };
    const cues = template.map((t, i) => ({ ...t, text: parsed.data.cues[i]!.text.trim() }));
    return { cues, source: "ai", model: result.model };
  } catch (error) {
    return { cues: template, source: "template", rejected: error instanceof Error ? error.message : String(error) };
  }
}

// --- ad copy --------------------------------------------------------------------------

export interface AdCopy {
  hook: string;
  instagram: { caption: string; hashtags: string[] };
  google: { headlines: string[]; longHeadline: string; descriptions: string[] };
}

export interface AdCopyResult extends CopySource {
  copy: AdCopy;
}

/** Google responsive display ad limits. */
export const GOOGLE_LIMITS = { headline: 30, longHeadline: 90, description: 90 } as const;

const adCopySchema = z.object({
  hook: z.string().min(4).max(120),
  instagram: z.object({
    caption: z.string().min(20).max(2200),
    hashtags: z.array(z.string().min(2).max(40)).max(30),
  }),
  google: z.object({
    headlines: z.array(z.string().min(3)).min(3).max(8),
    longHeadline: z.string().min(10),
    descriptions: z.array(z.string().min(10)).min(2).max(6),
  }),
});

/** Deterministic copy from the brief; also the fallback when no model is set. */
export function templateAdCopy(brief: CreativeBrief): AdCopy {
  const homes = brief.unitTypes.length ? `${brief.unitTypes.join(" & ")} homes` : "Homes";
  const price = brief.priceFromLabel ? ` from ${brief.priceFromLabel}` : "";
  const tag = brief.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const city = brief.city.toLowerCase().replace(/[^a-z0-9]/g, "");
  return {
    hook: `${homes} in ${brief.location}${price}.`,
    instagram: {
      caption:
        `${brief.name} by ${brief.developer}. ${homes} in ${brief.location}${price}.` +
        (brief.amenities.length ? ` ${brief.amenities.slice(0, 3).join(", ")} and more.` : "") +
        ` DM us to book a site visit.` +
        (brief.registrationLabel ? ` ${brief.registrationLabel}.` : ""),
      hashtags: [`#${tag}`, `#${city}realestate`, `#${city}homes`, "#newlaunch", "#sitevisit"].slice(0, 5),
    },
    google: {
      headlines: [`${brief.name}, ${brief.city}`.slice(0, 30), `${homes}${price}`.slice(0, 30), "Book a site visit".slice(0, 30)],
      longHeadline: `${brief.name}: ${homes} in ${brief.location}${price}`.slice(0, 90),
      descriptions: [
        `${homes} by ${brief.developer} in ${brief.location}. Book a site visit today.`.slice(0, 90),
        (brief.amenities.length ? `${brief.amenities.slice(0, 3).join(", ")}. ` : "") + `Enquire now.`,
      ].map((d) => d.slice(0, 90)),
    },
  };
}

/** Trim to platform limits: drop items that overflow rather than cutting mid-word. */
function fitGoogle(copy: AdCopy): AdCopy {
  return {
    ...copy,
    google: {
      headlines: copy.google.headlines.filter((h) => h.length <= GOOGLE_LIMITS.headline),
      longHeadline: copy.google.longHeadline.slice(0, GOOGLE_LIMITS.longHeadline),
      descriptions: copy.google.descriptions.filter((d) => d.length <= GOOGLE_LIMITS.description),
    },
  };
}

export async function writeAdCopy(brief: CreativeBrief, options: NarrationOptions = {}): Promise<AdCopyResult> {
  const fallback = templateAdCopy(brief);
  if (!isLlmEnabled(options.env ?? process.env)) return { copy: fallback, source: "template" };

  try {
    const result = await chat(
      [
        {
          role: "system",
          content:
            "You write real-estate ad copy. Return JSON with this exact shape: " +
            '{"hook":"one line under 12 words","instagram":{"caption":"3-5 short sentences, no hashtags inside","hashtags":["#tag",...max 12]},' +
            `"google":{"headlines":["5 headlines, each at most ${GOOGLE_LIMITS.headline} characters"],"longHeadline":"at most ${GOOGLE_LIMITS.longHeadline} characters","descriptions":["3 descriptions, each at most ${GOOGLE_LIMITS.description} characters"]}}. ` +
            `Audience: ${options.audience ?? "home buyers in India"}. Language: ${options.language ?? "English"}. ${RULES} ` +
            "Open with the buyer's situation, not the project name. One call to action: book a site visit.",
        },
        { role: "user", content: factSheet(brief) },
      ],
      { json: true, temperature: 0.7, maxTokens: 900, env: options.env, fetchImpl: options.fetchImpl },
    );
    const parsed = adCopySchema.safeParse(extractJson(result.text));
    if (!parsed.success) return { copy: fallback, source: "template", model: result.model, rejected: "Malformed ad copy JSON." };
    const all = JSON.stringify(parsed.data);
    const bad = factViolations(all, brief);
    if (bad.length) return { copy: fallback, source: "template", model: result.model, rejected: `Invented figure: ${bad.join(", ")}` };
    const fitted = fitGoogle(parsed.data);
    if (fitted.google.headlines.length < 3 || fitted.google.descriptions.length < 2) {
      return { copy: fallback, source: "template", model: result.model, rejected: "Google copy exceeded character limits." };
    }
    return { copy: fitted, source: "ai", model: result.model };
  } catch (error) {
    return { copy: fallback, source: "template", rejected: error instanceof Error ? error.message : String(error) };
  }
}
