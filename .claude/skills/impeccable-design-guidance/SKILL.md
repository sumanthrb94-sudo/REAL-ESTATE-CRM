---
name: impeccable-design-guidance
description: Improve AI-generated frontend design through structured design context, visual critique, accessibility and responsive checks, and targeted refinement commands. Use when creating, reviewing, redesigning, or polishing websites and app interfaces with Claude Code, Codex, Cursor, or another AI coding assistant.
---

# Impeccable Design Guidance

Use this skill to make AI-generated interfaces feel intentional, distinctive, usable, and production-ready rather than template-like.

## Core workflow

Follow this sequence when designing or improving an interface:

1. **Understand the product.** Identify the audience, user goal, surface type, brand personality, content hierarchy, technical constraints, and primary conversion or task outcome.
2. **Define design context.** Record the product lane, visual direction, typography, color roles, spacing rhythm, component rules, voice, anti-references, and examples of what the design must avoid. Store durable decisions in `PRODUCT.md` and `DESIGN.md` when working in a project repository.
3. **Shape before coding.** Plan the information architecture, interaction model, page hierarchy, responsive behavior, states, and content before implementing visual details.
4. **Build with a coherent system.** Use a small, intentional set of type sizes, spacing values, radii, colors, shadows, and component variants. Prefer semantic tokens over one-off styling.
5. **Review visually in the browser.** Inspect the result at mobile, tablet, and desktop widths. Compare hierarchy, density, alignment, interaction clarity, contrast, and visual rhythm against the intended design context.
6. **Refine in focused passes.** Apply the smallest relevant refinement pass—layout, typesetting, color, motion, copy, accessibility, responsive behavior, performance, or edge-case hardening—then recheck the whole page.
7. **Ship only after quality checks.** Confirm keyboard access, focus visibility, readable contrast, responsive layouts, loading and error states, text overflow, reduced-motion behavior, and consistent interaction feedback.

## Command vocabulary

When an AI coding tool supports slash commands, use the following command pattern:

```text
/impeccable <command> <target>
```

Use these commands according to the task:

| Command | Use it for |
|---|---|
| `init` | Establish product and design context for a project. |
| `craft` | Plan and build a complete surface with visual iteration. |
| `shape` | Define UX, hierarchy, and interaction structure before coding. |
| `document` | Derive a design system document from an existing interface. |
| `extract` | Identify reusable components and design tokens. |
| `critique` | Review hierarchy, clarity, usability, and emotional resonance. |
| `audit` | Check accessibility, responsiveness, performance, and technical quality. |
| `polish` | Perform a final design-system and shipping-readiness pass. |
| `layout` | Correct spacing, alignment, hierarchy, and visual rhythm. |
| `typeset` | Improve font choices, scale, line length, hierarchy, and readability. |
| `colorize` | Introduce or rebalance purposeful color roles. |
| `clarify` | Improve unclear interface copy and labels. |
| `animate` | Add purposeful motion with restrained timing and reduced-motion support. |
| `adapt` | Improve behavior across device sizes and input modes. |
| `harden` | Handle errors, loading, empty, overflow, internationalization, and edge states. |
| `optimize` | Improve frontend performance without damaging the experience. |
| `bolder` | Increase visual distinction when the design is too generic or quiet. |
| `quieter` | Reduce visual noise when the design is too loud. |
| `distill` | Remove unnecessary decoration and complexity. |
| `onboard` | Improve first-run, empty-state, and activation flows. |
| `delight` | Add small, appropriate moments of personality or feedback. |
| `overdrive` | Add technically ambitious visual effects only when they serve the product. |
| `live` | Iterate through visual variants directly in the browser. |

If the environment does not support slash commands, translate the same vocabulary into explicit instructions and execute the appropriate design pass manually.

## Rules to prevent generic AI design

Avoid defaulting to the same patterns across every project. Do not use Inter, Arial, or system fonts automatically; choose typography that fits the product. Do not rely on purple-to-blue gradients, gray text on saturated backgrounds, pure black and gray without a reason, excessive rounded cards, nested cards, decorative icon tiles above every heading, or arbitrary animations. Use visual variety only when it supports hierarchy and brand identity.

Prefer one strong visual idea over many competing effects. Establish a clear focal point above the fold, make primary actions unmistakable, and give supporting content an intentional order. Use cards only when grouping or interaction requires them. Use borders, shadows, and radii as a coordinated system rather than independently on every element.

## Review checklist

Before considering a surface complete, verify the following:

- The page communicates its purpose and primary action immediately.
- Typography has a deliberate family, scale, weight, line-height, and measure.
- Color has semantic roles and sufficient contrast in every state.
- Layout has a consistent spacing rhythm and does not feel over-cardified.
- Components share tokens and predictable interaction patterns.
- Mobile layouts are designed rather than merely compressed.
- Hover, focus, active, disabled, loading, empty, error, and success states exist where relevant.
- Keyboard navigation, focus visibility, labels, landmarks, and reduced motion are handled.
- Long text, localization, narrow screens, zoom, and dynamic content do not break the layout.
- Images, icons, and animation reinforce meaning instead of adding noise.
- A final browser review has been completed at representative viewport sizes.

## Recommended usage with Claude Code

For a new project, install the upstream Impeccable package when network access and project policy permit:

```shell
npx impeccable install
```

Then initialize the project context and work in focused passes:

```text
/impeccable init
/impeccable shape the landing page
/impeccable craft the homepage
/impeccable critique the homepage
/impeccable audit the homepage
/impeccable polish the homepage
```

Treat the upstream repository as the implementation reference and this skill as the operating guidance. Do not claim that the skill itself installs or runs the upstream package unless the package has actually been added to the project.

## References

- Upstream repository: https://github.com/pbakaus/impeccable
- Official documentation: https://impeccable.style/

## Instagram Reels sound-effects workflow

Use sound effects as part of the story structure, not as decoration. First identify the visual beat, then choose the smallest sound that makes that beat easier to feel or understand. Keep the voice, dialogue, and key message dominant; most effects should sit underneath them rather than compete with them.

### How to find current trends

Treat “trending” as a live platform signal, not a permanent list. On Instagram’s mobile app, open Reels and look for the upward-trending indicator beside an audio track, or open the Professional Dashboard and select **Trending audio**. Save the audio page and confirm that the track is still trending immediately before publishing. Availability can vary by country, account type, and commercial-use restrictions. [1]

For a reusable editing workflow, maintain a small local index with the date checked, audio title, creator, audio-page URL, intended use, rights status, and whether it is suitable for a business account. Do not present a sound as “currently trending” without checking Instagram in the current session.

### SFX trend families to search for

These are durable search categories commonly surfaced in current short-form editing recommendations. They are **search terms and use cases**, not a guarantee that a particular recording is trending today.

| Search family | Best use | Typical placement |
|---|---|---|
| `whoosh`, `swish`, `dry whoosh` | Smooth transitions, camera movement, text entry | 2–6 frames before or during the movement |
| `pop`, `bubble pop`, `pluck` | Text reveals, icon appearances, small punchlines | Exactly on the reveal frame |
| `riser`, `build up`, `flash charge` | Anticipation before a reveal, cut, or beat drop | Build over 0.5–2 seconds into the event |
| `hit`, `impact`, `boom`, `bass drop` | Strong emphasis, title cards, dramatic cuts | On the cut or first frame of the emphasis |
| `notification`, `message`, `alert` | Curiosity hooks, screen recordings, comment or DM references | Immediately before the visual proof |
| `mouse click`, `keyboard`, `tap`, `camera shutter` | Tutorials, UI demonstrations, photo or screenshot moments | Sync tightly to the visible action |
| `magic`, `sparkle`, `shine`, `bell` | Transformation, reveal, beauty, product, or “before/after” moments | On the reveal, kept quiet and short |
| `downer`, `reverse`, `glitch`, `record scratch` | Comedic failure, correction, interruption, or reversal | At the mistake or sudden change |
| `heartbeat`, `breath`, `tension` | Suspense, confession, countdown, or emotional pause | Under the pause; fade before speech resumes |
| `meme reaction`, `vine boom`, `dramatic bell` | Comedic emphasis and reaction edits | Use sparingly and only when the joke is clear |

Use one primary effect per beat. Layer a second effect only when it serves a different function, such as a quiet whoosh for motion plus a short pop for the text landing. Avoid stacking multiple impacts, risers, and meme sounds on every cut; repetition quickly makes a video feel noisy and dated.

### Timing and mixing rules

- Place the strongest transient on the exact frame where the viewer should notice a change.
- Trim silence and long tails unless the tail is intentionally creating atmosphere.
- Duck music by approximately 3–6 dB around speech and by approximately 1–3 dB around important effects; adjust by ear rather than applying fixed numbers blindly.
- Keep dialogue intelligible and preserve headroom. Avoid clipping on combined voice, music, and impact layers.
- Use short fades on edits to prevent clicks, and use longer fades for ambience, risers, and downers.
- Pan or widen effects only when the visual movement supports it; do not use stereo motion as a substitute for good timing.
- Preview on phone speakers, headphones, and a quiet room. If the effect is the first thing noticed instead of the message, reduce it.

### Rights and publishing safety

Do not download or redistribute copyrighted Instagram audio inside this skill pack. Use audio through Instagram’s licensed library when the account and post are eligible, or use original recordings and properly licensed SFX files. Meta states that licensed audio includes copyrighted sound effects and may later be muted if rights agreements change. [2] Meta also provides Sound Collection, described as royalty-free and safe for Reels and Stories, including commercial use; verify the current license terms for each asset before publishing ads or client work. [3]

For a business or client account, prefer original audio, Meta Sound Collection, or a reputable library with a documented commercial license. Keep a simple asset log containing the source URL, license, download date, attribution requirement, and project filename. Never assume that an audio file labeled “viral,” “free,” or “no copyright” is commercially safe.

### Reusable edit brief

When asked to add trending SFX to a video, produce an edit brief in this format:

```text
Platform: Instagram Reels
Checked: YYYY-MM-DD
Video goal: [hook / tutorial / product / comedy / story]
Primary audio: [voice / licensed trend / original audio]
SFX beats:
- 00:00.00 — [effect search term] — [visual event] — [mix note]
- 00:00.00 — [effect search term] — [visual event] — [mix note]
- 00:00.00 — [effect search term] — [visual event] — [mix note]
Rights path: [Instagram licensed library / Meta Sound Collection / original / licensed library]
Export check: [voice clear, no clipping, phone-speaker test, captions aligned]
```

### References for SFX guidance

- [1] [Instagram Help Center: Find and use trending audio](https://help.instagram.com/637936641677566/)
- [2] [Instagram Help Center: What audio can you use in your video on Edits](https://help.instagram.com/1718255785758961/)
- [3] [Instagram Help Center: Access to the licensed music library and Sound Collection](https://help.instagram.com/402084904469945/)
- Upstream design guidance: [pbakaus/impeccable](https://github.com/pbakaus/impeccable)
- Official design documentation: [impeccable.style](https://impeccable.style/)
