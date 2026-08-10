# icon

## Definition

An icon is the picture a word needs when the word alone is slower to find. It is either a MARKER on a
line of text, or the SUBJECT of a region — and every question about an icon is answered by deciding
which of the two it is.

The question that settles it: **is the reader reading this glyph, or reading past it?**

Reading past it means marker: the small step, the outline cut, no colour of its own, no plate.
Reading it means subject: the large step, the solid cut, on a plate. There is nothing between the
two, and a case that seems to need something between is a case where the role has not been decided.

What holds this law is [`sources/fe/icon.mjs`](../../../sources/fe/icon.mjs) and the closed size
union in the icon leaf itself. The union is the stronger of the two: a step that is not a member
cannot be typed. The rules cover the two things a union cannot see — a glyph imported straight from
a library, and a size written as a class string rather than passed as a step.

## The two steps, and what they actually are

| Step | Glyph | Plate it sits on | Where |
|---|---|---|---|
| small | 16px, outline cut | none | on a line with words |
| large | 20px, solid cut | 40px | leading a region, no words on its line |

The plate has a second step of its own at 32px, which carries the SMALL glyph at 16px. That gives the
ratio that holds everywhere: **the glyph is half its plate.** 16-in-32, 20-in-40. The plate and the
glyph are therefore one decision, not two.

A glyph carries a no-shrink instruction at every step, in every row, without exception.

**Two steps is a narrowing, and it was deliberate.** The surface this replaces ran three: 16, 20 and
24. The third was not rare — it carried a fifth of that codebase's glyphs, on the upload prompt, the
avatar camera, the notification bell, the mobile navigation rows and the status marker of every
toast. Each of those was a defensible local choice, and together they were a scale nobody could
apply from memory: the third step is the one an author reaches for when the second looks slightly
small, which is a judgement that lands differently on every screen.

Dropping it costs something real, and the cost is worth naming. A glyph that used to lead a
notification row at 24 now leads it at 20, and there is no way to make it 24 without changing the
scale for everybody — which is the point. A port of those surfaces resolves each one to a step
rather than preserving its measurement.

## Rules

**ICON-1 · Two steps, and the small one is the default.**

A third step is a decision nobody makes consistently: the first author picks it for a reason true on
their screen, and every later author copies the nearest of three without knowing which reason
applied. The default is the small step, because the overwhelmingly common case is a marker beside
words — of the icon call sites that sit on a line of text, every single one takes the small step.

**ICON-2 · A glyph beside words takes the small step, WHATEVER size the words are.**

This is the rule most often got wrong, because the intuition is that the icon should scale with the
text. It must not, and the numbers say why. Body text has two steps, 14px and 16px. The glyph's small
step is 16px at both.

A glyph FILLS its box; a letter does not. A 16px glyph therefore reads as optically level with 14px
text, and a glyph matched to the text's own measurement reads as larger than the text it accompanies.
Tying the two would make the glyph correct at one text size and wrong at the other — so it is tied to
neither.

**ICON-3 · The large step is only for a glyph with no words on its line.**

Leading an empty region, standing as the mark of a tile. If any word shares the line, the role is
marker and the step is small, whatever the region is. In practice the large step is never reached for
directly at all: it arrives through the tile, which is the only construct where a glyph is the
subject.

**ICON-4 · The solid cut is for a subject, never for emphasis.**

Filling a glyph does not make it more important; it changes what it IS. An outline glyph reads as a
label, naming the thing beside it. A solid glyph reads as an object in its own right. Using the fill
to make a marker stand out gives it a subject's weight while it is still doing a marker's job, and
the surface then has two things claiming to be what is being looked at.

The solid cut and the large step travel together — the tile is the only place either appears. A case
wanting one without the other is a case where the role is being decided twice, differently.

**ICON-5 · A glyph has no colour of its own.**

It draws in the inherited colour, so it can never disagree with the label beside it. A glyph given
its own colour is the one still bright after its row has been dimmed — and dimming a row is how a
surface says "not this one", which the glyph then contradicts.

One exception, and it is narrow: a third party's own mark, in its own colours, where recognition
happens before reading and a recoloured version stops performing.

**ICON-6 · The set of meanings is closed, and a caller names the MEANING.**

An icon library ships thousands of glyphs, and a product that can reach all of them has no
iconography — it has a search box. A caller asks for what the mark SAYS; one file owns which picture
draws it. A caller reaching into the library decides three things at the call site — which library,
which glyph, how big — and the next screen answers all three differently.

**ICON-7 · A glyph that repeats the words beside it is removed.**

A caret already says "this goes somewhere"; a globe beside it says it again in a second alphabet.
Decoration that reads as signal teaches a reader to stop reading signal.

**ICON-8 · A glyph never shrinks.**

When a row runs out of room the words wrap or clip and the glyph does not. A squeezed glyph is
unrecognisable at exactly the moment the row is hardest to read, and a glyph that has become an
ellipse is worse than no glyph at all.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| A third size step | Nobody applies it consistently; later authors copy the nearest of three | Decide marker or subject; there is no middle |
| A fractional or arbitrary glyph size | It is off both steps, and the spacing rules do not scan size utilities, so nothing catches it | One of the two steps |
| An icon sized to match its text | A glyph fills its box and a letter does not, so it reads larger than its label | The small step, at both text sizes |
| The large step beside words | The role is marker whatever the region is | The small step |
| The solid cut used for emphasis | A marker then claims to be a subject, and two things claim the same attention | Quieten the neighbours instead |
| The solid cut without the large step, or the reverse | The role is being decided twice, differently | Both, or neither |
| A colour on the glyph | It stays bright after its row is dimmed, contradicting the dimming | Inherit the line's colour |
| A glyph filling its plate, or lost in it | The plate and the glyph were chosen separately | Half the plate, at every step |
| A glyph that shrinks in a tight row | Unrecognisable exactly when the row is hardest to read | Words give way; the glyph never does |
| A glyph imported straight from the library at a call site | Three decisions land there, and the next screen answers them differently | Name the meaning |

## Examples

### The scale trap

```
a marker beside body text: 16px, at both 14px and 16px text
```

```
the same marker sized to its words: 14px beside small text, 16px beside large - it grows on one
surface and reads heavier than its own label on the other
```

They differ in one thing: whether a glyph's box was confused with a letter's height.

### The role trap

```
an empty region led by a 20px solid glyph on a 40px plate, nothing else on its line
```

```
the same 20px solid glyph placed beside a label in a row
```

They differ in one thing: whether anything on the line competes to be looked at.

### The emphasis trap

```
the row that matters is made to matter by dimming the rows around it
```

```
the row that matters is made to matter by filling its glyph
```

They differ in one thing: whether a marker was asked to do a subject's job.

### The escape trap — the one that no rule catches

```
a caret drawn through the named set, at the small step, in the inherited colour
```

```
a caret imported straight from the library at 14px with a third weight, because the small step
looked slightly too big on that one line
```

They differ in one thing: whether the exception is visible to anybody who did not write it. The
second is off both steps and outside the meaning set, and the spacing rules scan gaps and insets
rather than glyph sizes — so nothing reports it and the third step now exists.
