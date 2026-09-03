# Subtitles for short-form video

Most of the feed watches muted. Subtitles are not an accessibility afterthought
on a Reel — they are how the script is delivered at all, so they get the same
care as the voiceover.

## What is generated

For every line of narration, `src/server/content/subtitles.ts` produces
**word-timed chunks**: two to four words at a time, each word carrying its own
start and end. The composition renders every chunk up front and reveals each on
its own window, because HyperFrames requires a frame to be a pure function of
time — nothing may be created or destroyed while the timeline runs.

A 34-second promo produces about 21 chunks.

## Why chunks and not sentences

A whole sentence held for a whole scene is the amateur tell. It asks the viewer
to read ahead of the voice, and at the size a sentence has to shrink to in
order to fit, nobody does. Two to four words at a time holds the eye at a
glance, and is what every short-form editor converged on independently.

The current word is picked out in the accent colour. **Colour only** — moving or
scaling the active word reflows the line and makes the whole chunk jitter, which
is the single most common way this effect is done badly.

## Where the word timings come from

A local speech engine returns one duration per line, not per word. Rather than
add a forced aligner, the line's duration is shared out by how long each word
takes to say: syllables, counted as vowel groups less a silent trailing "e",
plus the beat that punctuation buys — about 1.6 syllable-equivalents after a
full stop, 0.9 after a comma.

It is an estimate, but a deterministic one, so a rebuild renders identical
frames. Two properties keep it honest:

- The last word of a line is **pinned** to the line's end rather than
  accumulated into it, so floating-point drift can never push a subtitle past
  the audio that produced it.
- Chunks are short. At two to four words, an error inside a chunk is smaller
  than the chunk itself and never accumulates across the video.

If you later narrate through a service that returns character timestamps —
ElevenLabs' `/with-timestamps` endpoint does — swap the estimate for the real
timings and nothing downstream changes.

## Positioning

On a 1080×1920 Reel, Instagram paints its own chrome over your frame: a header
across the top, and a deep band along the bottom holding the caption, handle,
audio strip and Send row, with the action rail down the right.

| Zone | Reserved | Why |
|---|---|---|
| Top | 260px | Reels header |
| Bottom | 430px | Caption, handle, audio, Send row |
| Right | 200px | Like / comment / share rail |
| Sides | 60px | Rounded corners and edge crop |

Meta's published guidance asks for 254px at the top and 388px at the bottom;
those are rounded outward here, because the chrome grows when a caption wraps to
a second line.

Subtitles sit **40px above the bottom boundary**, centred, growing upward. Not
flush against it: a two-line chunk grows from its baseline, and a subtitle
touching the chrome reads as an accident.

Build with `SAFE_ZONES=1` to draw the boundaries over the render and check by
eye rather than by arithmetic.

## Legibility

62px, weight 700, on a dark plate at 82% opacity with a soft shadow.

The plate is a backing box rather than a text shadow, and it wraps the whole
chunk rather than each word — wrapping each word chops the plate into blocks as
the highlight moves. This is not decoration: the subtitles pass over a white
laptop screen mid-video, where white-on-white measured **1.5:1**. With the plate
the composition passes 31 of 31 WCAG AA contrast checks.

## Verifying

```bash
npx hyperframes check                 # contrast, layout, determinism
SAFE_ZONES=1 node build.mjs           # draw the chrome boundaries
npx hyperframes snapshot --at 12.0    # eyeball a frame mid-speech
```
