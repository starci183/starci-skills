# Principles — the named seams, and why each is the number it is

A scale is one axis of measurement. Knowing that a seam is eight pixels tells you it is on the
ladder; it does not tell you **why**, and two correct eight-pixel seams can mean entirely different
things — a row of buttons a person acts on, and a column of peers with nothing subordinate. When the
only thing written down is the number, a reviewer has nothing to argue with, and the next person
picks whichever rung looked about right.

So a second layer rides on top of the scale. A container declares the **concept** it embodies, by
name, on itself:

```tsx
<div data-principles="card-padding block-boundary" className="flex flex-col gap-6 p-4"> … </div>
```

The scale gives the number; the concept gives the meaning; and because the concept resolves to
exactly one value, a rendered-tree test can measure whether the box the browser produced is the value
the name promised. `data-principles` is a space-separated list, read like `class` — one element
usually makes several layout decisions at once, so it declares each of them.

**The token is the concept, never the pixel.** Writing `data-principles="p-4"` would restate the
class beside the class and check nothing.

This file is the prose side of the registry. The executable side is `canon/fe/explore/registry.mjs`, which
holds every token, the property it governs, and the value it must compute to; the reasoning behind
each scale is `canon/fe/enforce/spacing/`. Where a number here and a number there
ever disagree, the registry is the one the test reads, and this file is the one that is stale.

## The number is a step, not a size

Both scales are ordered indexes into a table, not units. `gap={3}` is eight pixels, not three, and
the digits agreeing anywhere on the ladder is a coincidence. The index does no arithmetic — two
steps of three are not a step of six — and when the table changes, every call site moves with it.

```
gap      step -> px    1->0  2->4  3->8  4->12  5->16  6->24  7->32  8->48
padding  step -> px    1->0  2->4  3->8  4->12  5->16  6->24
```

The rungs are the same on both ladders up to six, and that is deliberate: a surface's own inset
matches the seam between the groups it holds, so its edge breathes at the rhythm of its contents.

## The seams

A frame owns the space between its children, so a frame is the only tier that reads the gap scale and
nothing above a frame writes a gap class by hand.

### Step 1 — zero. One thing, no seam.

| Concept | px | What it is |
|---|---|---|
| `name-handle` | 0 | a name stacked straight over its handle or role — the two lines of one identity |

Zero is a real decision, not the absence of one. The two lines of an identity are one thing; a seam
between them would claim they are two.

### Step 2 — four. A joint inside one thing.

| Concept | px | What it is |
|---|---|---|
| `icon-text` | 4 | an icon hugging its text — a back link, a breadcrumb, a button's icon and label, clickable or not |
| `separator-dot` | 4 | a dot between meta fragments, as in `12 lessons · 3 hours · Free` |
| `title-subtitle` | 4 | a title and the subtitle continuing it in one voice |

`title-subtitle` sits here rather than a rung up because one voice continuing is not a level of
grouping. The registry records that it was measured at four across roughly 130 sites, against an
assumption of eight.

### Step 3 — eight. The seam within a unit.

| Concept | px | What it is |
|---|---|---|
| `flex-action` | 8 | a row of controls a person acts on — buttons side by side, an input and its button |
| `identity` | 8 | an avatar and the name beside it (the inner name-to-handle seam is `name-handle`) |
| `value-row` | 8 | numbers read together on one baseline — a price, its struck original, its period |
| `chip-row` | 8 | a wrapping row of same-kind chips or tags |
| `sibling-stack` | 8 | a column of peers, none subordinate — accordion panels, a list of options |

Five concepts share one number, which is exactly the case that proves why the concept layer exists. A
check that only knew "eight is on the scale" could not tell a controls row from a chip row, and could
not catch either one drifting to twelve. `value-row` carries a second obligation the registry notes
as the cleanest signal in the app: it is always baseline-aligned, because numbers read together sit
on one line or they do not read together at all.

### Step 4 — twelve. A label, or a row's segments.

| Concept | px | What it is |
|---|---|---|
| `label-field` | 12 | a label and the control it names — a boundary, a change of register |
| `content-row` | 12 | a list row's segments: a leading icon, a title and meta block, a trailing action |
| `card-caption` | 12 | a card and the description sitting outside it |

### Step 5 — sixteen. Between groups in one surface.

| Concept | px | What it is |
|---|---|---|
| `group-boundary` | 16 | two groups in one surface — two field clusters, a card's header block and its body |

### Step 6 — twenty-four. Between blocks in a page.

| Concept | px | What it is |
|---|---|---|
| `block-boundary` | 24 | two blocks in a page — one card and the next, section to section |

The registry records this as the single most common block seam, at 271 sites.

### Step 7 — thirty-two. The layout seam.

| Concept | px | What it is |
|---|---|---|
| `layout-split` | 32 | two columns left and right, a header and the content under it |

This rung was pulled in from forty when the scale was locked. That is a deliberate break: a surface
still rendering forty is now off-scale, which is what forces the pending sites to migrate instead of
letting the old value pass unnoticed.

### Step 8 — forty-eight. Marketing air.

| Concept | px | What it is |
|---|---|---|
| `marketing-beat` | 48 | full-width bands on a page that sells rather than teaches |

A third scale, landing pages only, with its own rhythm above the app's ladder.

### The ladder climbs by grouping

`label-field` 12, `group-boundary` 16, `block-boundary` 24, `layout-split` 32 — each level is one
step wider than the thing it wraps. That is the whole mental model, and it is what makes an
unfamiliar case decidable: ask what level of grouping the seam separates, then read off the rung.

A skeleton mirror always declares the **same** concept as the thing it stands in for, so the layout
does not jump when data lands.

## The insets

Padding answers a different question from gap and must never borrow its word or its number by
accident. Gap asks *what are these two things to each other*, and the frame between them owns the
answer. Padding asks *how tightly does this surface hold what it contains*, and the thing that draws
the surface owns it. That is why they are separate types: `padding={3}` and `gap={3}` are not the
same decision and need not resolve to the same class.

| Concept | Value | What it is |
|---|---|---|
| `cell-pad` | 12 | a dense inner surface — a list-row cell, a compact tile |
| `card-padding` | 16 | card, modal, drawer: the house inset for a surface that holds groups |
| `page-pad` | 24 | the outermost page or section measure before the viewport |

`card-padding` at sixteen is the ladder rule made visible — it matches the sixteen-pixel
`group-boundary` seam between the groups inside it.

### Padding takes an axis, because a surface breathes wider than it is tall

Text runs sideways, so horizontal padding runs larger than vertical, and a single scalar cannot say
that. The asymmetric form is the commoner real shape, not the exception:

| Concept | x | y | What it is |
|---|---|---|---|
| `control-pad` | 12 | 8 | a pill, a badge, a dropdown item, an input row: a control holding short text |
| `row-pad` | 16 | 12 | a bordered or rounded row holding a full line — a list row, a card section shell |
| `pill-pad` | 16 | 8 | a punchy pill button, a chip with weight, a call to action |

An asymmetric concept is measured on **both** axes and fails if either is wrong. A box padded twelve
all round would pass any check that only asked "is this on the scale", and would still be the wrong
shape for a control — which is the one thing a symmetric scalar could never catch.

Two things the scale deliberately withholds. **Single edges** are not offered: a one-sided pad is
usually a seam problem wearing padding's clothes, a surface compensating for a border or a
neighbour, and the fix is the frame's gap. **Word-sized names** are not offered either: `snug`,
`cozy` and `roomy` read well and carry no agreed order between two people, so a review has no ground
to stand on.

## The three alignments, and why margin has no scale

There is no allowed-margin type, and that absence is the rule rather than an oversight. Space between
two children is not a child's decision. A child that pushes its neighbour away has made a claim about
a sibling it cannot see — move it to a different frame and the claim is wrong, but it still applies.
The number was never the problem; the **direction of the decision** was, which is why a legal step
written as a top margin is still wrong. A numeric margin is a seam written by the wrong owner, and it
belongs to the frame between the two things, as a gap.

What survives is main-axis self-alignment, and only because plain CSS gave no other property for it:

| Concept | Means | How |
|---|---|---|
| `push-end` | push one child to the trailing end of a flex row | a left margin of auto |
| `pin-bottom` | sink a footer to the bottom of a flex column, whatever the content height | a top margin of auto |
| `center-measure` | centre a content measure in its parent — the reading column | a horizontal margin of auto |

These carry the same `data-principles` marker as the seams, so a caller declares the intent by name
instead of reaching for a raw auto margin. The cross axis needs none of this: it has real properties,
and they are in the position union in
`canon/fe/enforce/spacing/position.md`.

The runner records these three honestly rather than asserting them, because computed style reports
the used pixel value an auto margin resolved to and never the string itself — see `canon/fe/enforce/testing.md`.

Also forbidden, and worth naming because it hides in plain sight: the child-margin form of spacing
that CSS offers as a container utility. It is a gap with the ownership inverted, and it breaks the
moment one child is conditionally rendered.

## Structure the frame declares about itself

Spacing is passed by the caller, because only the caller knows why a seam is what it is. Structure is
different: display, direction, wrap, grid, overflow, position and sizing are decided by the frame you
chose to use, so a frame emits its own structural token the way it emits `data-component`. A caller
does not set these.

| Concept | Property | Must compute to |
|---|---|---|
| `reel` | horizontal overflow | `auto` (a scroll value satisfies it too) |
| `sticky-top` | position | `sticky` |
| `fixed-bar` | position | `fixed` |
| `stack-below` | a responsive switch | asserted by the breakpoint sweep, not by a single computed value |

## Widths are container widths, and they have four names

A value on any scale here may vary with width, through one generic rather than one responsive type
per prop. The object form requires a base: a responsive value with no floor depends on whichever
breakpoint happens to match first, and that is not a decision anybody made.

| Step | rem | px | Reads as |
|---|---|---|---|
| `sm` | 40 | 640 | the container is past its narrow form |
| `md` | 48 | 768 | the container can hold two things side by side |
| `lg` | 64 | 1024 | the container is a page column |
| `xl` | 80 | 1280 | the container is the whole workspace |

These are **container** queries, not viewport queries, and that distinction is the entire reason the
file can exist. A component does not know how wide the screen is and should not: the same card sits
in a full-width page, in a two-column split, and in a narrow drawer, and its shape depends on the box
it was given. A viewport breakpoint would make the card in the drawer behave as if it had the whole
screen — the exact bug that sends someone reaching for a className override, after which the shape
lives at the call site forever.

Each key is a floor. A value applies from that width upward until the next key overrides it; omitting
a key means *keep what the previous one said*, never *reset*. The base is not the first breakpoint —
it is the value with no query attached, what a container gets before any breakpoint matches.

A frame that changes shape **names the width where it changes, as a prop**. Two ways that breaks, and
the second is worse than the first. A boolean threshold says that the shape changes and refuses to
say where, so it fires wherever the content happens to overflow — which depends on the string, the
translation, the font — and the same frame then breaks at a different width on every screen, none of
them a width anybody designed. A threshold buried in a class string is worse because it looks solved:
the frame does change at a real, deliberate width, but that width is absent from the type and from
every review, so two frames doing the same job drift apart and nothing shows it.

The stack-to-row switch is the commonest of these shapes and has a name, `stack-below`, carried by a
responsive frame. That is the answer to every wrap boolean: a reflow that matters is part of the
contract and names its width; one that does not matter should not have been a breakpoint at all.

## What all of this forbids

- **A gap or padding class written by hand above the atom tier.** It bypasses the scale wherever it
  was written. `scripts/gates/check-seams.mjs` and `scripts/gates/check-padding.mjs` read the
  source for it; the rendered-tree runner catches the ones no source regex can see.
- **A value between steps** — a fifth rung on the gap ladder, an arbitrary pixel value. Off the
  ladder is a screen that will never match another.
- **Arithmetic on a step.** The rungs are 0, 4, 8, 12, 16, 24, 32, 48; adding one to a step assumes
  they are evenly spaced, and they are not.
- **Rounding an asymmetric inset to a symmetric step silently.** Record the drift at the site, or
  drop out of the frame and write the class deliberately.
- **A breakpoint outside the four**, and any viewport media query inside a tiered component. Only the
  app shell that establishes the container may ask about the viewport.
- **A boolean standing in for a width.** "Mobile" is not a width.
- **A `data-principles` token that is not in the registry.** A marker the registry cannot resolve is
  a claim nothing checks, and the runner treats it as a hard failure on its own.

A frame that realises a seam and does not name it is caught by
`scripts/gates/check-pattern-coverage.mjs` — the concept layer only works if declaring it is not
optional.
