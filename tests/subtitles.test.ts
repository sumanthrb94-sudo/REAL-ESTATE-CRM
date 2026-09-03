// Subtitles: word timing estimated from a line's duration, chunked into what
// a phone can read at a glance, and kept clear of the platform's chrome.

import { describe, expect, it } from "vitest";
import {
  chunkWords,
  estimateWordTimings,
  planSubtitles,
  subtitleBand,
  syllables,
} from "@/server/content/subtitles";

describe("syllables", () => {
  it("counts vowel groups and drops a silent trailing e", () => {
    expect(syllables("site")).toBe(1);
    expect(syllables("visit")).toBe(2);
    expect(syllables("booking")).toBe(2);
    expect(syllables("Hyderabad")).toBe(4);
    expect(syllables("EstateCRM")).toBeGreaterThanOrEqual(3);
  });

  it("never returns zero, whatever it is handed", () => {
    expect(syllables("₹1.38")).toBe(1);
    expect(syllables("—")).toBe(1);
    expect(syllables("")).toBe(1);
  });
});

describe("estimateWordTimings", () => {
  const text = "EstateCRM puts every lead on one screen.";

  it("covers the line exactly, with no gap and no overrun", () => {
    const words = estimateWordTimings(text, 2, 4);
    expect(words[0]?.start).toBe(2);
    // Pinned to the end rather than accumulated into it, so drift cannot
    // push the last word past the audio it belongs to.
    expect(words[words.length - 1]?.end).toBe(6);
  });

  it("hands out time in order, with no overlap between words", () => {
    const words = estimateWordTimings(text, 0, 5);
    for (let i = 1; i < words.length; i++) {
      expect(words[i]!.start).toBeCloseTo(words[i - 1]!.end, 6);
      expect(words[i]!.end).toBeGreaterThan(words[i]!.start);
    }
  });

  it("gives a longer word more time than a short one", () => {
    const [on, hyderabad] = estimateWordTimings("on Hyderabad", 0, 3);
    expect(hyderabad!.end - hyderabad!.start).toBeGreaterThan(on!.end - on!.start);
  });

  it("buys a beat after punctuation", () => {
    // "lead," and "lead" are the same word; the comma should earn extra time.
    const withComma = estimateWordTimings("lead, screen", 0, 2)[0]!;
    const without = estimateWordTimings("lead screen", 0, 2)[0]!;
    expect(withComma.end - withComma.start).toBeGreaterThan(without.end - without.start);
  });

  it("returns nothing for empty text or a zero-length line", () => {
    expect(estimateWordTimings("", 0, 3)).toEqual([]);
    expect(estimateWordTimings("hello", 0, 0)).toEqual([]);
  });
});

describe("chunkWords", () => {
  const words = (text: string) => estimateWordTimings(text, 0, 10);

  it("shows a glanceable number of words at a time", () => {
    const chunks = chunkWords(words("Leads from your website portals and ads land here in seconds"));
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.words.length).toBeLessThanOrEqual(4);
      expect(c.text.length).toBeLessThanOrEqual(26);
    }
  });

  it("breaks at a full stop rather than running two thoughts together", () => {
    const chunks = chunkWords(words("Book now. Visit today"));
    expect(chunks[0]?.text).toBe("Book now.");
  });

  it("keeps every word, in order, exactly once", () => {
    const source = "EstateCRM puts every lead site visit and booking on one screen";
    const chunks = chunkWords(words(source));
    expect(chunks.flatMap((c) => c.words.map((w) => w.text)).join(" ")).toBe(source);
  });

  it("spans its words' window", () => {
    for (const c of chunkWords(words("Leads from your website portals and ads land here"))) {
      expect(c.start).toBe(c.words[0]!.start);
      expect(c.end).toBe(c.words[c.words.length - 1]!.end);
    }
  });

  it("never leaves a hole in the line", () => {
    const chunks = chunkWords(words("Leads from your website portals and ads land here"));
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i]!.start).toBeCloseTo(chunks[i - 1]!.end, 6);
    }
  });

  it("does not drop a word longer than the character budget", () => {
    const chunks = chunkWords(estimateWordTimings("Antidisestablishmentarianism now", 0, 4));
    expect(chunks.flatMap((c) => c.words).length).toBe(2);
  });
});

describe("planSubtitles", () => {
  it("stays inside the line it was given", () => {
    const chunks = planSubtitles("EstateCRM puts every lead and booking on one screen.", 5, 4.9);
    expect(chunks[0]!.start).toBe(5);
    expect(chunks[chunks.length - 1]!.end).toBeCloseTo(9.9, 6);
  });

  it("is deterministic, so a rebuild renders the same frames", () => {
    const line = "Your team works the pipeline from any phone.";
    expect(planSubtitles(line, 0, 4)).toEqual(planSubtitles(line, 0, 4));
  });
});

describe("subtitleBand", () => {
  it("sits above the chrome rather than against it", () => {
    const safe = { top: 260, bottom: 430, side: 60 };
    const band = subtitleBand(1920, safe);
    expect(band.bottom).toBeGreaterThan(safe.bottom);
    // Still well inside the frame, not floating in the middle of it.
    expect(band.bottom).toBeLessThan(1920 / 2);
  });
});
