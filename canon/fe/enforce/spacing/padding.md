# padding — the air a surface gives what it holds

`AllowedPadding` is the only vocabulary a `padding` prop accepts. It answers a different question from
[`gap.md`](gap.md), and the two must never share a word or a number by accident:

| | asks | owner |
|---|---|---|
| **gap** | what are these two things to each other? | the frame between them |
| **padding** | how tightly does this surface hold what it contains? | the thing that draws the surface |

`padding={3}` and `gap={3}` are not the same decision and need not resolve to the same class. They are
separate types for that reason.

## The number is a STEP, not a size

Same as gap: an ordered index into a table, not a unit. `padding={4}` is not 4px.

## The six steps

| step | class | px | when |
|---|---|---|---|
| `1` | `p-0` | 0 | content **touches the edge** — a cover image, a table that scrolls under its own header, a media tile |
| `2` | `p-1` | 4 | the tightest chrome that is still chrome — an icon button's halo, a dot's hit area |
| `3` | `p-2` | 8 | **compact chrome** — a chip, a collapsed sidebar row, a dense list row, a small icon button |
| `4` | `p-3` | 12 | a dense inner surface — a list row's cell, a compact tile |
| `5` | `p-4` | 16 | **card, modal, drawer — the house inset for a surface that holds groups.** Matches the `gap-4` seam between the groups inside it, so the edge breathes at the rhythm of its contents |
| `6` | `p-6` | 24 | **a page measure or a container** — the outermost surface before the viewport |

## Padding is not one number — it takes an axis

A surface breathes **wider than it is tall**: horizontal padding runs larger than vertical, because
text runs sideways. A single scalar cannot say that, so the prop takes an axis — and the asymmetric
form is the commoner shape in practice, not the exception.

```ts
padding: AllowedPadding | { x?: AllowedPadding; y?: AllowedPadding }

padding={4}                 // even on all four sides
padding={{ x: 5, y: 3 }}    // px-4 py-2 — wider than tall
```

Two things this deliberately does **not** offer:

- **Single edges** (`pt`/`pr`/`pb`/`pl`). A one-sided pad is usually a seam problem wearing padding's
  clothes — a surface compensating for a border or a neighbour — and the fix is the frame's `gap`.
- **A `padding="cozy"`-shaped word.** `snug`/`cozy`/`roomy` read well but carry no agreed order
  between two people, so a review has no ground to stand on.

## The pattern names — why an inset is the step it is

A padded surface declares WHICH inset it is on the box itself, so a rendered-tree test measures the
concept, not the class. Same marker as [`gap.md`](gap.md): `data-principles`.

```tsx
<div data-principles="card-padding" className="p-4"> … </div>        // a card interior
<div data-principles="control-pad" className="px-3 py-2"> … </div>   // a pill / dropdown item
```

| concept | value | what it is |
|---|---|---|
| `cell-pad` | `p-3` · 12 | a dense inner surface — a list-row cell, a compact tile |
| `card-padding` | `p-4` · 16 | card, modal, drawer — the house inset for a surface holding groups |
| `page-pad` | `p-6` · 24 | the outermost page or section measure before the viewport |
| `control-pad` | `px-3 py-2` · 12/8 | a control holding short text — a pill, a badge, a dropdown item, an input row |
| `row-pad` | `px-4 py-3` · 16/12 | a bordered or rounded row holding a full line — a list row, a card section shell |
| `pill-pad` | `px-4 py-2` · 16/8 | a punchy pill button or a chip with weight |

An asymmetric concept is measured on **both** axes: `control-pad` fails if `px` is not 12 **or** `py`
is not 8. A box padded 12 all round would pass "on the scale" and still be the wrong shape for a
control — the one check a symmetric scalar could never make.

## The type

```ts
/** A step on the inset scale. An index, never a measurement. */
export type AllowedPadding = 1 | 2 | 3 | 4 | 5 | 6

/** Padding may differ per axis, because in practice it usually does. */
export type PaddingValue = AllowedPadding | { x?: AllowedPadding; y?: AllowedPadding }
```

Responsive wraps the whole value: `padding: Responsive<PaddingValue>`.

## What this forbids

- **A padding class written by hand** above the atom tier — it bypasses the scale.
- **A value between steps** — `p-5`, `p-[13px]`.
- **Rounding an asymmetric inset to a symmetric step silently** — record the drift at the site, or drop out of the frame and write the class by hand.

---

Siblings: [`gap.md`](gap.md) · [`margin.md`](margin.md) · [`position.md`](position.md) ·
[`responsive.md`](responsive.md)
