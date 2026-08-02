# gap — the seam between two things on a track

`AllowedGap` is the only vocabulary a `gap` prop accepts. A frame owns the seam between its children
([`../elements/frame.md`](../elements/frame.md) FRAME-1), so a frame is the only tier that reads this
scale — and nothing above a frame writes a gap class by hand.

## The number is a STEP, not a size

```
gap={3}   →  gap-2   →   8px      NOT 3px
gap={6}   →  gap-6   →  24px      the digits agreeing is a coincidence
```

An ordered index into a table, not a unit: it does no arithmetic (`gap={2}` twice ≠ `gap={4}`), and
when the table changes every call site moves with it.

## The eight steps

| step | class | px | when |
|---|---|---|---|
| `1` | `gap-0` | 0 | the two things **touch** — one is part of the other, not beside it |
| `2` | `gap-1` | 4 | **a joint inside one thing** — an icon before its label, a unit after a number, a title and the subtitle continuing it |
| `3` | `gap-2` | 8 | **things that belong to one unit but stay separate** — a row of controls, a row of chips, the rows of one list |
| `4` | `gap-3` | 12 | **a label and the thing it names** — a field's label and its control, a card and its description |
| `5` | `gap-4` | 16 | **between two groups in one surface** — two field clusters, a card's header block and its body |
| `6` | `gap-6` | 24 | **between two blocks in a page** — one card and the next |
| `7` | `gap-8` | 32 | **the layout seam** — two columns left/right, a header and the content under it |
| `8` | `gap-12` | 48 | **marketing air** — full-width bands on a page that sells rather than teaches |

## The pattern names — why a seam is the step it is

A container declares WHICH seam it owns on the flex/grid element itself, so a rendered-tree test can
measure the concept rather than the class:

```tsx
<div data-principles="flex-action" className="flex gap-2"> … </div>
```

`data-principles` names the **concept**, never the pixel — a space-separated list like `class`, resolved
against a registry that holds the one step each concept maps to. An unknown token is itself a failure.
The gap concepts (padding and alignment concepts live in [`padding.md`](padding.md) /
[`margin.md`](margin.md)):

| concept | step · px | what it is |
|---|---|---|
| `name-handle` | 1 · 0 | a name stacked straight over its handle or role — the two lines of an identity |
| `icon-text` | 2 · 4 | an icon hugging its text — a back link, a breadcrumb, a button's icon and label, clickable or not |
| `separator-dot` | 2 · 4 | a · between meta fragments — `12 lessons · 3 hours` |
| `title-subtitle` | 2 · 4 | a title and the subtitle continuing it — one voice, so it hugs at the joint step |
| `flex-action` | 3 · 8 | a row of controls a person acts on — buttons side by side, an input and its button |
| `identity` | 3 · 8 | an avatar and the name beside it (the inner name↔handle seam is `name-handle`) |
| `value-row` | 3 · 8 | numbers read on one baseline — a price, its struck original, its period; always `items-baseline` |
| `chip-row` | 3 · 8 | a wrapping row of same-kind chips or tags |
| `sibling-stack` | 3 · 8 | a column of peers, none subordinate |
| `content-row` | 4 · 12 | a list row's segments — a leading icon, a title/meta block, a trailing action |
| `label-field` | 4 · 12 | a label and the control it names |
| `card-caption` | 4 · 12 | a card and its description sitting outside it |
| `group-boundary` | 5 · 16 | between two groups in one surface — two field clusters, a header block and its body |
| `block-boundary` | 6 · 24 | between two blocks in a page — one card and the next |
| `layout-split` | 7 · 32 | the layout seam — two columns, a header and the content under it |
| `marketing-beat` | 8 · 48 | full-width bands on a page that sells |

**The label ladder climbs by grouping**, each level one step wider than the one it wraps:
`label-field` 12 → `group-boundary` 16 → `block-boundary` 24 → `layout-split` 32. A surface's own
padding matches the seam between the groups inside it — a card holding groups pads at 16 (`p-4`), so
its edge breathes at the rhythm of its contents. `title-subtitle` sits below the ladder at the joint
step (4), because one voice continuing is not a level of grouping — the 8px rung between them belongs
to a different family, the within-a-unit rows. A skeleton mirror always uses the **same** concept as
what it stands in for, so the layout does not jump when data lands.

## The type

```ts
/** A step on the seam scale. An index into the table, never a measurement. Closed on purpose. */
export type AllowedGap = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
```

The class table is written out in full beside the type — an interpolated Tailwind class ships no CSS.

## Responsive

```ts
gap: Responsive<AllowedGap>
gap={{ base: 3, md: 4, xl: 6 }}   // tight in a narrow container, open in a wide one
```

`base` is required in the object form. See [`responsive.md`](responsive.md); the rule is FRAME-10.

## What this forbids

- **A gap class written by hand**, at any tier — it bypasses the scale.
- **A value between steps** — `gap-5`, `gap-[13px]`. Off the ladder is a screen that never matches another.
- **Arithmetic on the step** — `gap={base + 1}` assumes even spacing; the rungs are 0·4·8·12·16·24·32·48.

---

Siblings: [`padding.md`](padding.md) · [`margin.md`](margin.md) · [`position.md`](position.md) ·
[`responsive.md`](responsive.md)
Rules: [`../elements/frame.md`](../elements/frame.md) · Architecture: [`../concept.md`](../concept.md)
