# gap

## Definition

A gap is the seam between two things that sit on the same track. It is owned by the container
holding them, never by either of them, because the seam is a statement about a RELATIONSHIP and
neither participant can see the relationship from inside itself.

The question a gap answers: **what are these two things to each other?** Not how far apart they
look — how closely they belong. Two seams of the same measurement can mean entirely different
things: a row of controls somebody acts on, and a column of peers with nothing subordinate. That is
why a measurement alone is never the decision.

The one idea that makes an unfamiliar case decidable: **the ladder climbs by grouping.** Ask what
level of grouping the seam separates, then read off the rung. `gap-2` requires BOTH conditions:
the peers are horizontal, and they must be read or operated as one functional cluster. An owner
and what it names, or two units
that remain independently readable, use `gap-3`. Two participants that are each ALREADY a cluster
use `gap-4`, wherever they happen to stand. Wider page and layout seams continue above them.

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

**GAP-7 · Compact horizontal peers in one functional cluster use `gap-2`.**

Eight pixels is the compact seam inside one horizontal unit: an icon beside its label, peer tabs in
one switcher, cards in one horizontal card group, or an input beside the action that operates that
input directly. Both tests matter: the parts share a row AND one function. Two unrelated groups do
not become close peers merely because responsive layout happens to place them on one row.

Fail either test and the seam is `gap-3`. A horizontal row that is not one functional cluster uses
`gap-3`; a vertical stack still uses `gap-3`, except for the feed chronology in GAP-12.

`gap-2` is not the default vertical seam. A label above its card or input names a separate owned
unit and therefore uses `gap-3`; so do consecutive field blocks and a card followed by its muted
caption. A contract may differ only when its `why` proves a genuinely tighter relationship.

**GAP-8 · An owner-to-owned seam or two independent local units use `gap-3`.**

A label and its card, a label and its input, two field blocks, a field group and a policy check, a
policy check and the form submit action, a tab/filter toolbar and the content it governs, or a card
and its `xs muted` caption stay twelve pixels apart. The same is true horizontally when the two
parts are separate semantic groups rather than peers of one control. A child may own an inner
horizontal `gap-2`; the parent owns the single `gap-3` between units. Neither child adds margin to
alter that seam.

In a `SurfaceListCard`, the label, joined surface and whole-list caption/action are separate units
of one named section and use `gap-3` outside the surface. Inside the surface rows use `gap-0`; row
padding owns their vertical rhythm while every divider remains full width.

**GAP-9 · Two participants that are each already a cluster use `gap-4`.**

The rung above the unit seam is reached by what the two participants ARE, never by what encloses
them. `gap-3` separates a unit from a unit: a label from the card it names, a field from the next
field. `gap-4` separates a group from a group — each side is itself composed, each side already
carries its own inner seam, and the seam BETWEEN them must therefore out-rank the seams INSIDE
them. Left at the unit rung, the two groups flatten into one longer run of parts and nothing on the
screen says where the first one ended.

That test is deliberately not written as "inside a card", because the relationship is the same
wherever the pair stands. A portrait stack over the identity stack beneath it, an identity cluster
against the trailing fact it is compared by at the far end of one row, a week run against the
outcome beside it, a prompt against the action that answers it, and peer cards repeating across a
responsive grid are all one rung — a column, a row and a grid do not make three different answers.
Naming the container instead of the participants is exactly how one rung comes to mean one thing
in a card and another thing in a rail, which is the drift this ladder exists to prevent.

It does not climb further on its own. Two groups inside one bounded thing still belong to each
other, which is what separates this rung from the one above it.

**GAP-10 · Two large page blocks use `gap-6`.**

Blocks that each read as a substantial page object — for example two major dashboard sections —
keep the existing 24px seam. Neither `gap-3` nor `gap-4` replaces this rung: those separate units
and groups that still belong to one local section, while these two would each survive on a page of
their own.

**GAP-11 · Consecutive rows of one list use `gap-0`.**

Rows that already state their own vertical hit area and are read as one uninterrupted list do not
add a second seam between row boxes. Dashboard standing figures are the canonical example: streak,
AI credit and reward are one identity list, so their parent is `gap-0`. This is not the sticky
cluster rule: the row padding owns each row's breathing room, while the list owns zero extra space.

**GAP-12 · A toolbar and its result use `gap-3`; a subtle result chronology may use `gap-2`.**

A tab or filter toolbar and the result region it governs are separate operated units, so their
container owns `gap-3`. Inside a feed, temporal labels and their adjacent result cards form one
quiet chronology — `Today`, card, `Yesterday`, card — and that sequence may use `gap-2`. This is a
narrow vertical exception, not permission to make every controlled result compact. If the toolbar
and chronology need different seams, they are two named containers.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| A seam written by whichever element happened to be nearest | The seam then depends on render order rather than on meaning | Let the container that holds both own it |
| A value between rungs | It matches nothing else on any screen, and no one chose it | Move to the nearest rung, deliberately |
| Arithmetic on a step | The rungs are not evenly spaced, so the result lands between them | Name the rung you want |
| A seam picked because the screen looked tight | The next screen with the same relationship gets a different answer | Ask which level of grouping is being separated |
| A resting shape with its own spacing | The layout jumps when real content arrives | Give it the same seam as what it replaces |
| Two different seams inside one container | It is two containers wearing one element | Split it, and name both |
| Choosing a seam from component names or direction alone | Two horizontal things may be one direct control or two independent groups | Use `gap-2` only for horizontal peers in one functional cluster; otherwise use `gap-3` |
| Two composed groups left at the unit rung | Both sides already carry `gap-3` inside them, so nothing on the screen says where the first group ended | Use `gap-4` once each participant is itself a cluster |
| A rung chosen from what encloses the seam — "it is inside a card, so…" | The same relationship then gets one answer in a card, another in a rail and a third in a grid | Choose from what the two participants are, not from what holds them |
| Adding child margin on top of a parent gap | One relationship is counted twice | Let the parent own the one seam |

## Examples

### The ordinary case — the ladder decides

```
horizontal peers in one unit gap-2: one compact functional cluster
consecutive rows of one list gap-0: row padding already owns the rhythm
owner and owned unit         gap-3: label-to-card, label-to-input, card-to-caption
two blocks in one section    gap-3: independent but locally related
two composed groups          gap-4: each side already carries its own inner seam
two large blocks on a page   gap-6: two substantial page objects
two columns of a layout      gap-8: two regions
```

```
label and its input          gap-3 because the label names an owned control below it
input and its direct action  gap-2 only when they share one horizontal control
field and field              gap-3 because each is an independent block
field group and submit       gap-3 because the action belongs to the whole form
tabs and governed content    gap-3 because the switcher and result are separate units
Today, card, Yesterday, card gap-2 as one subtle feed chronology
```

They differ in one thing: whether an unfamiliar case has an answer before anybody looks at it.

### The group rung

```
the week run and the outcome beside it, at gap-4 - the run's own cells sit tighter than the
seam that separates the run from the outcome, so two groups are visibly two
```

```
the same pair at gap-3 - the seam between the groups now matches the seam inside them, and the
cells and the outcome read as one run-on row
```

They differ in one thing: whether the seam between the groups out-ranks the seams inside them.

### The container trap

```
two composed groups take gap-4 whether they stand in a column, at the two ends of one row, or
repeating across a grid
```

```
the same two groups take one seam in a card and a different one in a rail, because the rung was
read off the thing holding them
```

They differ in one thing: whether the rung describes the participants or their container.

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
