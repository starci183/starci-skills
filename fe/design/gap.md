# gap

## Definition

A gap is the seam between two things that sit on the same track. It is owned by the container
holding them, never by either of them, because the seam is a statement about a RELATIONSHIP and
neither participant can see the relationship from inside itself.

The question a gap answers: **what are these two things to each other?** Not how far apart they
look — how closely they belong. Two seams of the same measurement can mean entirely different
things: a row of controls somebody acts on, and a column of peers with nothing subordinate. That is
why a measurement alone is never the decision.

The one idea that makes an unfamiliar case decidable: **the ladder climbs by grouping.** Each level
of seam is one step wider than the thing it wraps. Ask what level of grouping the seam separates,
then read off the rung. A seam between a label and its control is tighter than a seam between two
groups of fields, which is tighter than a seam between two blocks on a page, which is tighter than
the seam between two columns of a layout.

## Rules

**GAP-1 · The measurement is a step on a ladder, not a size.**

The rungs are an ordered list, not a unit, and they are not evenly spaced. That has one immediate
consequence worth stating: **there is no arithmetic on a step.** Two steps of the smallest seam do
not make the next one up, and a value computed by adding to a step lands between rungs — where it
matches nothing else on the screen and nobody chose it.

A ladder with few rungs is the point. Every additional rung is another decision a reader has to make
and another way two screens that should match can differ.

**GAP-2 · The seam belongs to the container, and only to the container.**

A child that pushes its neighbour away has made a claim about a sibling it cannot see. Move that
child into a different container and the claim travels with it — still applying, now wrong. The
number was never the problem; the direction of the decision was.

**GAP-3 · A seam is chosen by what it separates, never by how it looks.**

"This looked a bit tight" is how a screen acquires a rung nothing else uses. The question is always
which level of grouping is being separated, and the answer is the same in every screen that
separates that level. This is what makes two surfaces built by two people look like one product.

**GAP-4 · Zero is a decision, not the absence of one.**

Two lines of one identity — a name over the handle beneath it — are one thing. A seam between them
would claim they are two, and a reader would believe it. Choosing zero deliberately is different
from never having asked, and the difference shows up the moment somebody "fixes" the missing space.

**GAP-5 · A resting shape declares the same seam as the thing it stands in for.**

A loading placeholder that spaces its rows differently from the real ones makes the layout jump when
the data lands. The resting shape is the same shape, drawn without content — not a second shape that
happens to occupy the same region.

**GAP-6 · One seam per container.**

A container that wants two different seams between different pairs of its children is two containers.
Splitting it costs one element and makes both seams nameable; joining them costs an exception that
every future reader has to hold in their head.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| A seam written by whichever element happened to be nearest | The seam then depends on render order rather than on meaning | Let the container that holds both own it |
| A value between rungs | It matches nothing else on any screen, and no one chose it | Move to the nearest rung, deliberately |
| Arithmetic on a step | The rungs are not evenly spaced, so the result lands between them | Name the rung you want |
| A seam picked because the screen looked tight | The next screen with the same relationship gets a different answer | Ask which level of grouping is being separated |
| A resting shape with its own spacing | The layout jumps when real content arrives | Give it the same seam as what it replaces |
| Two different seams inside one container | It is two containers wearing one element | Split it, and name both |

## Examples

### The ordinary case — the ladder decides

```
label and its control        tightest: one names the other
two groups of fields         wider: two things, one surface
two blocks on a page         wider still: two objects
two columns of a layout      widest: two regions
```

```
label and its control        chosen by eye
two groups of fields         chosen by eye
two blocks on a page         chosen by eye
```

They differ in one thing: whether an unfamiliar case has an answer before anybody looks at it.

### The ownership trap

```
container: the seam sits between the two children, in the element that holds them.
```

```
child: the second one carries space above itself, so it pushes the first away.
```

They differ in one thing: whether the decision survives moving the child somewhere else.

### The zero trap

```
a name directly over the handle beneath it - one identity, so the two lines touch
```

```
a name over its handle with the default seam between them - now they read as two facts
```

They differ in one thing: whether the pair is one thing or two.

### The resting-shape trap

```
the placeholder rows sit at the same seam as the real rows, so nothing moves when data lands
```

```
the placeholder rows sit tighter, so the whole surface shifts down at the moment of arrival
```

They differ in one thing: whether the reader's eye has to re-find its place.
