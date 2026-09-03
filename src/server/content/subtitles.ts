// Subtitles for short-form video: word-timed, chunked, and positioned to
// survive the platform's own chrome.
//
// A whole sentence held for a whole scene is the amateur tell. What reads on a
// phone is two to four words at a time, arriving as they are spoken, with the
// current word picked out — the style every short-form editor converged on
// because it holds the eye without asking anyone to read ahead.
//
// Doing that needs per-word timing, and a local speech engine gives only a
// duration per line. Rather than add a forced-aligner, the duration is shared
// out across the words by how long each one takes to say: syllables, plus the
// pause that punctuation buys. It is an estimate, but a deterministic one, and
// at two-to-four words a chunk the error never accumulates far enough to
// desync — each chunk is re-anchored to the line's own start and end.

export interface SubtitleWord {
  text: string;
  start: number;
  end: number;
}

export interface SubtitleChunk {
  /** Words in this chunk, each with its own window for the karaoke highlight. */
  words: SubtitleWord[];
  start: number;
  end: number;
  text: string;
}

export interface ChunkOptions {
  /** Most words shown at once. Beyond four the eye starts reading, not glancing. */
  maxWords?: number;
  /** Most characters shown at once, so a long word never overflows the safe box. */
  maxChars?: number;
}

const DEFAULTS: Required<ChunkOptions> = { maxWords: 4, maxChars: 26 };

/**
 * Rough syllable count. English orthography does not make this exact, and it
 * does not need to be: it is used only to share one line's duration between
 * its words, so a consistent bias cancels out.
 */
export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 1;
  // Vowel groups, minus a silent trailing "e", never below one.
  const groups = w.match(/[aeiouy]+/g)?.length ?? 1;
  const silentE = /[^aeiouy]e$/.test(w) && groups > 1 ? 1 : 0;
  return Math.max(1, groups - silentE);
}

/** The beat a mark buys after the word it follows, in syllable-equivalents. */
function punctuationPause(word: string): number {
  if (/[.!?]$/.test(word)) return 1.6;
  if (/[,;:—–]$/.test(word)) return 0.9;
  return 0;
}

/**
 * Share `duration` across the words of `text`, starting at `start`.
 *
 * Every word gets a slice proportional to how long it takes to say, and the
 * last word ends exactly on start + duration, so subtitles can never drift past
 * the audio that produced them.
 */
export function estimateWordTimings(text: string, start: number, duration: number): SubtitleWord[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || duration <= 0) return [];

  const weights = words.map((w) => syllables(w) + punctuationPause(w));
  const total = weights.reduce((a, b) => a + b, 0);

  const out: SubtitleWord[] = [];
  let cursor = start;
  words.forEach((word, i) => {
    const slice = (weights[i]! / total) * duration;
    // The final word is pinned to the end rather than accumulated into it, so
    // floating-point drift cannot push it past the line.
    const end = i === words.length - 1 ? start + duration : cursor + slice;
    out.push({ text: word, start: cursor, end });
    cursor = end;
  });
  return out;
}

/**
 * Group words into what appears on screen at one time.
 *
 * Breaks are taken at sentence punctuation first, because a chunk that spans a
 * full stop reads as one thought when it is two.
 */
export function chunkWords(words: SubtitleWord[], options: ChunkOptions = {}): SubtitleChunk[] {
  const { maxWords, maxChars } = { ...DEFAULTS, ...options };
  const chunks: SubtitleChunk[] = [];
  let current: SubtitleWord[] = [];

  const flush = () => {
    if (current.length === 0) return;
    chunks.push({
      words: current,
      start: current[0]!.start,
      end: current[current.length - 1]!.end,
      text: current.map((w) => w.text).join(" "),
    });
    current = [];
  };

  for (const word of words) {
    const wouldBe = [...current, word];
    const chars = wouldBe.map((w) => w.text).join(" ").length;
    if (current.length > 0 && (wouldBe.length > maxWords || chars > maxChars)) flush();
    current.push(word);
    // A sentence ends: close the chunk here rather than running two together.
    if (/[.!?]$/.test(word.text)) flush();
  }
  flush();
  return chunks;
}

/** One line of narration, timed and split into what appears on screen. */
export function planSubtitles(
  text: string,
  start: number,
  duration: number,
  options: ChunkOptions = {},
): SubtitleChunk[] {
  return chunkWords(estimateWordTimings(text, start, duration), options);
}

// ─── Placement ──────────────────────────────────────────────────────────────

export interface SafeArea {
  top: number;
  bottom: number;
  side: number;
}

/**
 * Where the subtitle band sits on a 1080×1920 frame.
 *
 * Not flush against the bottom of the safe area: a two-line chunk grows upward
 * from its baseline, and a subtitle that touches the chrome reads as an
 * accident. Sitting it a little above the boundary also keeps it clear of the
 * caption bar when a viewer expands it.
 */
export function subtitleBand(height: number, safe: SafeArea): { bottom: number; maxWidth: number } {
  return {
    bottom: safe.bottom + Math.round(height * 0.02),
    maxWidth: 100 - (safe.side / 10.8) * 2,
  };
}
