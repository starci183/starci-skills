# Radius presentation

This file answers one question: given a boundary the application owns, how round is its corner?

Composition has already chosen the DOM tree and the Grammar objects. Radius presentation resolves the
corner of application-owned surfaces, marks and pills only. The corner of a card, input, button, or any
other Grammar object belongs to Grammar, which draws it from its own tokens and never from a class the
application passes in.

## Scale

Every step is a multiple of one number. The theme publishes `--radius` and derives the whole ramp from
it, so the ramp moves as a body when a visual family changes that one number: the application root sets
`--radius: .5rem`, Grammar's core family sets it to `--starci-core-control-radius` (`.75rem`), and the
heritage family sets it to `0`. The rule ID is the ordinal position on that ramp. It is not a size word
and not a component variant.

| Rule | Class | Factor | Value at `--radius: .5rem` |
| --- | --- | --- | --- |
| — | `rounded-none` | `0` | `0` |
| — | `rounded-xs` | `× .25` | `.125rem` |
| RADIUS-2 | `rounded-sm` | `× .5` | `.25rem` |
| — | `rounded-md` | `× .75` | `.375rem` |
| RADIUS-4 | `rounded-lg` | `× 1` | `.5rem` |
| RADIUS-5 | `rounded-xl` | `× 1.5` | `.75rem` |
| RADIUS-6 | `rounded-2xl` | `× 2` | `1rem` |
| RADIUS-7 | `rounded-3xl` | `× 3` | `1.5rem` |
| — | `rounded-4xl` | `× 4` | `2rem` |
| RADIUS-9 | `rounded-full` | none | a corner larger than the box |

The rule number is the row's position on that ramp, counting `rounded-none` as zero, and it is a stable
address: the ramp is printed whole so the published numbers never shift when a step is added. A step
gets its number, and a case table below, only once two authorized blocks write it; the four steps
reading `—` are reserved addresses, because one occurrence is a product decision, not a rule.

Because the factors are fixed and only `--radius` moves, an application that writes a rem value
directly — `rounded-[1.25rem]` — freezes one family's decision into every family and leaves the ramp
behind.

`rounded-field` is not a step. It is the vendor's field utility, resolving to `--field-radius`, and it
belongs to the field family rather than to an application choice.

## Owner

Each case names who owns the corner. The owner decides whether the application writes a class at all.

| Owner | Meaning | Application writes |
| --- | --- | --- |
| `App` | The boundary belongs to the application | The class |
| A component name | Common already rounds this boundary inside that component | Nothing. Compose it |
| `—` | Common exposes no public path for this boundary | The class, recorded as a workaround |

Writing a class where a component is the owner is `APP_REIMPLEMENTATION`. Reaching into a Grammar
component with a selector or a passed class to change its corner is `APP_OVERRIDE`.

## Classes off the scale

`rounded-small`, `rounded-medium` and `rounded-large` are not on this scale and are not utilities this
app publishes. They are the vendor's Tailwind 3 plugin names, and the compiled stylesheet of this head
emits no rule for any of them: `rounded-` prints `none`, `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `full`
and `field`, and nothing else. A boundary written with one of them therefore renders square while the
source reads as though a corner were chosen.

They are removed rather than translated. The removal reason is `off the closed scale`, and the
replacement is the ramp step the boundary's case names, not the step whose word happens to match.

An arbitrary value such as `rounded-[1.25rem]` is off the scale for the same reason and by a shorter
argument: it is a number nobody can cite and nobody can move.

## Radius Common already owns

Common rounds its own objects from three tokens published by `@grammar/core`, and no application class
reaches them: `--starci-core-surface-radius` (`1rem`) rounds every surface, including
`.starci-core-surface` and the `MediaFrame` viewport; `--starci-core-control-radius` (`.75rem`) rounds
controls and tooltip content; `--starci-core-pill-radius` (`999px`) rounds the pill shapes. A visual
family may set those tokens to its own numbers, which is why an application that copies the current
number freezes one family's decision into every family.

`scripts/generate-presentation-owned.mjs` does not yet carry a `RADIUS` topic, so this file has no
generated ownership table. Until it does, a reader rules out writing a class by finding the boundary
among the three tokens above.

## RADIUS-2 — `rounded-sm` / `.25rem`

The smallest corner that still reads as intentional, for a mark small enough that a larger corner would
eat its body.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A dense grid cell or legend swatch a few pixels on a side | `App` | `<span className="size-3 rounded-sm bg-default" />` |
| Case 2 | A skeleton line standing in for text while it loads | `App` | `<div className="h-4 w-40 rounded-sm" />` |

Not this rule: a container holding readable content, which needs a corner proportional to its inset.
Use RADIUS-5.

## RADIUS-4 — `rounded-lg` / `.5rem`

A compact interactive boundary: a small square badge or a control-sized region the application owns.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A fixed square marker carrying a number or a glyph | `App` | `<span className="flex size-8 items-center justify-center rounded-lg bg-accent-soft">` |
| Case 2 | An app-owned segmented control's own segment | `App` | `<button className="min-h-9 rounded-lg px-3">` |
| Case 3 | A small bordered notice sitting inside a larger surface | `App` | `<div className="rounded-lg border border-separator p-3">` |

Not this rule: an object Common already draws as a control. Compose the component and pass no class.

## RADIUS-5 — `rounded-xl` / `.75rem`

The standard corner for an app-owned region nested inside a surface: a band, a notice, a bordered
group that is part of a card rather than a card of its own.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A bordered group of content inside a section | `App` | `<div className="rounded-xl border border-separator p-4">` |
| Case 2 | A soft-toned notice or status band | `App` | `<div className="rounded-xl bg-accent-soft px-3 py-2">` |
| Case 3 | A square icon tile beside a row of text | `App` | `<span className="flex size-11 items-center justify-center rounded-xl bg-accent-soft">` |

Not this rule: the outermost surface of a region, which takes the surface corner. Use RADIUS-6.

## RADIUS-6 — `rounded-2xl` / `1rem`

The surface corner: an app-owned region that reads as a card in its own right, matching the value
Common gives its own surfaces.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | An app-owned panel that stands as its own surface on the page | `App` | `<div className="min-w-0 overflow-hidden rounded-2xl bg-surface-secondary">` |
| Case 2 | A full-width notice occupying a whole region of the page | `App` | `<div className="rounded-2xl bg-warning-soft p-4">` |
| Case 3 | A surface whose block start alone is rounded, because its end runs into what follows | `App` | `<div className="rounded-t-2xl">` |

Not this rule: a card Common already draws. Compose `SurfaceCard` and write no corner.

A rounded surface that paints or lays out children clips them, so `overflow-hidden` belongs with the
corner wherever a child would otherwise cross it.

## RADIUS-7 — `rounded-3xl` / `1.5rem`

The largest ramp corner in use: a hero band whose size makes the surface corner look tight.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A page-opening hero region spanning the full content width | `App` | `<div className="grid min-w-0 overflow-hidden rounded-3xl bg-accent-soft">` |

Not this rule: an ordinary panel, which reads as inflated at this radius. Use RADIUS-6.

## RADIUS-9 — `rounded-full` / a corner larger than the box

The end of the ramp, and a shape rather than a value: the boundary is a circle or a pill, and the value is whatever the
box needs to make it one.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A dot, avatar frame or other equal-sided circular mark | `App` | `<span className="size-2 rounded-full bg-accent" />` |
| Case 2 | A pill-shaped app-owned band or floating action | `App` | `<div className="inline-flex items-center gap-2 rounded-full px-3 py-2">` |

Not this rule: a wide rectangle, where a pill corner reads as a mistake rather than a shape. Use the
ramp step its size calls for.

## Corner variants

`rounded-t-*`, `rounded-b-*`, `rounded-s-*`, `rounded-e-*` and the single-corner classes are not
separate rules. They apply an existing rule to the corners they name, for a boundary whose sides do not
all end the same way.

| Corners | Class | Meaning |
| --- | --- | --- |
| One block edge | `rounded-t-*`, `rounded-b-*` | The chosen rule applies to that edge's two corners |
| One inline edge | `rounded-s-*`, `rounded-e-*` | The chosen rule applies to that edge's two corners |
| One corner | `rounded-tl-*`, `rounded-br-*`, and siblings | The chosen rule applies to that corner only |

A corner variant needs a reason from the tree: an edge that meets another surface, or a single corner
that points at what the element belongs to. Without one it is a decoration, and every corner of the
boundary takes the rule.

On the same element the narrower class wins the corners it names rather than adding, so
`rounded-2xl rounded-b-none` is `1rem` at the top and square at the bottom.

## What this file does not decide

Which surface or tone the region takes is [Surface](surface.md). Which line draws its edge is
[Boundary](boundary.md). Its inset is [Padding](padding.md), and clipping is [Overflow](overflow.md);
a corner and a clip are decided together but recorded apart.
