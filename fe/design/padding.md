# padding

## Definition

Padding is the inset a surface keeps between its edge and what it holds. It is owned by whatever
draws the surface, because the inset is a property of the surface itself rather than of anything
inside it.

Padding answers a different question from a seam, and the two must never borrow each other's
reasoning by accident. A seam asks *what are these two things to each other*. Padding asks **how
tightly does this surface hold what it contains** — a question with one participant, which is exactly
why the answer belongs to that one participant.

The rule that ties the two together: **a surface's inset matches the seam between the groups inside
it.** A surface holding groups breathes at the rhythm of its contents, so its edge and its interior
agree. When they disagree the surface reads as either a frame squeezing its contents or a box its
contents are rattling around in, and no single measurement is at fault — the relationship between two
of them is.

## Rules

**PADDING-1 · The surface owns its inset; a caller never sets it.**

A caller who can retune the inset has become the surface's second author, and the two never speak. It
also makes the surface unpredictable from its name: two of the same thing on two screens now hold
their contents differently, and a reader cannot tell which is the real one.

**PADDING-2 · The inset matches the seam between what the surface holds.**

This is the one relationship that makes an unfamiliar surface decidable. Find the seam between the
groups inside it, and the edge takes the same measure. A surface whose inset is tighter than its
interior seams reads as crowded no matter how generous the individual numbers are.

**PADDING-3 · A surface that holds one line pads asymmetrically, and the horizontal is the larger.**

Text runs sideways. A control holding short words needs more room at the ends of the line than above
and below it, because the eye measures the distance to the nearest edge and the nearest edge on a
short line is the side. A symmetric inset on a control reads as too tall, and the usual response —
reducing both — makes it too tight instead.

This is why a single measurement cannot describe a control. An inset applied equally on both axes
passes any check that only asks whether the value is on the ladder, and is still the wrong shape.

**PADDING-4 · Padding is not how a surface makes room for a neighbour.**

Reaching for an inset because the thing next to this one is too close puts the fix inside a surface
that has nothing to do with the problem. The space between two things is theirs, and it belongs to
whatever holds them both.

**PADDING-5 · A single padded edge is a decision that needs a reason beside it.**

Occasionally a surface genuinely holds something on one side only — a leading marker, a trailing
control laid over the edge. Far more often, a single padded edge is compensating for something else,
and it is the compensation that should have been fixed. If the reason cannot be written in a clause,
it is the second case.

**PADDING-6 · Nested insets multiply, and the inner one is usually the mistake.**

A padded surface inside a padded surface produces a distance neither author chose and neither can
see. When contents sit further in than expected, the question is which of the two surfaces should
have been plain — not what number to subtract.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| An inset a caller can set | The surface has two authors, and the same surface differs by screen | Give the surface a named variant if it genuinely has two shapes |
| An inset tighter than the seams inside it | The surface reads as crowded whatever the numbers are | Match the inset to the interior seam |
| A symmetric inset on a control holding one line | The right and wrong shapes both sit on the ladder, so nothing catches it | Pad the horizontal wider than the vertical |
| An inset added to push a neighbour away | The fix lands in a surface unrelated to the problem | Give the seam to whatever holds both |
| A single padded edge with no stated reason | It is usually compensation, and the real cause stays hidden | Fix the cause, or write the reason beside it |
| A padded surface inside a padded surface | The distance is one neither author chose | Decide which of the two draws the surface |

## Examples

### The matching rule

```
a surface holding two groups: the edge takes the same measure as the seam between the groups
```

```
a surface holding two groups: the edge is tighter than the seam, so the contents crowd the frame
```

They differ in one thing: whether the edge breathes at the rhythm of the interior.

### The control trap

```
a control holding one short line: wider at the ends of the line than above and below it
```

```
the same control, padded equally on both axes - on the ladder, and the wrong shape
```

They differ in one thing: which axis the eye measures on a short line.

### The nesting trap

```
the surface draws the inset; the run inside it is plain
```

```
the surface draws an inset and each row inside draws its own, so contents sit twice as far in
as either author intended
```

They differ in one thing: how many elements think they are drawing the surface.

### The neighbour trap

```
the container between two surfaces owns the space between them
```

```
one surface grows its own inset until it stops looking crowded next to the other
```

They differ in one thing: whether the fix is in the file that has the problem.
