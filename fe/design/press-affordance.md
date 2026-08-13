# press affordance

## Definition

A press affordance is what a surface says back when a reader points at it or presses it. It is not
decoration and it is not feedback about a request: it is the surface answering the question a reader
asks with the pointer — *is this a thing that opens something, and did my press land?*

A whole row or card that navigates has no visible edge saying so. A link has one, drawn by centuries
of convention; a rectangle has none. So the affordance is the only thing standing between a
navigable region and a picture of one, and a region that answers nothing is a region readers learn
to stop trying.

The question that settles an unfamiliar case: **what did the reader point at, and what will open?**
Everything below follows from keeping those two the same.

## Rules

**PRESS-1 · One gesture gets one answer.**

A surface that both dims and underlines a line inside it has answered a hover twice, and the reader
is told the whole region is the target and then that one line is. Pick the one that names the
destination: if the content holds a line that IS the name of what opens, that line answers; if it
holds no such name, the surface answers by dimming. Never both.

**PRESS-2 · The naming line answers with the same mark a link uses.**

The line that names the destination underlines on hover because that is what a link does, and a
reader already knows what it means. It must be the SAME underline the product's links draw — the
same colour, the same thickness, the same offset. Two underlines in one card at two weights read as
two different kinds of promise, and the reader has no way to learn which of them is real.

**PRESS-3 · A control inside a press target is not part of it.**

While the pointer is over a link, a button, or a control that opens something else, the surrounding
surface must stop answering. It is not being pointed at. Left answering, the reader is shown two
destinations for one gesture and cannot tell which the press will take — and the one they get is
the inner control, which is the answer the surface was contradicting.

**PRESS-4 · The press answers back, even when the route is slow.**

A region that navigates has no pressed state of its own the way a button does, so on a route that
takes a moment the reader gets nothing, assumes the press missed, and presses again. A dim while the
pointer is down costs nothing and is the difference between a slow screen and a broken one.

**PRESS-5 · The affordance belongs to the thing that presses.**

Cursor, hover answer and pressed state are claims about reacting to a pointer, and only the control
that owns the handler knows whether there is anything to react to. Written into the arrangement
instead — into a layout entry, a class list, a stylesheet keyed on shape — the claim outlives the
handler: the pointer still changes over a region whose call site passed nothing, and nothing can
tell it to stop.

**PRESS-6 · A surface answers a pointer, never a reader who cannot use one.**

Everything above is what a pointer sees. The same region must be reachable and operable from a
keyboard, and its accessible name must be the destination rather than the row's first words. An
affordance that exists only under a mouse is a promise made to half the readers.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Dimming the surface AND underlining its label on one hover | Two answers to one gesture; the reader is told the region is the target, then that one line is | Underline when a line names the destination, dim when none does |
| A label underline in a colour or weight of its own | Two underlines in one card claiming two different promises, and no way to learn which is real | Draw the mark the product's links already draw |
| Leaving the surface answering while a control inside it is hovered | The reader is shown two destinations for one gesture, and gets the one the surface was contradicting | Stop the outer answer while an inner control is pointed at |
| A cursor or hover state written into the arrangement | The arrangement cannot know whether this call site passed a handler, so it promises over dead regions | Give the affordance to the control that owns the press |
| A hover answer with no pressed answer | On a slow route the reader learns nothing from a press and presses again | Dim on press as well as on hover |
| A region that reacts to a pointer and to nothing else | Keyboard readers get a region that looks inert and behaves inert | Make it focusable and operable, named by its destination |

## Examples

### Right — the row names its destination, so the name answers

```
row hovered  ->  course title underlines, row stays put
row pressed  ->  row dims
```

### Wrong — the row answers twice

```
row hovered  ->  course title underlines AND the whole row dims
```

The difference is how many things claim to be the target: one, or two.

### Right — the inner link takes the hover

```
pointer over "why this price?"  ->  the link underlines, the row's title does not
```

### Wrong — the row keeps answering under the inner link

```
pointer over "why this price?"  ->  the link underlines AND the row's title underlines
```

The difference is which destination the reader is promised: the one they will get, or two.

### Right — the mark is the product's own

```
title underline: the link colour and thickness, one step off the letters
```

### Wrong — the mark is invented for this one surface

```
title underline: a hairline in the separator colour, beside links ruled in ink
```

The difference is whether a reader can carry what they learned from one underline to the next.
