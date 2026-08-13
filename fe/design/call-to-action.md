# call to action

## Definition

A call to action is the point where a surface asks for the one thing it wants. It is not a button
style. How many there are, where it sits, when it fires and what it says all follow from the ask
itself, and every one of them is decided before any styling question comes up.

The test that settles it: **each surface has exactly ONE primary action, fired at the moment the
reader has both the motivation and the ease to take it, and the words name the OUTCOME rather than
the mechanism.**

This file is STRICT because each failure below is one that looks harmless at the call site and costs
the surface its point: a second primary does not double the response, it splits it.

## Rules

**CTA-1 · One primary action per surface. Everything else drops a tier.**

Two actions of equal weight side by side do not present a choice, they present a delay: the time a
reader takes to choose rises with the number of equally weighted options, and two equal primaries are
exactly that. The primary is the largest, carries the forward marker, and is alone. Every other
action on the surface is secondary or tertiary.

**CTA-2 · The primary belongs to whatever the product exists to let people DO.**

The core loop owns the primary everywhere it appears. Ancillary offers, upsells and add-ons are
secondary wherever they sit, however well they convert — because the way they convert is by borrowing
the attention of the real primary, and a surface that lets them is one that has stopped being about
its own job.

**CTA-3 · The call to action sits in the surface's action anchor, and nowhere else.**

The anchor is the hero, or the persistent bar at the foot of a long surface, or the slot beside the
heading. Anything else placed in that slot — a refresh control, a toolbar button — quietly claims a
weight it did not earn, and the real primary now competes with furniture.

**CTA-4 · Fire where motivation and ability meet.**

An action succeeds when the reader wants the outcome, can reach it easily, and is prompted at that
moment. Two of the three are usually already lost. Do not ask before the value has been seen — a
reader who has just arrived has no motivation to spend. Do not ask when the path is vague or long —
the destination has to be one the reader can already picture.

The strongest moment is a COMPLETION: the point where a piece of work has just finished, motivation
is at its peak, and an unfinished thing still holds attention. This is also exactly where a second
primary tends to appear, for the same reason. One of the two has to drop a tier, and it is not the
one the surface is for.

**CTA-5 · The words name what the reader will HAVE, not what the system will do.**

Outcome framing tells a reader what they get. Mechanism framing tells them what they spend, which is
the argument against acting stated in the button. "Get the report" rather than "Run query". A label
naming a cost, a resource or an internal verb is a label written from the system's side of the
screen.

**CTA-6 · A generic destination is a weaker ask than a specific one.**

Pointing back at the surface the reader just left is the default that survives every review and
converts worst. The version that works points at the specific next thing the last action produced a
reason to want.

**CTA-7 · Subordinate actions read as subordinate at a glance.**

Retry, view details, go back: tertiary, not large, and carrying no forward marker. A subordinate
action wearing the primary's marker competes for the same click, and a reader who takes the wrong one
has been misled by the surface rather than by their own error.

**CTA-8 · Every surface offers at least one path onward.**

A surface with no next step is a dead end, and a reader who reaches one leaves the product rather
than the screen. The path onward is not always a primary action — it can be a link back into the
core loop — but its absence is never correct.

**CTA-9 · Priority and physical size are separate decisions.**

The appearance answers how strongly the product recommends an action; the physical size answers
where that action lives. An action embedded among the content of a row or compact control cluster
uses the compact control size because it is a peer of that content. An action that owns a line or
anchors a form or surface uses the resting control size. Label length does not choose either, and a
subordinate appearance does not grant permission to compress a control below the house geometry.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Two actions of equal weight on one surface | They split the response rather than doubling it, and cost the reader a decision | One primary; drop the other a tier |
| An upsell as a primary at a completion moment | It converts by taking the attention the real primary earned | Make it secondary, or move it off the surface |
| A refresh or toolbar control in the action anchor | It claims the weight of a primary without being one | Put it where its weight belongs |
| Asking before the value has been seen | Motivation is not there yet, and the ask teaches the reader to ignore asks | Fire at a completion moment |
| A label naming the mechanism, a cost or a resource | It states the argument against acting, in the button | Name the outcome the reader will have |
| A primary pointing back where the reader just came from | The destination is one they have already rejected | Point at what the last step gave them a reason to want |
| A subordinate action carrying the forward marker | It competes for the click the primary needs | Tertiary, small, no marker |
| A surface with no path onward | The reader leaves the product rather than the screen | Give it one, even if it is only a way back into the loop |
| Choosing size from variant or label length | Priority, wording and placement are different decisions, so coupling them makes identical roles render differently | Choose appearance from priority and size from placement |
| Hand-shrinking an embedded action | It creates a one-off hit target and visual rhythm outside the component system | Use the compact size owned by the button component |

## Examples

### The split-attention trap

```
one large primary naming the next concrete thing, and one quiet tertiary for looking back
```

```
one large primary naming the next thing, and a second large action offering an upgrade
```

They differ in one thing: whether the surface still asks for one thing.

### The framing trap

```
Get the report
```

```
Run query
```

They differ in one thing: whether the label describes what the reader ends up holding.

### The destination trap

```
after a run that measured a weak area: an action pointing at that specific area
```

```
after the same run: an action offering to try again, pointing at the surface just left
```

They differ in one thing: whether the reader has a reason to want the destination.

### The anchor trap

```
the slot beside the heading holds the surface's primary action
```

```
the slot beside the heading holds a refresh control, and the primary sits further down
```

They differ in one thing: which action the position claims is the important one.

### The size trap

```
a tertiary reaction inside an activity row, using the house compact button size
```

```
the same reaction with custom padding added until it looks smaller
```

They differ in one thing: whether placement selects a system size or invents a local one.
