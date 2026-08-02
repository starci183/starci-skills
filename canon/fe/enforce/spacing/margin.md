# margin — the one with no scale

There is no `AllowedMargin`. This file exists to say why, and to say where each real use of margin
goes instead. Every other file here hands you a vocabulary; this one takes one away.

## Why margin has no scale

Space between two children is not a child's decision. A child that pushes its own neighbour away has
made a claim about a sibling it cannot see — move it to a different frame and the claim is wrong, but
it still applies. That is why [`../elements/atom.md`](../elements/atom.md) ATOM-5 excludes margins
from `AllowedClassName` **even when the number is on the house scale**: `mt-3` is a legal step and
still wrong here, because the number was never the problem. The **direction of the decision** was.

So the rule is short: **a numeric margin is a seam written by the wrong owner.** It belongs to the
frame between the two things, as `gap`.

## Two things hide under one word

### 1 — the numeric margin. It is a gap.

`mt-2`, `mb-3`, `ml-1`, and `space-y-2` are all the same shape: a child, or a parent reaching into its
children, spacing siblings apart. `space-x/y-*` is the most honest of them — it is literally `gap`
implemented as margins on children, and it exists only because the frame was missing.

| what you find | where it goes |
|---|---|
| `mt-*` / `mb-*` on one child of a stack | the stack's `gap` |
| `space-y-*` on a container | the same container as a frame with `gap` |
| `mb-*` on every child except the last | that is a gap, written N times with an off-by-one |
| `mt-*` on **one** child to break rhythm | the frame is missing a seam it should own — usually two groups pretending to be one list; the fix is two frames with different gaps, not a margin |

### 2 — `m*-auto`. It is alignment, and it has names.

`mx-auto` centres, `ml-auto` pushes to the end of a row, `mt-auto` pins to the bottom of a column.
None is a distance — every one is an **alignment on the MAIN axis**, expressed through the only
property plain CSS ever gave for it. `AllowedClassName` carries `self-*`, which is the **cross** axis;
the main axis needs its own words, and these are them:

| concept | means | how |
|---|---|---|
| `push-end` | push one child to the trailing end of a flex row | `ml-auto` on that child |
| `pin-bottom` | sink a footer to the bottom of a flex column, whatever the content height | `mt-auto` |
| `center-measure` | centre a content measure in its parent — the reading column | `mx-auto`, and this is a `Container`'s own geometry, not a child's overreach |

These are the one place a margin is legitimate, because there is no other property for main-axis
self-alignment. They ride the same `data-principles` marker as the seams, so a caller declares the intent
by name instead of reaching for a raw `ml-auto`.

## What this forbids

- **`margin` as a prop, at any tier.** No component takes one. If a shape needs one, the shape is a frame away.
- **A margin class in `className`.** Excluded from `AllowedClassName` by construction — except the three named alignments above.
- **`space-x/y-*` anywhere.** It is `gap` with the ownership inverted, and it breaks the moment a child is conditionally rendered.

---

Siblings: [`gap.md`](gap.md) · [`padding.md`](padding.md) · [`position.md`](position.md) ·
[`responsive.md`](responsive.md)
