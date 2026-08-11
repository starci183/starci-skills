# surface in surface

## Definition

A surface is a bounded region a reader reads as ONE object: it has an edge, a ground of its own, and
everything inside it is claimed to belong together. Drawing one is a statement about grouping, and
the statement is made by the edge rather than by the contents.

This file is about what happens when surfaces meet — nested inside each other, or stacked against
each other — and it is STRICT because both failures look like styling and are not. A border says
*these things belong together and those do not*. Two surfaces touching therefore claim a boundary
that is not there, and a surface inside a surface claims a level of grouping that does not exist.

The question that settles every case: **does this region deserve to be a bounded object?** One item,
one content section, one list of choices: yes. A single action, one navigation link, one line of
metadata: no. Reach for space before an edge, and for an edge before a box.

The mechanical overlay subset is held by
[`sources/fe/vendor-boundary.mjs`](../../sources/fe/vendor-boundary.mjs): an overlay file cannot
import a named surface branch, and ModalShell cannot force uninterpreted content through a vendor
body wrapper. The wider visual judgement remains a design review because a transitive child can
draw an edge without its overlay importer naming that child as a surface.

## Rules

**SURFACE-1 · Never stack two bordered surfaces directly against each other.**

Two boxes touching read as one heavy block with a seam in it, and the eye cannot find where the first
group ends. This is the common-region principle working against the layout: the reader trusts the
edges, and the edges are lying.

Three shapes are correct instead, and which one depends on what the second thing IS. A secondary
action becomes a flat link, not a box. Secondary content belonging to the same group merges into the
surface above it. Two genuine peers each keep their own surface and sit a full section apart, each
carrying its own name, so the page reads as two regions rather than two boxes.

**SURFACE-2 · A surface inside a surface is one surface too many.**

If the outer region is already bounded, the inner one has nothing left to say: it is claiming a level
of grouping the reader has already been given. Either the inner region drops its ground and its edge,
or the outer one does. Both cannot be right, and the pair drawn together is the most common reason a
screen reads as cluttered while every individual element looks correct.

The commonest legitimate case is a section whose contents are THEMSELVES surfaces. There the outer
region keeps its name and drops its edge, so the run of inner surfaces reads as the section's body
rather than as boxes inside a box.

**SURFACE-3 · A section's name sits OUTSIDE the surface it names.**

Holding the name inside the edge forces every section whose contents are already bounded to draw a
box around boxes. Held outside, the same section works whether its body is a plain run of rows or a
grid of surfaces, and the name-to-surface seam is tighter than the seam between sections — because
the name and what it names are one object.

**SURFACE-4 · A bounded region inside an already-bounded overlay draws no second edge.**

A dialog, a drawer, a popover: each is already a surface, and it is already separated from everything
behind it. Content inside one is laid out with space and names, never with a further box. A summary
panel inside a dialog is a heading and a run of rows, not a card.

**SURFACE-5 · A single action is never wrapped in a surface of its own.**

An action is not a group, so an edge around it claims something untrue and gives it a weight it did
not earn. A primary action sits flat: inside the surface it belongs to, or in the flow of the page
when the surfaces around it are peers.

**SURFACE-6 · Splitting into several surfaces and merging into one are BOTH legal, and the choice is
per screen.**

There is no rule of always-split or always-merge, and reversing an earlier decision is a response to
a changed screen rather than a mistake. What is not legal is one surface per control: a surface holds
a meaningful GROUP, and a lone control inside an edge is thin and unearned.

**SURFACE-7 · Inside a merged surface, at most ONE divider.**

A divider separates two large clusters of meaning and nothing smaller. More than one turns the
surface into a stack of pretend-surfaces, which is SURFACE-1 again in a thinner disguise. Everything
below that scale is separated by space and by names.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Two bordered surfaces stacked directly | They read as one heavy block with a seam, and the boundary they claim is not real | A flat link, a merge into the surface above, or a full section apart |
| A bounded region inside a bounded region | The inner edge claims a level of grouping the reader already has | Drop the inner edge, or drop the outer one |
| A section name held inside the surface it names | Every section whose body is already bounded must then draw a box around boxes | Hold the name outside the surface |
| A surface drawn inside a dialog, drawer or popover | The overlay is already the boundary; a second one competes with it | Space and a heading |
| A surface around one action | An action is not a group, and the edge grants weight it did not earn | Let it sit flat |
| One surface per control | A surface holds a meaningful group; a lone control is thin and unearned | Group controls by meaning |
| Two or more dividers inside one surface | It becomes a stack of pretend surfaces | One divider at most; space and names below that |
| An edge added because the region looked unfinished | The edge is being used as decoration, and it makes a claim about grouping regardless | Space first, then an edge, then a box - in that order |

## Examples

### The stacking trap

```
a bordered list of the ordinary choices, and the exception below it as a flat link with a caret
```

```
a bordered list of the ordinary choices, and a second bordered surface below it for the exception
```

They differ in one thing: whether the exception claims equal standing with the rule it is an
exception to.

### The nesting trap

```
a named section whose body is a run of surfaces: the section keeps its name and draws no edge
```

```
the same section drawn as a surface, so the run of surfaces sits inside a box
```

They differ in one thing: how many edges claim the same grouping.

### The lone-control trap

```
one surface holding what to measure - the metric and the range together, because they are one
decision
```

```
one surface holding the metric, and another holding the range
```

They differ in one thing: whether the edge encloses a group or a control.

### The overlay trap

```
inside a dialog: a heading, then a run of rows
```

```
inside a dialog: a surface holding a heading and a run of rows
```

They differ in one thing: whether the dialog's own boundary was counted.
