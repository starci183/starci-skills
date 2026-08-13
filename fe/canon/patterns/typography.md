# typography

## Definition

Type carries rank. How large a line is, how heavy, and what colour it takes are not four independent
choices — together they say which of the things on screen is the most important, and a reader
decides where to look before reading a word.

So the scale is small, and the steps are paired rather than free. A heading is not a size and a
weight chosen together; it is a LEVEL, and the level decides both.

What holds this law is [`sources/fe/typography.mjs`](../../../sources/fe/typography.mjs), plus the
closed unions on the two components that own type.

Implementation anchors in `starci-academy-fe`: `src/components/leaves/Text/index.tsx` and
`src/components/leaves/Heading/index.tsx`.

## The scale, as it actually is

Headings are four levels, and each fixes a size and a weight at once:

| Level | Size | Weight |
|---|---|---|
| 1 | 20px | semibold |
| 2 | 16px | semibold |
| 3 | 14px | medium |
| 4 | 12px | medium |

Body text uses 14px and 16px. A third, restricted 12px caption step exists only for supporting copy
beneath or beside a primary line or joined surface; it is not another general-purpose body size.
Because that step already means "supporting", every `text-xs` is muted. Size and tone are one rank
here: there is no default-tone or foreground-coloured 12px exception. The scale has three weights
and two tones, and callers do not invent further steps from nearby pixels.

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

A muted caption below a primary `text-sm` label therefore uses the reserved `text-xs` step. Tone
alone is not enough: two lines at the same size still claim the same rank even when one is grey.

**TYPE-6 · Weight is a body-text axis. A heading does not take one.**

Headings already carry weight as part of their level. Pushing another onto one is asking two systems
to decide the same thing, and the loser is whichever the reader sees second.

**TYPE-7 · `text-xs` always means muted supporting copy.**

The smaller step is not a compact version of primary copy. It is the right-hand fact beside a
`text-sm` label, a relative time such as "55 minutes ago", or a caption under the thing it explains.
If the words must keep the foreground tone, they are primary enough to remain `text-sm` or larger.
The `Text` leaf encodes this pairing: selecting `size: "xs"` resolves and types the tone as muted.

**TYPE-8 · A temporal result marker is a muted subtitle, not a heading.**

Today, Yesterday and equivalent local-time partitions qualify the joined results immediately below
them. They render outside that surface as `text-sm` with muted tone. They remain `text-sm` because
they name a scan partition; they are not explanatory caption copy. Giving them a heading level or
the label treatment of `SurfaceListCard` falsely promotes each time bucket into a page section.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| A heading tag written by hand | The outline and the visible size are then set separately, and they drift | The heading component, with a level |
| A size and a weight assembled into a heading | It is a heading nothing else knows about: the outline does not contain it | Same |
| A fifth heading level | The section has nested further than a reader can hold | Flatten the section |
| A box drawn to emphasise | Jewellery that does not match rank teaches the reader to ignore boxes | Size, weight, tone |
| Making the important thing louder | Emphasis is relative, so raising it raises the floor for everything | Quieten its neighbours |
| A secondary line the same size as, larger than, or heavier than its title | The two lines claim equal rank, or the card's name goes unread | The restricted 12px caption step plus muted tone |
| A weight pushed onto a heading | Two systems decide one thing, and the reader sees the loser | Let the level decide |
| `text-xs` without muted tone | A supporting-size line claims primary colour and sends two contradictory rank signals | Pair `text-xs` with `text-muted`, or keep primary copy at `text-sm` |

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
