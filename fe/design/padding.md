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

**PADDING-7 · A card uses `p-4`; a joined-list card distributes that inset across its rows.**

An ordinary Card holds its content with `p-4`. A `SurfaceListCard` sets both the vendor Card root
and its content host to `p-0`; it cannot put that padding around
the list root because doing so would inset the dividers. Its surface and contract root therefore
use `p-0`, and the rows recreate the card edge while keeping the interior seam tight:

If the global vendor override owns Card padding with `!important`, a plain `p-0` class is not proof
that the inset is gone. The branch marks the root as
`data-component="SurfaceListCardSurface"`, and the theme carries the equally strong semantic
override `.card[data-component="SurfaceListCardSurface"] { padding: 0 !important; }`. UI
verification reads computed padding from the rendered test-account page; a class assertion alone
does not close this rule.

- one row: `p-4`;
- first row: `px-4 pt-4 pb-3`;
- middle rows: `px-4 py-3`;
- last row: `px-4 pt-3 pb-4`.

The divider remains full-width between direct row children. The top and bottom edges still breathe
at the Card's 16px inset; each row carries the 12px reading rhythm beside an interior divider.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| An inset a caller can set | The surface has two authors, and the same surface differs by screen | Give the surface a named variant if it genuinely has two shapes |
| An inset tighter than the seams inside it | The surface reads as crowded whatever the numbers are | Match the inset to the interior seam |
| A symmetric inset on a control holding one line | The right and wrong shapes both sit on the ladder, so nothing catches it | Pad the horizontal wider than the vertical |
| An inset added to push a neighbour away | The fix lands in a surface unrelated to the problem | Give the seam to whatever holds both |
| A single padded edge with no stated reason | It is usually compensation, and the real cause stays hidden | Fix the cause, or write the reason beside it |
| A padded surface inside a padded surface | The distance is one neither author chose | Decide which of the two draws the surface |
| `p-4` on the content wrapper of a joined list | It pulls every divider 16px away from the surface edge | Put `p-0` on the list root and distribute the edge inset through first/middle/last row padding |
| One padding value on every joined-list row | Either the outer edge is too tight or the interior rhythm is too loose | Use the first/middle/last matrix from PADDING-7 |

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

### The joined-list exception

```
surface p-0
first row   px-4 pt-4 pb-3
divider     full width
middle row  px-4 py-3
divider     full width
last row    px-4 pt-3 pb-4
```

```
surface p-4
all rows p-2
divider inset with the list
```

They differ in one thing: whether the 16px card edge is preserved without pulling the peer
divider away from the surface edge.

### The select-like row rule

A compact group of peer rows that visually behaves like a select or navigation list gives `p-2`
to every row, not to the group container. The parent owns only grouping (`p-0`, usually `gap-0`);
each row owns its complete icon-label-value hit area and therefore its own inset.

```text
group       p-0 gap-0
each row    p-2
```

Putting one `p-2` on the group is not equivalent: it creates an outer frame while leaving each
element without the select-like geometry shared by neighbouring list items.

### The neighbour trap

```
the container between two surfaces owns the space between them
```

```
one surface grows its own inset until it stops looking crowded next to the other
```

They differ in one thing: whether the fix is in the file that has the problem.
