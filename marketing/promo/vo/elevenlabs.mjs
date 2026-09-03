// Promo narration through ElevenLabs, one file per cue.
//
//   ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=<id> node vo/elevenlabs.mjs
//
// Writes the same wav-per-cue plus timings.json that vo/voice.py produces, so
// build.mjs cannot tell which engine made them and the scene timing follows the
// new read automatically. Eleven v3 is the default model: it reads the inline
// direction tags below instead of speaking them.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const KEY = process.env.ELEVENLABS_API_KEY;
const VOICE = process.env.ELEVENLABS_VOICE_ID;
const MODEL = process.env.ELEVENLABS_MODEL_ID ?? "eleven_v3";

if (!KEY) throw new Error("Set ELEVENLABS_API_KEY.");
if (!VOICE) {
  throw new Error(
    "Set ELEVENLABS_VOICE_ID. A Voice Library voice (Bunty, say) has to be added " +
      "to your workspace in the ElevenLabs web app first — the library is not " +
      "reachable from the API. Once added, its id appears under Voices.",
  );
}

const isV3 = MODEL.startsWith("eleven_v3");
/** Per-scene performance direction. v3 reads these; other models would say them. */
const DIRECTION = {
  hook: "[warmly]",
  dashboard: "[confidently]",
  leads: "[confidently]",
  pipeline: "[warmly]",
  inventory: "[confidently]",
  cta: "[excited]",
};

const cues = JSON.parse(fs.readFileSync(path.join(here, "cues.json"), "utf8"));
const out = [];

for (const cue of cues) {
  const text = isV3 ? `${DIRECTION[cue.id] ?? ""} ${cue.text}`.trim() : cue.text;

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(VOICE)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: MODEL,
        // v3 accepts only 0, 0.5 or 1 for stability and rejects anything else.
        voice_settings: isV3
          ? { stability: 0.5, similarity_boost: 0.75, use_speaker_boost: true }
          : { stability: 0.5, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`${cue.id}: ElevenLabs returned ${res.status} — ${(await res.text()).slice(0, 300)}`);
  }

  const mp3 = path.join(here, `${cue.id}.mp3`);
  const wav = path.join(here, `${cue.id}.wav`);
  fs.writeFileSync(mp3, Buffer.from(await res.arrayBuffer()));

  // Trim the silence at both ends, exactly as the local engine's output is
  // trimmed, so a cue's duration is speech and nothing else.
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", mp3, "-af",
    "silenceremove=start_periods=1:start_threshold=-45dB,areverse," +
    "silenceremove=start_periods=1:start_threshold=-45dB,areverse,apad=pad_dur=0.15",
    "-ar", "48000", wav]);
  fs.unlinkSync(mp3);

  const duration = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries",
    "format=duration", "-of", "csv=p=0", wav]).toString().trim());
  out.push({ ...cue, file: `${cue.id}.wav`, duration: Math.round(duration * 1000) / 1000 });
  console.log(`${cue.id.padEnd(10)} ${duration.toFixed(2)}s`);
}

fs.writeFileSync(path.join(here, "timings.json"),
  JSON.stringify({ voice: `elevenlabs:${VOICE}`, model: MODEL, cues: out }, null, 2));
console.log(`\n${out.length} cues, ${out.reduce((n, c) => n + c.duration, 0).toFixed(1)}s of speech.`);
console.log("Copy the wavs to project/assets/vo/ and timings.json beside build.mjs, then rebuild.");
