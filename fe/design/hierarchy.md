# hierarchy

## Definition

Hierarchy is the order a surface is read in. Every surface has one whether or not anybody chose it,
because a reader takes the most legible thing first and the rest in the order the surface makes
easy. Designing hierarchy is deciding that order deliberately instead of inheriting it from the
sequence the markup happened to be written in.

It is not the same decision as the call to action. The
[call to action](call-to-action.md) settles what the surface ASKS for; hierarchy settles what the
reader UNDERSTANDS, and in what sequence, including everything that asks for nothing. A surface can
have a perfectly chosen primary action that nobody reaches, because three other things were read
first.

The test that settles it: **a reader who leaves after the first two elements should still have the
point of the surface, and the order in which they took them should be the order the task needs.**

This file is STRICT. Every failure below survives review easily, because each one looks like a
local styling choice at the call site and only becomes visible as a wrong reading order once the
whole surface is on screen.

## Rules

**HIERARCHY-1 · Decide the reading order before anything is styled.**

Name what is read first, second and third, and why the task needs that sequence. This is a product
decision and it is cheap while it is still a sentence. Made later it stops being a decision at all:
once type, weight and spacing are in place, the order already exists, and every subsequent change
is an argument against something already on screen rather than a choice between alternatives.

**HIERARCHY-2 · Emphasis is a budget, and it is spent from a fixed total.**

Prominence is relative and nothing else. A thing is prominent because its neighbours are not, so
emphasis added everywhere cancels: a surface where the heading, the value, the label and the badge
all press forward has no first element, and the reader picks one by accident. Adding emphasis to
one thing therefore always means removing it from another, and if nothing was demoted, nothing was
prioritized.

**HIERARCHY-3 · One thing leads, and it is what the surface exists for.**

A single element is read first. Choose which one, and make everything else visibly step down from
it. Two elements competing for the lead do not present two important things; they present a delay
while the reader decides where to start, and the surface has already spent its first moment on a
question it created.

**HIERARCHY-4 · Rank is carried by position and size first, and by colour last.**

Position and size are read before anything else and survive conditions that colour does not: dark
mode, a low-contrast display, a reader who does not separate those hues, a screenshot in a
document. Colour and weight are for saying what KIND of thing something is — a warning, a link, a
disabled control — not for saying how important it is. A hierarchy that exists only in colour is
one that disappears exactly when the reader is least able to recover it.

**HIERARCHY-5 · The visual order and the source order are the same order.**

A keyboard reader, a screen reader and a narrow viewport all take the surface in source order. When
the visual lead is positioned above an element that precedes it in the source, the product has two
different reading orders and only one of them was designed. Reorder the source and let the layout
follow, rather than lifting an element visually over its neighbours.

**HIERARCHY-6 · Rank inside a group; group before you rank.**

Ranking assumes the reader sees the items as one set. Until grouping is established — by proximity,
by a shared ground, by a boundary the eye can find — an emphasized item does not read as the most
important of several, it reads as unrelated to what surrounds it. Grouping is a claim about what
belongs together and is governed by [surface in surface](surface-in-surface.md); hierarchy operates
inside whatever that claim has established.

**HIERARCHY-7 · Size states importance, so size may not be chosen to make something fit.**

When a long title drops a step so it stays on one line, the surface has just told the reader that
this title matters less than a shorter one elsewhere — a claim nobody made and nobody would defend.
Fit is solved by wrapping, by truncating with the whole value still reachable, or by shortening the
content. Rank chooses the size; the space adapts to it.

**HIERARCHY-8 · The order holds across every state the surface can enter.**

Loading, empty, partial and failed are the same surface, and the reader should not have to relearn
where to look each time one resolves into another. A populated surface that becomes one centred
spinner while it loads has thrown away its hierarchy and rebuilds it in front of the reader.
Preserve the resting order and change only what is genuinely unresolved, which is the same reason
[loading](../canon/patterns/loading.md) rests the final shape.

**HIERARCHY-9 · Depth is shallow, and each level is unmistakable.**

A reader tracks a lead, its support and its detail. Levels beyond that are not perceived as levels;
they are perceived as noise with slight variations, and the reader falls back to reading everything
in sequence. Two adjacent levels that differ only slightly are worse than no distinction at all,
because the difference is visible enough to look intentional and not visible enough to be usable.

**HIERARCHY-10 · A section names its point, not its contents.**

The reader scanning headings is deciding where to stop, and a heading naming the mechanism or the
component tells them nothing to decide with. The heading is part of the hierarchy rather than a
label attached to it: it is frequently the second thing read, and a heading that could sit above
any surface has spent that position on nothing.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Emphasize every element on a surface | Prominence is relative, so emphasis everywhere leaves no first element and the reader starts at random | Choose one lead and demote everything else until the difference is obvious |
| Carry rank in colour alone | It vanishes in dark mode, in low contrast, for a reader who does not separate the hues, and in any greyscale copy | Carry rank in position and size; let colour say what kind of thing it is |
| Position the visual lead above an element that precedes it in the source | Keyboard and narrow-viewport readers take the source order, so the product ships two different reading orders | Reorder the source and let the layout follow |
| Drop an element a size step so a long value fits | Size is a statement about importance, so fitting makes a claim about rank that nobody decided | Wrap, truncate reachably, or shorten the content |
| Add a level whenever a new kind of content appears | Levels the reader cannot tell apart read as noise, and they fall back to reading everything | Fit it into lead, support or detail, or question whether it belongs on this surface |
| Replace the surface with a single loader while it resolves | The reader relearns where to look every time the state changes | Rest the same order and skeleton only the unresolved values |
| Rank items before they read as one group | An emphasized item among ungrouped items reads as unrelated rather than as first | Establish the grouping, then rank inside it |
| Write a heading that names the component or the mechanism | A reader scanning headings is choosing where to stop and has been given nothing to choose with | Name the point the section makes |

## Examples

### The lead

```
the surface opens with the fact the reader came for, and the section title sits quietly above it
```

```
the surface opens with the section title, and the fact the reader came for sits third
```

They differ in one thing: whether the first thing read is the reason the reader opened the surface.

### The emphasis budget

```
one emphasized value in the row, with its label and its delta kept quiet
```

```
the value, its label and its delta all emphasized so none of them is missed
```

They differ in one thing: whether the emphasis still points at anything.

### The channel

```
rank carried by position and size, with colour reserved for saying which values are warnings
```

```
rank carried by colour, with every value at the same size and position
```

They differ in one thing: whether the order survives a reader who cannot use the colour.

### The two orders

```
the element read first is also the first element in the source
```

```
the element read first is lifted into place above the element that precedes it in the source
```

They differ in one thing: whether the keyboard reader and the sighted reader are given the same
surface.

### The fit trap

```
a long title wraps to a second line at the size its rank chose
```

```
a long title drops to the next size down so that it stays on one line
```

They differ in one thing: whether size still means importance.

### The state trap

```
while it loads, the surface keeps its order and skeletons only the values not yet known
```

```
while it loads, the surface becomes one centred spinner and rebuilds itself when it resolves
```

They differ in one thing: whether the reader has to find their place again once the data arrives.

### The heading

```
a heading naming what the section lets the reader conclude
```

```
a heading naming the component the section is built from
```

They differ in one thing: whether a reader scanning headings has been given a reason to stop.
