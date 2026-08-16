---
id: fe-principles-ratio-index
title: INDEX.md
slug: /fe/principles/ratio
sidebar_label: ratio
sidebar_position: 0
description: Binding rules for declaring the shape a media box holds, and for settling the disagreement between that shape and the source.
template: principles-v2
---

# INDEX.md

Version: `2.00` · Module: `ratio`

## Law

A media box states the shape it will hold **before the bytes arrive**. The shape is chosen from what
the layout owes the reader, and the disagreement between that shape and the file's own shape is
settled in the same breath — never later, never by whichever happens to load first.

The frame owns the shape. A frame that declares a ratio also declares a fit, because a declared
shape without a declared fit has only decided half of what the reader will see.

**This is binding, not advisory.** Anything that reserves space for an image, a video, an embed, a
canvas or a chart has a ratio situation, and that situation has a code below. There is no size at
which a box is too small to have one: a 24px avatar is `RATIO-1` for exactly the same reason a
full-bleed hero is `RATIO-2`. "It is only a tiny thumbnail" is not an exemption — it is the most
common place the rule gets skipped, and the place the reflow is least likely to be blamed on the
right cause.

A ratio that is not declared is a layout that jumps when the image loads. The jump is not a
rendering artefact; it is the box admitting, at load time, that nobody decided.

## Situation Codes

Every situation this module governs carries a code, `RATIO-<index>`. The code names the SITUATION;
the className column names what that situation emits. They are not the same thing, and one of them
emits nothing.

The emission is a **pair** — a frame and a fit. Neither half alone is a decision, and it is the pair,
not the frame class, that is unique to a code.

| Code | Situation | className |
|---|---|---|
| `RATIO-0` | The source has already declared its own dimensions; the box imposes nothing | *no aspect class, no fit class* |
| `RATIO-1` | The layout requires one square, and squares must agree with each other | `aspect-square` + `object-cover` |
| `RATIO-2` | The box holds moving or cinematic content, or a thumbnail that stands for it | `aspect-video` + `object-cover` |
| `RATIO-3` | The box holds a still photograph or capture whose subject needs vertical room | `aspect-[4/3]` + `object-cover` |
| `RATIO-4` | The product names a ratio of its own, as a constant or computed per record | `aspect-[<w>/<h>]` + `object-cover` |
| `RATIO-5` | The source's own shape is the content, and cropping it would remove information | a bounded frame + `object-contain` |

`RATIO-0` IS A SITUATION, NOT A DEFAULT. It is legal only where the box **cannot** jump: the
element's intrinsic dimensions are declared in the markup, or the thing is not late-arriving media at
all. Where the dimensions are unknown at render time, `RATIO-0` is not available and one of
`RATIO-1`…`RATIO-5` must be chosen. Omitting a ratio because none was obvious is not `RATIO-0`; it is
the absence of a decision, and the code exists precisely so that absence can be cited and corrected.
A situation with no name is a situation nobody can be shown to have got wrong.

**Cropping is licensed by codes `RATIO-1`…`RATIO-4` and by nothing else.** Those four codes exist
because the layout owns the shape, and owning the shape is what makes it legitimate to discard the
parts of the source that do not fit. `RATIO-5` is the case where that licence is withdrawn: the shape
belongs to the source, so the frame bounds it and lets it letterbox, or refuses to frame it until the
dimensions are known. There is no fifth reconciliation.

## Inputs

| Input | Evidence required |
|---|---|
| frame | The element that reserves layout space before paint |
| source | Whether intrinsic dimensions are declared, carried by data, or unknown |
| meaning of shape | Whether the source's own shape is content or merely its packaging |
| loss | What a crop would remove, and whether the reader came for it |
| neighbours | Whether sibling boxes must agree in shape to read as one set |

## Invariants

- One box, one shape owner. The frame declares the ratio; the media fills the frame.
- A declared ratio and a fixed height on the same box are two claims for one fact; one wins silently.
- Every declared frame states its fit. A frame without a fit is half a decision.
- A crop states its anchor. A centred crop is a choice, not the absence of one.
- A frame that crops also clips.
- Placeholder, skeleton, error and loaded states share one frame. The proof of a declared ratio is
  that nothing moves between them.
- A situation code maps to exactly one frame-and-fit pair, and no pair serves two codes.
- Every rendered media box resolves to exactly one code. No box is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **Art direction.** A ratio may change across viewports when the layout role genuinely changes — a
  square in a mobile feed, cinematic across a desktop banner. Both ratios must be declared codes, the
  fit may not change with them, and the reason must be a stated layout fact rather than a preference.
- **Intrinsic vector.** An inline vector with a `viewBox` already carries its ratio. It is `RATIO-0`,
  and adding an aspect class to it is a second claim.
- **Data-carried dimensions.** When the record supplies width and height, `RATIO-4` is computed per
  record. When the record omits them, that is not a licence to emit nothing: fall back to a declared
  code and crop.
- **Third-party embed.** A frame you do not control the contents of is still your frame. Declare
  `RATIO-2` or `RATIO-4` and let the embed fill it absolutely.
- **Fixed-height rails.** A row of logos or a row-height thumbnail may bound the height rather than
  the ratio. This is legal under `RATIO-5` only, where the height is the bound and the shape stays
  the source's.
- **Two adjacent codes both match.** Choose the code whose crop discards less. Ask one discriminator
  question only when the requester explicitly requires the shape that discards more.

## Output

```text
frame: <element that reserves layout space>
source: <declared dimensions | carried by data | unknown>
situation: <RATIO-0 | RATIO-1 | RATIO-2 | RATIO-3 | RATIO-4 | RATIO-5>
frame class: <no aspect class | aspect-square | aspect-video | aspect-[4/3] | aspect-[w/h] | bounded frame>
fit: <none | object-cover + anchor | object-contain>
reason: <business fact that excludes the adjacent code>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is ordinary markup with ordinary `className` values.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
