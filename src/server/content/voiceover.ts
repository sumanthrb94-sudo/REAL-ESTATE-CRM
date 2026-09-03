// Narration for the Reel, and the voice that reads it.
//
// The script is derived from the brief the same way the slides are, so it
// can never disagree with the price on screen. Synthesis is behind a driver:
// `log` (default) returns the script only, `elevenlabs` calls the REST API
// with one workspace-wide voice id so every project sounds like the same
// narrator, in whatever language the script is written.

import type { CreativeBrief } from "./brief";
import { spokenMoney } from "./market";

export interface NarrationCue {
  scene: "hook" | "homes" | "amenities" | "cta";
  /** Seconds into the Reel the line should begin. Matches the scene starts in reel.ts. */
  start: number;
  text: string;
}

/** Joins "A, B and C" the way a person says it. */
function spoken(list: string[]): string {
  if (list.length <= 1) return list.join("");
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

/** "3BHK" reads as one token to a speech model; "3 BHK" is said letter by letter. */
function spokenUnitType(type: string): string {
  return type.replace(/^(\d+)\s*([A-Za-z]+)$/, "$1 $2");
}

/** Four short lines, roughly 30 words, paced for a 12-second Reel. */
export function reelNarration(brief: CreativeBrief): NarrationCue[] {
  const hook = `${brief.name}, by ${brief.developer}, in ${brief.location}.`;
  const types = brief.unitTypes.length ? `${spoken(brief.unitTypes.map(spokenUnitType))} homes` : "Homes";
  const homes =
    brief.priceFrom !== undefined
      ? `${types} from ${spokenMoney(brief.priceFrom, brief.market)}.`
      : `${types}, with pricing on request.`;
  const amenities = brief.amenities.length
    ? `With ${spoken(brief.amenities.slice(0, 3))}.`
    : "Everything you need, close to home.";
  const cta = "Message us to book your site visit.";
  return [
    { scene: "hook", start: 0.3, text: hook },
    { scene: "homes", start: 3.5, text: homes },
    { scene: "amenities", start: 6.7, text: amenities },
    { scene: "cta", start: 9.6, text: cta },
  ];
}

/** One string for the synthesiser, with a beat between cues. */
export function narrationText(cues: NarrationCue[]): string {
  return cues.map((c) => c.text).join(' <break time="0.6s" /> ');
}

/**
 * Inline direction for Eleven v3.
 *
 * v3 reads bracketed tags as performance notes rather than speaking them, so a
 * scene can be directed — a hook delivered with warmth, a price stated plainly,
 * a call to action with lift. Tags are dropped automatically on any other
 * model, where they would be read aloud as literal words.
 */
export const SCENE_DIRECTION: Record<NarrationCue["scene"], string> = {
  hook: "[warmly]",
  homes: "[confidently]",
  amenities: "[warmly]",
  cta: "[excited]",
};

/** Strip every bracketed tag, for models that would speak them. */
export function stripAudioTags(text: string): string {
  return text.replace(/\[[a-z][a-z\s-]{0,30}\]/gi, "").replace(/\s{2,}/g, " ").trim();
}

/**
 * Apply per-scene direction to a script, or remove it, according to the model.
 * The cue text itself never carries tags, so the same script can be sent to a
 * local engine, to v2, or to v3 without being rewritten.
 */
export function directNarration(cues: NarrationCue[], modelId: string): NarrationCue[] {
  if (!isV3(modelId)) return cues.map((c) => ({ ...c, text: stripAudioTags(c.text) }));
  return cues.map((c) => ({ ...c, text: `${SCENE_DIRECTION[c.scene]} ${stripAudioTags(c.text)}`.trim() }));
}

export type VoiceDriver = "log" | "elevenlabs";

export interface VoiceConfig {
  driver: VoiceDriver;
  voiceId: string;
  modelId: string;
}

/**
 * George — warm, mature storyteller. A premade voice, so it works on the free
 * tier; library voices such as Matt (0aXOy31Cjamp6gJcyqYu) need Creator or
 * above and are set through ELEVENLABS_VOICE_ID.
 */
const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

/**
 * Eleven v3 is the expressive model: it reads inline audio tags such as
 * [warmly] or [excited], which is how a narrator is directed rather than
 * merely selected. It is not built for realtime — higher latency, more
 * variable take to take — but a Reel voiceover is rendered once and reused, so
 * that trade is entirely in our favour. Set ELEVENLABS_MODEL_ID to
 * eleven_multilingual_v2 to go back to the steadier, blander model.
 */
const DEFAULT_MODEL_ID = "eleven_v3";

/** Per-model input ceilings, from ElevenLabs' published limits. */
const CHARACTER_LIMITS: Record<string, number> = {
  eleven_v3: 5_000,
  eleven_v3_conversational: 5_000,
  eleven_multilingual_v2: 10_000,
  eleven_flash_v2_5: 40_000,
  eleven_flash_v2: 30_000,
};

/**
 * v3 accepts only three discrete stability settings — 0 Creative, 0.5 Natural,
 * 1 Robust — and rejects anything in between, where v2 took any float. Natural
 * is the right default for a brand read: expressive, but it will not reinvent
 * the delivery on every take.
 */
const V3_STABILITY = { creative: 0, natural: 0.5, robust: 1 } as const;

export function isV3(modelId: string): boolean {
  return modelId.startsWith("eleven_v3");
}

/** Loosened from NodeJS.ProcessEnv so tests can pass a plain object. */
export type EnvLike = Record<string, string | undefined>;

export function voiceConfig(env: EnvLike = process.env): VoiceConfig {
  const driver = env.VOICE_DRIVER === "elevenlabs" && env.ELEVENLABS_API_KEY ? "elevenlabs" : "log";
  return {
    driver,
    voiceId: env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID,
    modelId: env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID,
  };
}

export function isVoiceoverEnabled(env: EnvLike = process.env): boolean {
  return voiceConfig(env).driver === "elevenlabs";
}

export interface SynthesisResult {
  audio: ArrayBuffer;
  contentType: string;
}

/**
 * Text to speech through ElevenLabs. Throws when the driver is `log`; the
 * caller decides whether that is a 503 or a silent render.
 */
export async function synthesizeNarration(
  text: string,
  options: { fetchImpl?: typeof fetch; env?: EnvLike } = {},
): Promise<SynthesisResult> {
  const env = options.env ?? process.env;
  const config = voiceConfig(env);
  if (config.driver !== "elevenlabs") {
    throw new Error("Voiceover is not configured: set VOICE_DRIVER=elevenlabs and ELEVENLABS_API_KEY.");
  }
  const limit = CHARACTER_LIMITS[config.modelId] ?? 5_000;
  if (text.length > limit) {
    throw new Error(
      `That script is ${text.length} characters; ${config.modelId} accepts ${limit}. Split it into scenes and synthesise each one.`,
    );
  }

  const doFetch = options.fetchImpl ?? fetch;
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config.voiceId)}?output_format=mp3_44100_128`;
  const response = await doFetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": env.ELEVENLABS_API_KEY as string,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: config.modelId,
      // v3 rejects a stability it does not recognise, so the two models get
      // the settings each actually accepts rather than one shared guess.
      voice_settings: isV3(config.modelId)
        ? { stability: V3_STABILITY.natural, similarity_boost: 0.75, use_speaker_boost: true }
        : { stability: 0.5, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true },
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`ElevenLabs returned ${response.status}: ${detail.slice(0, 200)}`);
  }
  return { audio: await response.arrayBuffer(), contentType: "audio/mpeg" };
}
