# Tier boundaries — why each line sits where it does

Read this when a boundary feels arbitrary, or when arguing that a component belongs one tier up.
The tables in `data/` say **what** the rule is; this file says **why**, and every reason here comes
from something that actually broke.

## Atom — the floor

An atom renders one value and the states of that value. It arranges nothing.

The measurement that makes this real: **0 of 47 atoms import any other tier.** Not "rarely" — zero.
That is not discipline, it is the definition. The moment an atom arranges children it has become a
composite, and the only thing left to decide is what to rename it.

Where a `Base` file sits next to a plain name — `ButtonBase` beside `Button`, `ChipBase` beside
`Chip` — the `Base` holds the HeroUI import and the plain name is the constrained house version.
The rest of the system talks to the plain name, so the vendor can be swapped in one file.

## Frame — direction, and nothing about content

A frame decides direction, seam, alignment. It does not know what is inside it.

**The one legal import upward, and the test that keeps it legal.** `Stack` imports the `Divider`
atom to place a rule between children. That is chrome the frame owns — the caller does not pass a
divider in, `Stack` decides it with a boolean. The test is one question:

> Is the imported thing something the caller handed in?

Yes means the frame is doing a composite's job.

**The deleted prop that proves the rule.** A frame once took `bodyStartsWithTabs`, asking the
caller to declare *"my body opens with tabs"* so the frame could subtract 4px. It was removed: that
4px is `Tabs`'s own geometry and `Tabs` must own it. A prop that makes the caller describe its own
content is always the same mistake — the frame is asking a question it has no right to ask.

**Why `wrap` is not a responsive answer.** A frame with `wrap` and a child that shrinks without
limit almost never wraps. Two screens shipped with two columns glued together at every width,
mobile included, and nothing looked broken until someone measured. A frame that changes shape must
name the width where it changes.

## Composite — shape without domain

A composite assembles atoms inside frames. It knows no entity, no field name, no business rule.

45 imports to atoms, 39 to frames, **0 to blocks**. The moment a composite knows a domain entity it
is a block, whatever folder it sits in.

The tell is in the props: a composite takes shapes — `items`, `title`, `onPress`. A block takes an
**entity**. If a component takes `courseId` it is not a composite.

## Block — data and its async decisions

A block owns domain data and decides what empty, loading and error look like. It draws no shape of
its own; every visual comes from a tier below.

**It takes an entity, not loose fields.** A block with fourteen string props is a block that made
its caller do the unpacking, and every caller will unpack it slightly differently.

**It owns the async switch.** The order is fixed — error, loading, empty, content — and error
outranks a stale loading flag. A block that hand-writes that if-else in a different order will
render a stale error on a background refetch, or hide a real error behind a spinner.

## Page — a list of functions

A page names which blocks appear, in which frames, fed which typed data. It draws nothing.

A page importing an atom directly is not illegal, but it is a smell with a specific cause: **a
block is missing**. The page needed a shape, no block offered it, so the page reached down two
tiers and built it inline. That inline shape is invisible to every other screen that will need it.

## HeroUI

The vendor lives at the bottom: 42 of 47 atoms and 9 of 9 frames touch `@heroui/react`.

**36 of 159 files at block level and above import it directly.** Each of those is a missing atom,
not a shortcut — and not a precedent either. When a block imports a vendor component, that
component's constraints leak into domain code and nothing in the house system can constrain it back.

The specific failure this causes: HeroUI bakes some styles unlayered, so a Tailwind utility written
at the call site **loses silently**. No error, no warning, the class simply does nothing. An atom
that wraps the vendor can encode that; a block that imports it directly cannot.

## When two tiers both fit

Pick the lower one.

Promoting a component later is a rename and a move. Demoting it means every caller that reached for
the higher-tier behaviour now has nowhere to go, and the usual outcome is that the behaviour gets
hand-rolled at each call site instead — which is the state the tier system exists to prevent.
