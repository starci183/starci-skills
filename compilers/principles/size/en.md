---
title: Size
---

# Size

You are given a plain request in prose — "a file row with an avatar, a long file name and a Download
button" — and you return, for every box that request implies and for each of its two axes, one
situation code and one className. The request never states a number and you never measure one off a
picture: the extent follows from WHO decided it.

## Law

Every extent on a screen was decided by somebody. The class you write names WHO decided it: the
content inside the box, the parent that offers the space, or a bound somebody set on purpose. Choose
from that ownership, never from what the box happens to look like at the one width you have open.

Ownership is per AXIS. A box has an inline extent and a block extent, and they are two decisions with
two different answers far more often than they are one. A comment field takes its width from the
parent and its height from a floor somebody reserved; calling that box "sized" as a single fact is
how one of the two axes ends up never having been decided at all.

**This is binding, not advisory.** Anything rendered occupies space on two axes, and each axis has a
code below. There is no element small enough to be exempt: a `16px` glyph is `SIZE-4` for exactly the
reason a page shell is `SIZE-2`, and "it is just an icon" is the sentence under which most
unexplainable extents enter a codebase. An axis whose owner nobody can name is not a small omission;
it is the axis that will break first at a width nobody tested.

## Situation codes

Every situation this module governs carries a code, `SIZE-<index>`. The code names the SITUATION on
ONE AXIS; the className column names what that situation emits on that axis. They are not the same
thing, and one of them emits nothing.

| Code | Situation | className |
|---|---|---|
| `SIZE-0` | Content measures itself; the box is exactly what it holds | *no size class* |
| `SIZE-1` | The box takes everything the parent offers | `w-full` · `h-full` · `flex-1` |
| `SIZE-2` | A ceiling caps growth: reading measure, shell, overlay | `max-w-[65ch]` · `max-w-5xl` · `max-h-[80vh]` |
| `SIZE-3` | A floor reserves extent so nothing collapses or jumps | `min-h-32` · `min-w-24` · `min-h-screen` |
| `SIZE-4` | A token fixes the extent outright | `size-4` · `size-10` · `h-10` · `w-64` |
| `SIZE-5` | A stated share of the parent | `w-1/2` · `basis-1/3` |
| `SIZE-6` | The content's intrinsic floor is released so the parent wins | `min-w-0` · `min-h-0` |
| `SIZE-7` | The other axis derives it | `aspect-video` · `aspect-square` |

`SIZE-0` IS A SITUATION, NOT A CLASS. There is no "auto width" class to write, and reaching for
`w-auto` to say it is a rule change rather than a shortcut: `w-auto` overrides an inherited decision,
while `SIZE-0` is the absence of any decision but the content's. The code exists because a box that
measures itself is a claim a reader must be able to recognise, cite and be corrected against — an
unnamed situation is one nobody can be shown to have got wrong.

The indices are not a scale, and a larger index is not a larger box. They are eight distinct answers
to one question, and when more than one appears on the same axis the axis resolves in this fixed
order:

`SIZE-7` → `SIZE-4` → `SIZE-2` → `SIZE-3` → `SIZE-6` → `SIZE-5` → `SIZE-1` → `SIZE-0`

Read it as: a derived axis is not measured at all; a fixed token answers before any negotiation
starts; a bound outranks the negotiation it constrains; a released floor outranks the fill it makes
possible; and content only measures itself once nobody else has claimed the axis. `w-full max-w-5xl`
is one axis with one owner — the ceiling — and `w-full` is merely how the box reaches it.

## Reading a request

1. **List the boxes the request states.** "A file row with an avatar, a long file name and a Download
   button" states four: the row, the avatar, the name cluster and the button.
2. **Do not invent a box the request never mentions.** A page shell, a cover image or a scroll region
   is not in that request. Resolve what is stated; resolve the rest when it arrives.
3. **Split every box into two axes before answering.** Inline and block are asked separately, and
   "how big is this box" is never a question with one answer.
4. **Resolve outermost first**, then each box inside it. A box never inherits its parent's code, and
   a parent never inherits its child's.
5. **For each axis, ask each code's question** in the section for that code. The answer is the owner
   of that axis: the content, the parent, or a bound somebody stated.
6. **If more than one code matches on one axis, apply the resolution order above.** `SIZE-7` wins
   first and `SIZE-0` last; the code you write is the one that owns the axis, not the class that
   happens to be longest.
7. **If the two axes have different owners, that is the normal case, not a conflict.** Record two
   codes. Only a single axis with two competing owners needs the resolution order.

## `SIZE-0` — content measures itself

**Situation.** The box is exactly what it holds. Nobody imposes anything on it: remove the text and
the box shrinks, add text and it grows, and that is what is wanted.

**Recognition signs**

- The content is short, known in advance, and no state makes it several times longer.
- The box sits beside other boxes in a row and is NOT expected to line up with them.
- Forcing it wider would turn the leftover space inside it into a lie about the content.

**Ask yourself.** With all content removed, should this box collapse to zero on this axis?

**Boundary**

- `SIZE-1`: `SIZE-0` shrinks to its content; `SIZE-1` keeps its extent even when empty. A block
  `<div>` in normal flow is ALREADY `SIZE-1` on the inline axis — it is not `SIZE-0`, it merely needs
  no class.
- `SIZE-4`: if the number must be identical everywhere the element is reused, it is a token —
  `SIZE-4`, not content measuring itself.
- `SIZE-2`: a long paragraph is NEVER `SIZE-0`. Text with no ceiling is an axis nobody decided, not
  an axis the content decided.

**Common business situations.** Status badge · filter chip · button in an action row · unit label
beside a number · breadcrumb · skill tag · a "See more" button under a list · the compact metadata
line of a record.

## `SIZE-1` — the parent measures, the box takes all of it

**Situation.** The parent is holding a portion of space and this box takes ALL of it. The extent is a
consequence of the layout, not of the text inside.

**Recognition signs**

- The box must line up with its siblings above and below it.
- When the content is empty, the box must keep its extent.
- The parent is flex or grid, or the box is a control whose browser default is to shrink to content.

**Ask yourself.** If the content disappeared, must this extent stay the same?

**Boundary**

- `SIZE-0`: see above.
- `SIZE-5`: `SIZE-1` takes EVERYTHING; `SIZE-5` takes a STATED share.
- `SIZE-6`: if the content inside has an intrinsic floor breaking the parent's measurement — a long
  string refusing to truncate, a scroll region refusing to scroll — the axis is `SIZE-6`, and
  `SIZE-1` is only what `SIZE-6` makes possible.
- `SIZE-2`: if a ceiling stops it, the ceiling owns the axis and `w-full` is merely the road to it.

**Do not write `w-full` on a block child in normal flow.** It is already correct. Write the class
where the default is otherwise: flex children, grid children, `inline-block`, `input`, `button`,
`select`, and absolutely positioned boxes.

**Common business situations.** The input inside a form field · a submit button spanning the width on
mobile · the main content area beside a rail · a card in a grid cell · a progress bar inside its
track · a search result region · the body of a dialog.

## `SIZE-2` — there is a ceiling

**Situation.** The box is willing to grow, but somebody set a level it must not pass. A ceiling always
has a REASON, and that reason must be sayable in words before the number is written.

**Recognition signs**

- Past some level the box starts to BREAK FUNCTIONALLY, not merely look worse: the eye loses the
  return point at the end of a line, an overlay runs off the screen, the page stretches on an
  ultra-wide monitor.
- The number comes from a standard or a frame, not from a screenshot.
- On a narrow screen the ceiling does NOTHING at all — that is the correct sign of a ceiling.

**Ask yourself.** Is there a level past which this box stops working rather than merely looking bad?

**Boundary**

- `SIZE-1`: `SIZE-1` takes everything the parent offers; `SIZE-2` takes everything UP TO a level.
- `SIZE-4`: a token fixes the number at every width; a ceiling only takes effect once the available
  space exceeds it.
- `SIZE-3`: a ceiling stops growth, a floor stops collapse. They point in opposite directions and can
  coexist.

**The reading measure.** A line of text that runs too long loses the eye's return point at the end of
each line; too short and the reading rhythm is broken over and over. The familiar safe band is about
**45–75 characters** per line, and that is why a text column always carries a ceiling — not because a
narrow column looks nicer.

**Common business situations.** Articles, course descriptions, terms of service · a centred page shell
on a wide screen · a login form centred on screen · dialogs and drawers · toasts · captions · an image
that must not exceed its container · the scroll region of a suggestion list.

## `SIZE-3` — there is a floor

**Situation.** The box is sometimes empty or nearly empty, and letting it shrink to its content would
make the page JUMP or the region vanish. A floor is space RESERVED for a state that has not arrived.

**Recognition signs**

- The box has several content states: empty, loading, one line, ten lines.
- The user will ACT on that region, so it must be large enough to click or type in from the start.
- If the floor were removed, what breaks is THE POSITION OF OTHER ELEMENTS, not the look of this box.

**Ask yourself.** In the smallest content state, does anything else on the page move?

**Boundary**

- `SIZE-4`: a floor allows further growth; a token does not. A multi-line input must be a floor —
  fixing its height turns it into a tiny scroll slot.
- `SIZE-2`: see above.
- `SIZE-0`: `SIZE-0` accepts the box shrinking; `SIZE-3` is when the shrinking is the bug.

**The unit does not change the code.** `min-h-screen` is still `SIZE-3`. The viewport is where the
number came from, not who owns the axis.

**Common business situations.** A multi-line input · an empty state with illustration and action
button · an app shell that must cover the screen height so the footer does not float mid-page · a
number column holding its width so the table does not shake when values change · a button whose label
alternates between "Save" and "Saving" · a chart region before the data arrives · cards in a grid held
to a common minimum height.

## `SIZE-4` — a token fixes it

**Situation.** The number does NOT come from the content and does NOT come from the parent. It is a
system decision, identical everywhere this element appears.

**Recognition signs**

- The same element appears on several screens and must look exactly alike.
- The content inside has no trustworthy intrinsic extent: a glyph shape, an avatar, a slider track.
- Letting it shrink to content would make it jump every time the data changes.

**Ask yourself.** Must this number be identical everywhere this element appears?

**Boundary**

- `SIZE-0`: an icon is `SIZE-4` because an SVG has no usable intrinsic extent; text does.
- `SIZE-3`: see above.
- `SIZE-7`: if only ONE axis is fixed and the other is derived from it, the derived axis is `SIZE-7`.

**The number must come from the token scale.** An odd value measured off a screenshot is not
`SIZE-4`; it is a fake `SIZE-4`, and it will match no other element in the system.

**Common business situations.** Icons in buttons and menus · avatars · status dots · control height so
buttons and inputs align · a thin progress bar · a sticky header with a fixed height so the content
below can offset by exactly that number · a fixed-width navigation rail · a custom checkbox.

## `SIZE-5` — a stated share of the parent

**Situation.** The parent is divided by a STATED ratio and this box takes exactly its share. The ratio
is a statement about content: which side matters more, which side is secondary.

**Recognition signs**

- It can be said in words: "half", "a third", "two thirds".
- The ratio holds at every width for which this layout is in force.
- The box's extent depends NEITHER on its own content NOR on the content of the box beside it.

**Ask yourself.** Is this ratio a decision about importance, or just the number that makes the current
screenshot look balanced?

**Boundary**

- `SIZE-1`: `SIZE-5` takes a share; `SIZE-1` takes everything.
- `SIZE-4`: a share stretches with the parent; a token does not. A rail that needs exactly enough room
  for two lines of label is `SIZE-4`; a rail that "takes a quarter" is `SIZE-5`.
- Grid: when the parts are equal and there is a GAP between them, the ratio belongs to the PARENT'S
  TRACKS, not to the children. The child is then `SIZE-1` inside its cell, and the parent declares the
  column count.

**Common business situations.** An uneven two-column layout of content and summary · plan comparison
cards · a fifty-fifty split of image and description inside a hero · a completion percentage drawn as
a child box inside a track · three benefit blocks on a horizontally scrolling row.

## `SIZE-6` — the intrinsic floor is released

**Situation.** The parent has stated how much room the child gets, but THE CONTENT REFUSES: a long
unbreakable string, a table, a region that ought to scroll. The default in flex and grid is that a
child MAY NOT BE SMALLER THAN ITS MINIMUM CONTENT, so the parent's measurement is silently voided.

`SIZE-6` is where we rule in the parent's favour.

**Recognition signs**

- There is `truncate`, `line-clamp`, or a long text cell in a flex row.
- There is a scroll region inside a flex column of determined height.
- Symptoms: the box OVERFLOWS its parent, the whole page gains a horizontal scrollbar, or the scroll
  region never scrolls and stretches the page instead.

**Ask yourself.** Is something inside refusing to shrink, so that the parent's measurement has no
effect?

**Boundary**

- `SIZE-1`: `SIZE-1` is the measurement; `SIZE-6` is the condition under which that measurement takes
  effect. When both are present on one axis the code is `SIZE-6`, because that is the decision
  `SIZE-1` alone cannot state.
- `SIZE-2`: a ceiling stops growth; `SIZE-6` permits shrinking.
- `SIZE-3`: the two are direct opposites. `SIZE-3` builds a floor, `SIZE-6` removes the floor the
  browser built by itself.

**`overflow-hidden` is not a substitute.** It hides the consequence and keeps the cause: the box is
still measured wrongly, we merely stop seeing it.

**Common business situations.** A long file name in a row with a trailing button · a title truncated
with an ellipsis beside a status badge · a user's email in an account menu · a scrolling message
region inside a full-height chat frame · a table inside a flex column · a chart inside a grid cell · a
long breadcrumb.

## `SIZE-7` — the other axis derives it

**Situation.** Only ONE axis is measured; the other is a consequence of a fixed ratio. The box holds
exactly the room for something that has not arrived, or whose real extent is unknown.

**Recognition signs**

- The content is an image, a video, a map or an embed — something arriving with a size NOBODY IN THIS
  CODEBASE CHOSE.
- Without reserving the room first, the content will PUSH whatever is already on screen once it loads.
- The ratio is part of the design: a square for an avatar, a film frame for a thumbnail.

**Ask yourself.** Is this axis derived from the other one rather than measured on its own?

**Boundary**

- `SIZE-4`: a token fixes BOTH axes with known numbers; `SIZE-7` knows one axis and a ratio.
- `SIZE-3`: a floor reserves a minimum and then allows growth; a ratio holds the shape at every width.

**Required, not optional.** Anywhere late-arriving content could move what is already displayed,
reserving the room by ratio is the rule.

**Common business situations.** Lecture thumbnails · course cover images · avatars in a member grid ·
an embedded map · a video frame · the image placeholder shown while loading · photo cells in a gallery
grid.

## Inputs

| Input | Evidence required |
|---|---|
| box | The element being measured, not its wrapper |
| axis | Inline or block, stated separately; never "size" as one word |
| parent layout | Normal flow, flex, grid, or a positioning containing block |
| content dependency | Whether the extent must survive when the content is removed |
| bound | Any ceiling or floor the request states, and the standard it comes from |
| state set | Every content state the axis must hold without moving |

## Rules

1. One axis resolves to exactly one code. A box carries two codes, not one.
2. The code names WHO measures. `ch`, `rem`, `%`, `vh` and `px` are units, and a unit never changes
   the code.
3. A block-level child in normal flow is already `SIZE-1` on the inline axis. Do not restate it with
   `w-full`; write the class where the default is otherwise — flex and grid children, inline-block,
   form controls, and absolutely positioned boxes.
4. Running text carries a ceiling. Prose allowed to span an unbounded measure is not `SIZE-0`; it is
   an axis nobody decided.
5. A flex or grid child that must truncate, ellipsise or scroll carries `SIZE-6` on that axis. Without
   it the content's own minimum silently outranks the parent.
6. Fixed extents come from the token scale, never from a pixel measured off a picture.
7. A parent and its only child do not both state the same extent. One of the two is a decision and the
   other is a copy of it.
8. Skeleton, empty, error and loaded states share one code per axis.
9. No className serves two codes, and no code is chosen because it made the current screenshot look
   right.

## Exceptions

Exceptions are PART of the rule, not relief from it. Each is closed and cites the situation it applies
to.

- **A floor and a ceiling on the same axis.** The axis is a stated range. Cite the bound the request
  is actually about — the ceiling when the concern is unbounded growth, the floor when the concern is
  collapse — and record the other as the guard it is.
- **Positioned boxes.** For an absolutely or fixed box, the parent in `SIZE-1` and `SIZE-5` is the
  positioning containing block, not the DOM parent. Resolve against the box it is actually measured
  from, or the code is being read off the wrong element.
- **Media of unknown intrinsic size.** Remote images and embeds arrive with a size nobody in this
  codebase chose. Reserving the box with `SIZE-7` is required, not optional, wherever a late arrival
  would otherwise move content that is already on screen.
- **Responsive.** A breakpoint may change the code only when the layout role changes. A rail that
  becomes a stacked band genuinely changes owner; the same rail merely getting narrower does not.
- **Replaced and form elements.** These carry an intrinsic extent the platform chose. Stating `SIZE-1`
  on them is a real decision even in normal flow, because their default is `SIZE-0`.
- **Viewport-measured bounds.** `min-h-screen` and `max-h-[80vh]` remain `SIZE-3` and `SIZE-2`. The
  viewport is where the number came from, not who owns the axis.

## Output

One block per axis of one box — two blocks per element — outermost element first, inline axis before
block axis:

```text
box: <element>
axis: <inline | block>
situation: <SIZE-0 | SIZE-1 | SIZE-2 | SIZE-3 | SIZE-4 | SIZE-5 | SIZE-6 | SIZE-7>
className: <no class | w-full | max-w-[65ch] | min-h-32 | size-10 | basis-1/3 | min-w-0 | aspect-video>
reason: <who owns this axis, and what excludes the code next to it in the resolution order>
```

## Worked example

**Request.** "Inside a centred page column, a file row: an avatar, the file name which can be very
long, and a Download button."

The request states four boxes inside the page column: the row, the avatar, the name and the button. It
states no cover image, no scroll region, no empty state and no breakpoint, so none of those are
resolved.

```text
box: page column
axis: inline
situation: SIZE-2
className: mx-auto w-full max-w-5xl
reason: the request centres the column, so a level exists past which the page stretches and stops working, which excludes SIZE-1
```

```text
box: page column
axis: block
situation: SIZE-0
className: no class
reason: nothing in the request reserves height or fears a jump, so the content measures it, which excludes SIZE-3
```

```text
box: file row
axis: inline
situation: SIZE-1
className: no class
reason: a block child in normal flow already takes the column's width, so restating it with w-full would copy a decision the layout made
```

```text
box: file row
axis: block
situation: SIZE-0
className: no class
reason: the row is as tall as the tallest thing in it and no state was stated that could collapse it, which excludes SIZE-3
```

```text
box: avatar
axis: inline
situation: SIZE-4
className: size-10 shrink-0
reason: an avatar must look identical in every row, so the number belongs to the system rather than to the content, which excludes SIZE-0
```

```text
box: avatar
axis: block
situation: SIZE-4
className: size-10
reason: the same token fixes both axes with known numbers, and no ratio is being derived, which excludes SIZE-7
```

```text
box: file name
axis: inline
situation: SIZE-6
className: min-w-0 flex-1
reason: the request says the name can be very long, so its intrinsic minimum would push the button out of the row unless released, which excludes SIZE-1
```

```text
box: file name
axis: block
situation: SIZE-0
className: no class
reason: the line is as tall as its text and no state was stated that makes it taller, which excludes SIZE-3
```

```text
box: Download button
axis: inline
situation: SIZE-0
className: no class
reason: the button is as wide as its label and the request never asks it to line up with anything, which excludes SIZE-1
```

```text
box: Download button
axis: block
situation: SIZE-0
className: no class
reason: the height is the label plus its padding and no number was stated that every Download button must share, which excludes SIZE-4
```

When the request later adds a cover image to the row, that box reserves its room by ratio — `SIZE-7`
on the block axis, `SIZE-1` on the inline axis — because a late arrival must not move the name already
on screen. When it adds an empty state for the list, that region takes a floor: `SIZE-3`.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is an ordinary `className` on ordinary markup.
