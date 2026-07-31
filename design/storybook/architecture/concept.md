# The tier architecture

What the tiers are, which way imports run, and the one prop rule that makes the whole thing hold
itself together.

Read this first. `tier-boundaries.md` says *why* each line sits where it does;
`how-to-read-a-scan.md` says what a scan of your repo means.

## The seven tiers

Two groups, and the split is not stylistic. The lower three are **vocabulary** — words any product
can use. The upper four are **sentences** — one product saying something specific.

| Tier | Owns | Never | Group |
|---|---|---|---|
| `atom` | one indivisible unit: a value and the states of that value | knows data; arranges children | vocabulary |
| `frame` | direction, seam, alignment, and its own chrome between children | asks what its children are | vocabulary |
| `composite` | a reusable shape assembled from atoms inside frames | knows any domain entity | vocabulary |
| `block` | domain data and its async decisions | draws a shape of its own | sentences |
| `layout` | the shell a whole route sits in | owns content | sentences |
| `overlay` | a surface that covers the page | owns domain data | sentences |
| `page` | which blocks, in which frames, fed which data | draws a shape of its own | sentences |

The dividing question is **does it know a domain entity**. A composite takes `items`, `title`,
`onPress`. A block takes an entity. A component that takes `courseId` is a block whatever folder
it sits in.

## Imports run one way: upward reaches down

```
atom  ←  frame  ←  composite  ←  block  ←  page
```

A higher tier may import a lower one. Never the reverse.

Read it as: **the domain is built out of vocabulary, and vocabulary never knows what sentence it
ended up in.** The moment an atom imports a composite, that atom can no longer be used anywhere
the composite is absent — it has stopped being a word.

One legal exception: a frame may import an atom **to place chrome the frame itself owns**, such as
a divider between children. The test is one question — *is the imported thing something the caller
handed in?* If yes, the frame is doing a composite's job.

## The rule that does the real work: `className` stops at the vocabulary

**A block takes no `className`. A page takes none and composes no classes at all.**

This is not tidiness. It is the mechanism that forces every shape down to the tier that should own
it.

| Tier | Takes `className` | Composes classes (`cn`) | Because |
|---|---|---|---|
| atom · frame · composite | **yes** | yes | they are vocabulary — the caller adjusts spacing and placement |
| block | **no** | rarely, and each time is a smell | it owns an entity; if callers could restyle it, one entity would look different on two screens |
| page | **no** | **never** | a page is a list: which blocks, in which frames, fed which data |

### Why removing the prop is what forces good structure

A block that accepts `className` gives its caller a way out. Whenever a screen needs the block to
look slightly different, the caller reaches for the escape hatch, and the difference lives at the
call site — invisible to every other screen that will need the same thing. Do that five times and
the block has five undocumented variants held in five different files.

Take the prop away and the escape hatch closes. Now the only way to get a different look is to go
**one tier down** and either extend the composite or write the atom. That change is named, it is
visible in one place, and the next screen inherits it for free.

The same argument applies to `cn` inside a block. Composing a class string is deciding what
something looks like, and a block that decides what something looks like has taken a composite's
job. When a block reaches for `cn`, the honest reading is: *a composite is missing, or an existing
one needs a variant*.

### What it looks like when it is working

Measured on a system that follows it, the usage falls away as you climb: nearly every atom, frame
and composite both takes `className` and composes classes; a minority of blocks do; **pages do
neither, at all**.

That gradient is the architecture made visible. Run
`scripts/scan-storybook-architecture.mjs` on your own repo — if `className` is as common in your
blocks as in your atoms, the tiers are folders, not layers.

## Inspection: a name belongs to whoever knows it

A design system needs to be able to point at its own parts — an overlay that badges each rendered
piece with what it is. That badge needs a name, and **which tier supplies the name is not a
convention, it follows from what each tier is allowed to know**:

| Tier | The switch | The name |
|---|---|---|
| `atom` | takes it | **supplies its own**, hard-coded. It knows what it is — a badge, a chip, a rule |
| `frame` | takes it | **takes it from the caller**. It has no idea what it is arranging, and that is its defining rule |

The frame half is the same rule as "it never asks what its children are", read from the other
direction. `StackV` in a card header and `StackV` in a footer are two different parts of a screen,
and the only thing that can tell them apart is the caller. A frame naming itself would be a frame
claiming to know its own contents.

The atom half is the same rule as "appearance is a prop, not a class". A caller passing an atom its
name is a caller describing the atom — the identical failure as passing it `text-red-500`, one
level over. The atom is the only thing that knows it is a rule and not a spacer.

Both tiers take the **switch**, because whether the badges are on is a property of the session, not
of the component. The switch travels down; the name does not travel at all.

> **Test:** could a second caller reasonably want a different name for this? For a frame, always —
> so it takes one. For an atom, never — so it must not.

Two failures this rules out, both invisible without it: an atom that accepts a name lets two callers
label the same component two ways, and the overlay stops being a map. A frame that hard-codes one
labels every `StackV` on the page identically, and the overlay stops saying anything.

## Where a new component goes

Ask in order, stop at the first yes:

| # | Ask | Then |
|---|---|---|
| 1 | Does it render a value and nothing else? | `atom` |
| 3 | Does it only decide direction, seam, alignment? | `frame` |
| 4 | Does it assemble atoms without knowing any domain? | `composite` |
| 5 | Does it own domain data and its async decisions? | `block` |
| 6 | Is it the shell a whole route sits in? | `layout` |
| 7 | Does it cover the page? | `overlay` |
| 8 | Is it a list of blocks fed typed data? | `page` |

Unsure between two: **pick the lower one.** Promoting later is a rename; demoting leaves every
caller that reached for the higher-tier behaviour with nowhere to go, and the usual outcome is the
behaviour hand-rolled at each call site — the exact state the tiers exist to prevent.

## The vendor sits at the bottom

Wrap the component library at atom and frame level so nothing above ever sees it. Where a `XBase`
file sits beside `X`, the `Base` holds the vendor import and the plain name is the constrained
house version; the rest of the system talks to the plain name, so the vendor can be swapped in one
file.

A block importing a vendor **component** is a missing atom. A block importing a vendor **utility**
is not — a class merger has no shape to wrap — but by the rule above, a block should not have
needed one.
