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
use `gap-4`, wherever they happen to stand. Wider page and layout seams continue above them, and
beneath them all sits `gap-1` for the two lines of a single identity. The ladder has no zero rung:
a container that wants no seam declares none.

## Rules

**GAP-1 · The measurement is a step on a ladder, not a size.**

The rungs are an ordered list, not a unit, and they are not evenly spaced — the lower steps advance
by four and the upper ones by eight. That has one immediate consequence worth stating: **a rung is
read off, never computed.** Adding to a step usually lands between rungs, and where the arithmetic
happens to land on one it landed there by coincidence, not because anybody asked what the seam
separates. A value nobody chose by relationship matches nothing else on the screen even when it
measures the same.

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

**GAP-4 · There is no zero rung; the smallest declared seam is `gap-1`.**

Zero is not the bottom of the ladder — it is standing off the ladder, and a container that wants no
seam says so by declaring none at all rather than by naming a rung that measures nothing. A joined
list whose rows already own their vertical hit area is the case: the rows touch, every divider runs
full width, and the container carries no gap class.

The rung that does exist beneath the compact seam is four pixels, and it holds exactly one
relationship: **two lines of ONE identity.** A name over the handle beneath it, a figure over the
word that labels it, a title over its muted subtitle, a price over the caption qualifying it. The
second line does not state a second fact; it qualifies the first, and four pixels is what says so
without letting the pair drift into two rows.

A written zero and a written `gap-1` are the same distinction as "touching" and "almost touching",
and that is not a distinction a second author reproduces from memory — one identity stack ends up at
each value and the product stops looking like one product. Naming only one of them is what closes
that.

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
of one named section and use `gap-3` outside the surface. Inside the surface the rows declare no
seam at all; row padding owns their vertical rhythm while every divider remains full width.

**GAP-9 · A container holding composed participants uses `gap-4`.**

The rung above the unit seam is reached by what the participants ARE, never by what encloses them.
`gap-3` separates a unit from a unit: a label from the card it names, a field from the next field.
`gap-4` is what a container owns once its children are read as SECTIONS rather than as parts —
once at least one participant is itself composed and carries its own inner seam, the container's
seam must out-rank that inner seam. Left at the unit rung, the section and its own contents are
separated by the same measurement and nothing on the screen says where the section ended.

The test is the container's level of grouping, not a tally of its children. A section list that
closes with one standalone action — a rail ending in its buy button, a standing card ending in the
action that changes the standing — is still a container of sections; a single trailing leaf does not
pull it down a rung, because the seam is one decision about the whole container rather than a
different answer per pair. This follows from GAP-6: a container has one seam, so it is chosen at the
level the container reads at.

The commonest case is a run of small blocks doing ONE job inside one block: the fields of a form,
each holding a label over its control. The field owns `gap-3` between its own two parts, so the form
owns `gap-4` between fields — otherwise a label belongs to the control above it as readily as to the
one below, and the reader has to work out which.

**A boundary that is DRAWN does not also need to be spaced.** Where a rule, divider or separator
already closes one group before the next begins, the seam is carrying no information the reader
lacks, and it stays at the unit rung — a sign-in surface separating its OAuth shortcuts from its
credential form by an OR divider keeps `gap-3` across that divider while the credential form spaces
its own fields at `gap-4`. This is the one place a container may sit below the rung of something
inside it, and it is not the ladder inverted: the boundary was stated twice and one statement was
removed, not weakened.

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

**GAP-11 · Consecutive rows of one list declare no seam at all.**

Rows that already state their own vertical hit area and are read as one uninterrupted list do not
add a second seam between row boxes. Dashboard standing figures are the canonical example: streak,
AI credit and reward are one identity list, so their parent names no gap class. This is not the
sticky cluster rule: the row padding owns each row's breathing room, while the list owns nothing.

Writing a zero rung here instead is what GAP-4 refuses. It looks like the same result and is not the
same statement: a named zero invites the next reader to read it as the tightest rung and to reach for
the one below it when a list feels cramped, and there is no rung below it.

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
| A written zero rung | Zero is not the bottom of the ladder but a step off it, and naming it invites the next reader to look for the rung below | Declare no gap class at all |
| Two lines of one identity given the compact rung | `gap-2` separates two facts; the qualifying line is not a second fact | `gap-1`, the one rung that means a single identity |
| Adding child margin on top of a parent gap | One relationship is counted twice | Let the parent own the one seam |

## Examples

### The ordinary case — the ladder decides

```
consecutive rows of one list (none): row padding already owns the rhythm
two lines of one identity    gap-1: a name over its handle, a figure over its label
horizontal peers in one unit gap-2: one compact functional cluster
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

### The identity rung

```
a name over the handle beneath it at gap-1 - the handle qualifies the name, and one rung says so
```

```
the same pair at gap-3, the seam between owned units - now they read as two separate facts
```

They differ in one thing: whether the pair is one identity or two.

### The zero trap

```
a joined list whose rows own their own hit area declares no gap class, so the rows touch and
every divider runs full width
```

```
the same list declares gap-0 - it renders identically and tells the next reader there is a
tightest rung, so the next cramped list reaches for one below it
```

They differ in one thing: whether the ladder appears to have a bottom step that does not exist.

### The resting-shape trap

```
the placeholder rows sit at the same seam as the real rows, so nothing moves when data lands
```

```
the placeholder rows sit tighter, so the whole surface shifts down at the moment of arrival
```

They differ in one thing: whether the reader's eye has to re-find its place.
