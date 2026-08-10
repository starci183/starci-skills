# typography

## Definition

Type carries rank. How large a line is, how heavy, and what colour it takes are not four independent
choices — together they say which of the things on screen is the most important, and a reader
decides where to look before reading a word.

So the scale is small, and the steps are paired rather than free. A heading is not a size and a
weight chosen together; it is a LEVEL, and the level decides both.

What holds this law is [`sources/fe/typography.mjs`](../../../sources/fe/typography.mjs), plus the
closed unions on the two components that own type.

## The scale, as it actually is

Headings are four levels, and each fixes a size and a weight at once:

| Level | Size | Weight |
|---|---|---|
| 1 | 20px | semibold |
| 2 | 16px | semibold |
| 3 | 14px | medium |
| 4 | 12px | medium |

Body text is two sizes — 14px and 16px — three weights, and two tones. That is the whole vocabulary,
and it is deliberately smaller than the surface it replaces: a scale a second author cannot hold in
their head is one they read off the nearest neighbour instead.

Notice what the heading table does NOT do: it never pairs a large size with the heaviest weight. Rank
comes from the STEP, not from shouting one line as loudly as the type system allows.

## Rules

**TYPE-1 · A heading is a level, and the level decides the tag as well as the look.**

The tag a screen reader builds the document outline from, and the size a reader sees, are two facts
about one thing. Written separately they drift: the third-largest text on a screen becomes its first
heading, and the outline stops describing the page. One prop decides both, so they cannot disagree.

**TYPE-2 · Four levels, and a fifth means the page nested too far.**

If a surface needs a fifth, the answer is not a smaller step — it is that the section has nested
further than a reader can hold. That is a structure problem wearing a styling problem's clothes.

**TYPE-3 · Rank comes from size, weight and tone. Never from a box.**

A border, a background or a chip drawn around the thing you want noticed is jewellery that does not
correspond to rank, and once a surface has taught a reader that its boxes mean nothing, the box that
does mean something is invisible too.

**TYPE-4 · When something is competing for attention, quieten its neighbours.**

Emphasis is relative. Making the important thing louder raises the floor for everything, and the
next author raises it again. Most rank problems are solved a step earlier, by making everything
around the thing quieter.

**TYPE-5 · A secondary line ranks below the title it belongs to.**

An eyebrow, a count, a category, a piece of meta: smaller and dimmer, never larger or heavier. A
card whose loudest element is its category tag is a card whose name nobody read, and that is a
defect rather than a successful emphasis.

**TYPE-6 · Weight is a body-text axis. A heading does not take one.**

Headings already carry weight as part of their level. Pushing another onto one is asking two systems
to decide the same thing, and the loser is whichever the reader sees second.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| A heading tag written by hand | The outline and the visible size are then set separately, and they drift | The heading component, with a level |
| A size and a weight assembled into a heading | It is a heading nothing else knows about: the outline does not contain it | Same |
| A fifth heading level | The section has nested further than a reader can hold | Flatten the section |
| A box drawn to emphasise | Jewellery that does not match rank teaches the reader to ignore boxes | Size, weight, tone |
| Making the important thing louder | Emphasis is relative, so raising it raises the floor for everything | Quieten its neighbours |
| A secondary line larger or heavier than its title | The card's name goes unread, which is a defect and not emphasis | Smaller and dimmer |
| A weight pushed onto a heading | Two systems decide one thing, and the reader sees the loser | Let the level decide |

## Examples

### One prop, two facts

```tsx
<Heading props={{ content: title, level: 2 }} />
```

```tsx
<h2 className="text-2xl font-bold">{title}</h2>
```

They differ in one thing: whether the outline a screen reader builds matches what a reader sees.

### Rank without jewellery

```tsx
<Text props={{ content: category, size: "sm", tone: "muted" }} />
<Heading props={{ content: name, level: 3 }} />
```

```tsx
<Badge props={{ label: category }} />
<Text props={{ content: name, size: "sm" }} />
```

They differ in one thing: which line the eye reaches first — and in the second, it is the category.

### Emphasis by subtraction

```tsx
// the row that matters keeps its default; the rows around it drop to muted
<Text props={{ content: value, weight: "semibold" }} />
<Text props={{ content: other, tone: "muted" }} />
```

```tsx
// every row climbs, and the next author climbs again
<Text props={{ content: value, size: "md", weight: "semibold" }} />
```

They differ in one thing: whether the scale still has room above it.
