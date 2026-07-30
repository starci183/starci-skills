---
name: inset
description: Decision sheet for the inset axis — which value to pick for the padding inside a frame/surface.
scope: `padding` of the frame. Atoms are EXEMPT — an atom handles its own internal geometry.
---

# INSET

## Scale — five steps, there is no sixth step

| Step | Class | px | Used for |
|---|---|---:|---|
| `flush` | `p-0` | 0 | content that **touches the edge**: a cover image bleeding to the edge, a horizontally-scrolling table |
| `snug` | `p-2` | 8 | compact chrome: a collapsed sidebar item, a small icon button, a single chip |
| `cozy` | `p-3` | 12 | the **inside of a card** surface — house rule |
| `roomy` | `p-6` | 24 | page-measuring width or a container |
| `airy` | `p-8` | 32 | a hero or empty-state that wants to "breathe" |

SSOT: `InsetScale`.

## Decision tree — stop at the first YES

| # | Ask | Result |
|---|---|---|
| 1 | Does the content draw its own edge and need to touch the border exactly? | `flush` |
| 2 | The inside of a card/tile that already has a visible border? | `cozy` |
| 3 | A reading width / a frame that measures **many** other children? | `roomy` |
| 4 | An area deliberately emphasizing space — hero, empty-state, a lock screen? | `airy` |

**Two steps at two tiers, not one choice for the whole screen:** `Container padding="roomy"` wraps several `SurfaceCard padding="cozy"`.

If there's a real `src`, **measure the source**. The tree is only a fallback.

## Three adjacent pairs

| Pair | The deciding test |
|---|---|
| `flush` ↔ `cozy` | content draws its own background/border to the edge (image, media, table) ⇒ `flush` — padding would cut into the image itself. Text/controls need breathing room ⇒ `cozy` |
| `cozy` ↔ `roomy` | the surface of **exactly one** card ⇒ `cozy` · a frame measuring several child things ⇒ `roomy` |
| `roomy` ↔ `airy` | ordinary ⇒ `roomy` · deliberately emphasizing empty space/elegance ⇒ `airy` |

Two valid kinds of off-scale value exist: **vendor geometry** (pill, inline `<code>`, popover body) and **visual nudges** (`pt-1` to align text with a dot). Declare with `// inset-exception: <reason>`.

Reasoning and history: [rationale](../../references/axis-notes/inset/rationale.md)
Rules no machine catches: [judgement](../judgement.md)
