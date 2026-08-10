# margin

## Definition

A margin is space a child holds outside itself. There is no scale of allowed margins here, and that
absence is the rule rather than an oversight.

The reason is not the number. It is the **direction of the decision**. Space between two things is a
statement about a relationship, and a child cannot see the relationship it is in — it can only see
itself. A child that pushes its neighbour away has made a claim about a sibling it has never met.
Move that child into a different surface and the claim moves with it: still applied, now describing
two things that were never compared.

So a margin written as a measurement is a seam authored by the wrong owner, and a margin on the
correct rung is still wrong. The fix is never a smaller number; it is to give the space back to the
container between the two things, where it can be named once and read by everybody.

What survives is a small, separate idea that shares the property name and nothing else: **alignment
against the space that is left over.** An automatic margin does not push a neighbour — it absorbs
free space, which is a statement about the child's own position in its container and nothing about
its siblings.

## Rules

**MARGIN-1 · A measured margin is a seam with its ownership inverted.**

Whatever the number, the wrong file decided it. The container between two things is the only place
that can see both, so it is the only place the seam can be stated once and stay true when either
side changes.

**MARGIN-2 · Automatic margins survive, because they say something different.**

Pushing one child to the far end of a row, sinking a footer to the bottom of a column whatever the
content height, centring a reading column in the space it was given: none of these is a claim about a
sibling. Each is a claim about how this child sits in the room it was handed, and there is no other
property that expresses it. That is the whole of the exemption, and it is why it is an exemption
rather than a loophole.

**MARGIN-3 · A one-sided space is almost always a different problem wearing margin's clothes.**

A single edge of space is usually a surface compensating for a border it did not want, or for a
neighbour that should have owned the seam. Both have real fixes. Neither of them is a margin, and
reaching for one buries the actual cause where the next reader will not find it.

**MARGIN-4 · Space applied to every child but the first is a seam with the ownership inverted.**

The pattern that gives each child except the first some space above it produces the same rendering as
a seam owned by the container, and it breaks the first time one child is conditionally absent — the
surviving first child now carries space nobody asked for, or the run opens with a gap that leads
nowhere. It is a seam, so it belongs to the container.

**MARGIN-5 · Negative space to undo a parent's inset means the wrong element owns the inset.**

Pulling a child back out past its parent's padding is a child correcting a decision made above it.
The correction is invisible from where the decision was made, so the two drift apart the moment
either changes. The element that draws the surface should not have padded it, or the child should not
be inside it.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| A measured margin between two siblings | The child is deciding a relationship it cannot see | Give the seam to the container that holds both |
| A measured margin on the correct rung | Being on the ladder does not fix who decided it | Same |
| Space on every child but the first | It is a seam with inverted ownership, and it breaks when a child is absent | Same |
| A single-edge space to fix a crowded look | The cause is a border or a seam elsewhere, and it stays hidden | Fix the surface or the seam that actually caused it |
| Negative space to escape a parent's inset | Two elements now disagree about who owns the surface | Move the inset, or move the child out |
| An automatic margin used to make a gap | It absorbs whatever is left over, so the space changes with the content | Use a seam owned by the container |

## Examples

### The ownership trap

```
the container between the two children states the seam once
```

```
the second child carries space above itself, so it pushes the first away
```

They differ in one thing: whether the space survives moving the child into a different surface.

### The exemption — absorbing what is left over

```
one control is pushed to the trailing end of a row by taking up the free space before it
```

```
one control is pushed to the trailing end by a fixed measurement that happens to reach
```

They differ in one thing: whether the position still holds when the row gets wider.

### The all-but-first trap

```
the container owns the seam, so a run of two and a run of five look the same
```

```
each child but the first carries space above it - remove the first child conditionally and the
run now opens with space leading nowhere
```

They differ in one thing: what happens when a child is not rendered.

### The negative-space trap

```
the element that draws the surface does not pad the region a full-bleed child occupies
```

```
the child pulls itself back out past the padding its parent applied
```

They differ in one thing: whether two elements disagree about who owns the surface.
