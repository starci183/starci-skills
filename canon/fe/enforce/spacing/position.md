# position — the only thing a caller may say about a child

`AllowedClassName` is the closed union a caller passes through `classNames`. It answers one question
and no other: **where does this element sit inside its parent, and how much of the parent's box does
it take.**

Where a child sits is a fact about the **parent**, and the child cannot know it — so that one class of
decision has to be passable, and only that one. Everything else about how a child looks is already a
prop (`tone`, `size`, `variant`), decided by the design system rather than by whoever called it. The
reasoning lives in [`../elements/atom.md`](../elements/atom.md) ATOM-5; this file holds the members.

## The union

```ts
export type AllowedClassName =
    // how it behaves as a flex child
    | "flex-1" | "flex-auto" | "flex-none" | "grow" | "grow-0" | "shrink" | "shrink-0"
    // the two overflow guards a child needs to not blow out its row
    | "min-w-0" | "min-h-0"
    // where it aligns itself against its siblings — CROSS axis only
    | "self-start" | "self-center" | "self-end" | "self-stretch"
    // width relative to the parent — never a fixed number
    | "w-full" | "w-fit" | "w-auto" | "h-full" | "h-fit" | "h-auto"
    | "w-1/2" | "w-1/3" | "w-2/3" | "w-1/4" | "w-3/4"
    // grid placement, which only the parent's grid can know
    | `col-span-${1 | 2 | 3 | 4 | 5 | 6}` | `row-span-${1 | 2 | 3}`
    | "order-first" | "order-last" | `order-${1 | 2 | 3}`
```

**Closed, deliberately.** No template literal, no `${string}` escape, no arbitrary values. The moment
one arbitrary form is allowed, every hand-measured number arrives through it and the union stops
meaning anything — a `${string}` branch would make `tsc` accept `top-[13px]` and `bg-red-500` alike.

## What it leaves out, and where each goes instead

| absent | belongs to | why |
|---|---|---|
| margins | the frame's `gap` — see [`margin.md`](margin.md) | space between children is not a child's decision |
| fixed sizes — `w-24`, `size-4` | the atom's own `size` prop | the atom owns its resting shape |
| arbitrary values — `w-[120px]` | nowhere | a number measured by eye |
| `flex-col`, `gap-*` | the frame | direction and seam arrange siblings, they do not place one |
| padding | [`padding.md`](padding.md) | the surface holds its own content |
| `absolute`, `relative`, `z-*` | a composite | pinning two elements together is a shape, and a shape has a name |

> **Test:** would this class still make sense if the element moved to a completely different screen?
> Position classes stop making sense — which is why they belong to the caller. Appearance classes
> would still apply — which is exactly why they must not be passed.

## The two guards that ride along

`shrink-0` and `min-w-0` are the two most-reached-for members, and they are a pair: `min-w-0` lets a
flex child shrink below its content so a long label can truncate instead of blowing out the row;
`shrink-0` protects a fixed thing (an icon, an avatar) from being crushed. "Do not blow out this row"
is almost always these two together.

## The main axis has its own words — in `margin.md`

Every alignment member here is **cross** axis (`self-*`). Push-me-to-the-end-of-this-row is **main**
axis, and the union is deliberately silent: those are `push-end` / `pin-bottom` / `center-measure`,
the three named alignments in [`margin.md`](margin.md), because CSS gives no property for main-axis
self-alignment but the auto-margin.

## The sibling union — skeleton widths

Fractional widths (`w-1/2 … w-3/4`) do a second job: a shimmer is a fraction of its container, never a
fixed length. That intent has its own union, so an atom picks its skeleton width rather than a caller
passing one:

```ts
/**
 * Widths a skeleton placeholder may take: fractions of its container, never a fixed length.
 * `w-full` is excluded — real text rarely fills its line, and a shimmer at full width is a bar
 * rather than a hint. There is no height variant: the line box is the atom's, not the caller's.
 */
export type SkeletonWidth = "w-1/4" | "w-1/3" | "w-1/2" | "w-2/3" | "w-3/4"
```

## Members that earn nothing yet

Grid placement (`col-span-*`, `row-span-*`) and `order-*` exist in the union but a grid frame that
takes `items` and places them itself never needs a child to say where it goes — reordering is
arrangement, and arrangement belongs to the frame that owns the track. They stay as headroom, not as
an invitation: a child reaching for `order-*` is usually a frame that should have been handed its
items in the right order.

---

Siblings: [`gap.md`](gap.md) · [`padding.md`](padding.md) · [`margin.md`](margin.md) ·
[`responsive.md`](responsive.md)
Rules: [`../elements/atom.md`](../elements/atom.md) ATOM-5
