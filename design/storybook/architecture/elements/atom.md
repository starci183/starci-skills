# atom

**An atom is one element.** It renders a value, it owns that value's states, and it does nothing
else.

> **Read the worked examples first:** [`../examples/atom.md`](../examples/atom.md) — real components
> at this tier, each with what it renders and why it sits here. The rules below are easier to judge
> once the examples are in front of you.

## At a glance

| | |
|---|---|
| group | vocabulary — a word any product can use |
| owns | one element: a value it renders, and every state that value can be in |
| never | knows data; arranges children; lets a caller change how it looks |
| may import | nothing |
| takes `className` | **yes, for position only** — never for appearance |
| composes classes (`cn`) | yes — appearance is its own job |
| tiers below | none — this is the floor |

## Rules

**ATOM-1 · An atom is one element.**

Not a small composition, not "an atom with a bit of layout". One element that renders one value.
If it places a child the caller handed in, it is a composite that took the wrong name.

**ATOM-2 · It knows nothing about data, and it arranges nothing.**

This is the line that decides the tier, not a preference about style.

**ATOM-3 · It may import: nothing.**

Imports run downward only, and there is nothing below this tier. An atom that imports a frame is
arranging its own children, and at that moment it has stopped being a word.

**ATOM-4 · Every state the value can be in is a prop — and an atom that renders a value exposes `isSkeleton`.**

Loading, empty, disabled, invalid, pressed. The atom owns the value, so it owns what the value looks
like in each state; nobody above it should be drawing those.

`isSkeleton` is not optional for an atom that renders a value. The atom knows its own resting shape
— its line box, its width, its radius — and only it can produce a shimmer occupying exactly the
space the real value will. A caller drawing its own skeleton is guessing at that shape, and the row
jumps the moment data lands, which is the one thing a skeleton exists to prevent.

**Not every atom renders a value.** A rule between two things, a brand mark, a floating surface
whose content is handed in — these have nothing standing behind them to wait for, and a shimmer
there would be a shimmer for nothing.

Such an atom says so, once, where the claim can be read and disagreed with:

```ts
/** @noSkeleton renders no value of its own — the content is handed in by the caller. */
```

The tag is deliberate rather than inferred. A script guessing which atoms "have a value" is wrong
in both directions — it exempts one that should shimmer, and demands a shimmer from a divider —
and a wrong exemption is invisible until a row jumps in production. Writing the tag costs one line
and makes the claim reviewable.

**The width of a shimmer is a fraction of its container, never a fixed number.**

```ts
/** A subset of AllowedClassName. `w-full` is excluded: a shimmer at full width is a bar, not a hint. */
export type SkeletonWidth = "w-1/4" | "w-1/3" | "w-1/2" | "w-2/3" | "w-3/4"
```

The caller knows roughly how much of the line the real value will fill — a quarter, a half, most of
it. It does not know how many rem that is on this screen at this breakpoint, and neither does the
atom: the answer depends on the container, which is why a fixed `w-24` is wrong even when the atom
writes it.

A fraction is the only form that survives the container changing. It also keeps this scale a subset
of `AllowedClassName` rather than a second, parallel vocabulary of sizes — an abstract scale like
`"short" | "long"` would have to be mapped back to real widths somewhere, and that mapping is a
fixed number wearing a different name.

Height is never passable. The line box is the thing a skeleton exists to preserve, and only the atom
knows it.

**ATOM-5 · The prop is `classNames: Array<AllowedClassName>`, never `className: string`.**

This is the sharpest rule at this tier, and the only one that can be enforced by the compiler
instead of by discipline.

```ts
/**
 * Where an atom sits INSIDE ITS PARENT — the only thing a caller may say about it.
 *
 * A CLOSED list, deliberately. No template literals, no `${string}` escape, no arbitrary
 * values: the moment one arbitrary form is allowed, every hand-measured number arrives
 * through it and the union stops meaning anything.
 */
export type AllowedClassName =
    // how it behaves as a flex child
    | "flex-1" | "flex-auto" | "flex-none" | "grow" | "grow-0" | "shrink" | "shrink-0"
    // the two overflow guards a child needs to not blow out its row
    | "min-w-0" | "min-h-0"
    // where it aligns itself against its siblings
    | "self-start" | "self-center" | "self-end" | "self-stretch"
    // width relative to the parent — never a fixed number
    | "w-full" | "w-fit" | "w-auto" | "h-full" | "h-fit" | "h-auto"
    | "w-1/2" | "w-1/3" | "w-2/3" | "w-1/4" | "w-3/4"
    // grid placement, which only the parent's grid can know
    | `col-span-${1 | 2 | 3 | 4 | 5 | 6}` | `row-span-${1 | 2 | 3}`
    | "order-first" | "order-last" | `order-${1 | 2 | 3}`

interface AtomProps {
    /** Position within the parent. Everything about appearance is a prop of its own. */
    classNames?: Array<AllowedClassName>
}
```

**What the list leaves out.** Each is a boundary, not an oversight:

| Absent | Belongs to |
|---|---|
| margins | the frame's `gap` — space between children is not a child's decision |
| fixed sizes — `w-24`, `h-4`, `size-4` | the atom's own `size` prop; it owns its resting shape |
| arbitrary values — `w-[120px]` | nowhere; a number measured by eye |
| `flex-col`, `flex-wrap`, `gap-*` | the frame — direction and seam arrange siblings |
| `absolute`, `relative`, `z-*` | a composite; pinning two elements together is a shape |

A spacing step being on the house scale does not rescue it. `mt-3` is a legal step and still wrong
here: the number is not the problem, the direction of the decision is.

**Why a union and not a string.** `className: string` cannot be constrained — every value is
valid, so the rule can only ever be enforced by a reviewer noticing. A union of literals moves the
same rule into the type system: `text-red-500` stops compiling, and nobody has to catch it.

**Why appearance must not travel through it.** Appearance is a decision the design system already
made, exposed as `tone`, `size`, `variant`. The moment a caller can write `text-red-500` on an
atom, that decision moves to the call site — and the next caller makes it slightly differently. Ten
call sites later there is no house style, only ten opinions.

**Why position is the exception.** Where an atom sits inside a flex row is a fact about the
**parent**, and the atom has no way to know it. That one class of decision has to be passable, and
only that one.

> **Test:** would this class still make sense if the atom moved to a completely different screen?
> Position classes stop making sense — which is why they belong to the caller. Appearance classes
> would still apply — which is exactly why they must not be passed.

**Migration.** An atom still declaring `className?: string` has the old escape hatch open;
`scripts/audit-atoms.mjs` lists them, along with any call site currently passing appearance
through it.

**ATOM-6 · It composes classes for its own appearance.**

Deciding how it looks is this tier's work, so `cn` belongs here. The variants it exposes are the
finished vocabulary; the class strings behind them are private.

**ATOM-7 · It belongs here when: it takes a value and renders it, with no child of its own to place.**

Use this to confirm a placement, not to argue one.

**ATOM-8 · It is in the wrong tier when: it arranges children.**

Then it is a composite with the wrong name. This is the detection signal — the thing to look for in
review.

**ATOM-9 · The vendor stops here.**

Where a `Base` file sits beside a plain name, the `Base` holds the vendor import and the plain name
is the house version with the vendor's freedom removed. Everything above talks to the plain name, so
the library underneath can be swapped in one file.

**ATOM-10 · It takes the inspection switch and NOT the part name — it already knows what it is.**

```ts
showAnatomy?: boolean          // is the inspection overlay on
// no anatPart — the atom writes its own name
data-anat-part={showAnatomy ? "Chip" : undefined}
```

The switch travels down because whether the badges are on is a property of the session. The name
does not travel at all, because an atom is the one thing in the system that knows it is a rule and
not a spacer, a chip and not a badge.

A caller passing the name in is a caller describing the atom — the same failure as passing it
`text-red-500`, one level over, and it fails the same way: two callers label the same component two
different things, and an overlay meant to be a map of the system becomes a record of what each
author happened to call it that day.

An atom is the floor. Nothing below it can supply a better answer, so there is nobody to ask.

Contrast with [`frame.md`](frame.md) FRAME-11 — a frame takes both, because it genuinely cannot know
what it is arranging. Full reasoning in [`../concept.md`](../concept.md) — *a name belongs to
whoever knows it*.

## Notes

_Empty on purpose. Anchored rules for `atom` go here — each from something that actually broke,
with the case that proves it._

---

Examples: [`../examples/atom.md`](../examples/atom.md) · Architecture: [`concept.md`](../concept.md)
