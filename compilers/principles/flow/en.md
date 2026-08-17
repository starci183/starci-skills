---
title: Flow
---

# Flow

You are given a plain request in prose — "a filter sidebar on the left and course cards on the
right" — and you return, for every container that request implies, one situation code and one
className. The request never states an axis and you never guess one: the axis follows from what the
children are and from what has to happen when the width runs out.

## Law

Before anything can be spaced, aligned or sized, one fact has to be declared: **which axis the parts
run along, and what happens to that axis when the width runs out.**

The parent declares it. A child never announces the axis it sits on, because the axis is a statement
about a set, and no member of a set can speak for the set.

A composition that declares nothing has still answered. It answered with whatever the elements
default to, and that default is a fact about HTML rather than a fact about the content: block
children stack, inline children run along a line and break at spaces. Sometimes that is exactly
right — and when it is, it is right because someone checked, not because nobody looked.

**This is binding, not advisory.** Every container that renders more than one thing has a flow
situation, and that situation has a code below. There is no set small enough to be exempt: two
buttons side by side carry a code for the same reason a rail beside a result region carries one.
"It is only two items" is where this rule is skipped most often, and it is skipped in the exact
place where a longer label, a second line or a narrower screen later breaks the row.

## Situation codes

The code names the SITUATION. The className column names what that situation emits — and two codes
emit nothing, because "the browser already arranges this correctly" is a decision, not an absence of
one.

| Code | Situation | className |
|---|---|---|
| `FLOW-0` | Exactly one child, in every state the container can be in | *no flow class* |
| `FLOW-1` | Words and inline phrases inside a sentence; line-breaking arranges them | *no flow class* |
| `FLOW-2` | A row that must stay on one line | `flex` |
| `FLOW-3` | A stack read from top to bottom | `flex flex-col` |
| `FLOW-4` | A row of independent items allowed to spill onto further lines | `flex flex-wrap` |
| `FLOW-5` | A row that becomes a stack when the width is gone | `flex flex-col <bp>:flex-row` |
| `FLOW-6` | Interchangeable items in a column count the product decides | `grid <bp>:grid-cols-<n>` |
| `FLOW-7` | Interchangeable items whose column count follows a minimum item width | `grid grid-cols-[repeat(auto-fill,minmax(<min>,1fr))]` |
| `FLOW-8` | Tracks with distinct roles and independently owned widths | `grid <bp>:grid-cols-[<track>_minmax(0,1fr)]` |

The numbering is grouped by family, not by size. `FLOW-0` and `FLOW-1` declare nothing. `FLOW-2`
through `FLOW-5` are the single-axis family: one axis at a time, with two different answers to
running out of width. `FLOW-6` through `FLOW-8` are the grid family: two axes at once, differing
only in **who decides the column count** — the product, the item's legibility floor, or the roles of
the tracks themselves.

**The two codes that emit nothing are not the same code.** `FLOW-0` says there is no axis to
declare: one child, and one child has no direction relative to anything. `FLOW-1` says the axis
exists and is already owned by line-breaking: a sentence runs along the inline axis and wraps at
word boundaries, and no class needs to say so. They are separate codes because they fail in opposite
directions. Getting `FLOW-0` wrong means a container that grows a second child later and arranges it
by accident. Getting `FLOW-1` wrong means someone writes `flex` on a paragraph, at which point every
word becomes a flex item, the spaces between words stop being spaces, and the text stops wrapping
like text. That defect is impossible to name if the situation has no code.

**The column count is always declared somewhere.** A grid without a declared count is not a grid, it
is a stack that borrowed the wrong family name. `FLOW-6` — the product declares it: three benefits
across, two fields per row; the count is a content decision and therefore changes at breakpoints the
author writes. `FLOW-7` — the item declares it, through the width below which it stops being
readable; the author writes one minimum and never writes a breakpoint, and the count is whatever
fits. `FLOW-8` — the roles declare it; tracks are not interchangeable, a rail is a rail at its own
width and the content track takes what is left.

**Wrapping and gridding are not the same answer.** A wrapping row and a grid look alike on a wide
screen and diverge the moment the items differ in size. A wrapped line does not align to the line
above it; a grid row does. So the discriminator is never how it looks when it fits — it is:

> Must item four line up under item one, or must it merely find somewhere to sit?

If alignment across lines carries meaning — comparable cards, a form's fields, a price table — the
situation is a grid. If the items are a bag of chips, tags or filters whose order matters but whose
columns do not, the situation is a wrapping row.

## Reading a request

1. **List the containers the request states.** "A filter sidebar on the left and cards on the right"
   states two: the page area holding the rail and the result region, and the region holding the
   cards.
2. **Do not invent a container the request never mentions.** A page header, a pagination bar or a
   card footer is not in that request. Resolve what is stated; resolve the rest when it arrives.
3. **Resolve outermost first**, then each nested container. Every container gets its own answer; a
   parent never inherits its child's code. One code applies to one set of siblings, never to a whole
   tree.
4. **For each container, name the direct children and ask that code's question** in the section for
   each code. State how many children there are in the loaded, empty, single-item and error states,
   because the code follows the set and not today's data.
5. **If one container mixes two axes, nest before choosing.** Two axes among one set of children
   means a parent is missing. If two codes both seem to match, the boundary paragraph in each code's
   section names the fact that separates them; `FLOW-2` and `FLOW-4` are mutually exclusive and
   declaring both declares neither.
6. **If one deciding fact is genuinely missing, ask one specific question and stop.** The answer is
   either a class string or a question — never both.

## `FLOW-0` — one child, no axis to declare

**Situation.** The container wraps exactly one thing, and no state makes it more than one. With no
second thing there is no direction between two things at all.

**Recognition signs**

- One direct child in the loaded state, the empty state and the error state.
- The container exists for another reason: a rounded corner, a background, a maximum width, or a
  named region.
- Remove `flex` and the screen does not change.

**Ask yourself.** Is there any state of the data that makes this container grow a second child? If
not — `FLOW-0`.

**Boundary**

- `FLOW-3`: a list that returns one result today is still `FLOW-3`. The code follows the set, not
  today's data.
- `FLOW-1`: `FLOW-0` is one child; `FLOW-1` is many children that are words in one sentence.

**Never write `flex` for one child.** It declares an axis that does not exist, and it silently
changes the behaviour of that single child: a block child shrinks to its content, `w-full` stops
working, and outer margins collapse differently. A meaningless declaration is still a declaration
with consequences.

**Common business situations.** Page width wrapper · the background area of a section · a rounded
box holding one chart · a wrapper that only exists to set `position` · an image frame · a container
holding a single paragraph · the viewport of an overlay.

## `FLOW-1` — words in a sentence, line-breaking already arranges them

**Situation.** The children are words, phrases, links, small badges and icons inside a sentence. The
inline axis is already there, and what arranges them is the browser's line-breaking algorithm rather
than a class.

**Recognition signs**

- It reads as a sentence, not as a list.
- There are real spaces between the parts, and those spaces carry meaning.
- A line break is allowed to fall between any two words, not only at the boundary between parts.

**Ask yourself.** If a line break fell in the MIDDLE of one part, would that be correct? If yes —
this is a sentence, not a row.

**Boundary**

- `FLOW-2`: a row read as clusters in order — icon then label — is `FLOW-2`. A sentence with an icon
  set into it is `FLOW-1`.
- `FLOW-4`: `FLOW-4` wraps by item; `FLOW-1` wraps by word.

**Putting `flex` on a paragraph breaks it.** Every DOM node becomes a flex item: the spaces between
nodes disappear, clauses jam together or drift apart uncontrollably, and the paragraph loses the
ability to break mid-clause — the one behaviour prose cannot lose.

**Common business situations.** A description sentence with a bold course name set into it · terms
text with a link · an error message with an error code inside it · "3 days left" with a number set
in · a caption with a unit · a description with a small badge inside it · a greeting with the user's
name.

## `FLOW-2` — one row, one line, no wrapping

**Situation.** The items run horizontally and MUST stay on one line. Wrapping here breaks meaning: a
toolbar snaps in half, one row of a list becomes twice as tall as its neighbours.

**Recognition signs**

- There is a main item and one or a few secondary items at the ends.
- The height of the row is a constant the reader's eye relies on to scan downward.
- When space runs short, what yields is an item's WIDTH, not its position.

**Ask yourself.** If the last item dropped to a second line, would this row still read correctly? If
not — `FLOW-2`.

**Boundary**

- `FLOW-4`: `FLOW-2` forbids wrapping, `FLOW-4` permits it. The two are mutually exclusive;
  declaring both declares neither.
- `FLOW-5`: if the whole row should become a stack when narrow rather than have one item cut down,
  that is `FLOW-5`.

**A one-line row must say who yields.** Who shrinks, who holds, who is truncated belongs to the
overflow module. `FLOW-2` only states that this line may not break; it does not settle the
consequence of that promise, but it forces the author to settle it.

**Common business situations.** A list row with a name on the left and an amount on the right · a
card header with a title and a menu button · icon + label inside one button · avatar + name · a
short breadcrumb · a total line · label + status badge · a player's control bar.

## `FLOW-3` — a stack read from top to bottom

**Situation.** The children run vertically and the top-to-bottom order IS the reading order. This is
the most common code and also the most often skipped, because blocks already stack and people assume
nothing needs declaring.

**Recognition signs**

- Each child takes the full width and competes with no other child for width.
- The order carries meaning: label then field, heading then content.
- The number of children can change with state without changing how it reads.

**Ask yourself.** If two children swapped places, would the reader be misled? If yes — the order
carries meaning, and the vertical axis must be said out loud.

**Boundary**

- `FLOW-0`: one child is no stack at all.
- `FLOW-6`: a `grid` with one column that never declares a count at any breakpoint is `FLOW-3`
  written in the wrong family. Say the axis with `flex-col` so it appears in the class list.

**Why it must be declared even though blocks already stack.** Because `gap` only lives in flex and
grid. An undeclared stack gets seamed with `margin` on the children — exactly the defect the gap
module forbids. Declaring the vertical axis is the precondition for the seam belonging to the
parent.

**Common business situations.** Label + field · heading + section content · the sections of a page ·
the body of a card · a comment list · the steps of a process · a button group stacked on mobile · a
form.

## `FLOW-4` — a row allowed to spill onto further lines

**Situation.** A BAG of independent items of the same kind with different natural widths. Order
carries meaning, but COLUMNS do not. An item that does not fit drops to the next line, and nothing
is cut.

**Recognition signs**

- Each item's width comes from its own content, and the items differ in length.
- The number of items is not known in advance: the user adds tags, filters, skills.
- The second line does NOT need to align with the first.

**Ask yourself.** Does item four need to sit directly under item one? If it does NOT — `FLOW-4`.

**Boundary**

- `FLOW-2`: see above.
- `FLOW-6` and `FLOW-7`: if alignment CARRIES meaning — to compare, to read as a table, to keep
  cards the same height — this is the grid family, not wrapping.
- `FLOW-1`: `FLOW-4` wraps by item, `FLOW-1` wraps by word.

**"It fits right now" is not an argument.** Two small badges that fit today will not fit with a
longer translation, a longer user name, or a larger text setting. If the set can grow longer, the
code is `FLOW-4` from the start.

**Common business situations.** Tags · badge-shaped filters · a skill list · the status badges of a
course · a group of secondary buttons · a participant list as avatar + name · short answer options ·
a chart legend.

## `FLOW-5` — a row when wide, a stack when narrow

**Situation.** One set, two axes at two widths. When space runs out the whole set CHANGES AXIS
rather than breaking a line: each item takes the full width and the set reads top to bottom.

**Recognition signs**

- The items are NOT interchangeable: one side is content, the other is an action or a figure.
- When narrow, every item needs the full width to be read or tapped.
- There are only two or three items, and they do not form a bag.

**Ask yourself.** When narrow, should this set BREAK A LINE or CHANGE AXIS? If the items need the
full width — change axis, `FLOW-5`.

**Boundary**

- `FLOW-4`: wrapping keeps the horizontal axis and only breaks lines; `FLOW-5` abandons the
  horizontal axis at the narrow width. A bag of badges is never `FLOW-5`; two action buttons usually
  are.
- `FLOW-2`: `FLOW-2` holds one line at every width and pays for it with truncation; `FLOW-5` does
  not pay that price.
- `FLOW-6`: if the items are interchangeable and need to align in columns, this is a grid whose
  column count changes at a breakpoint.

**Write it narrow-first.** `flex flex-col sm:flex-row`, not `flex flex-row sm:flex-col`. The default
state must be the safest state, so that a width nobody thought about still reads. This is also the
only place `flex-row` has a reason to exist: it UNDOES `flex-col` at a breakpoint.

**Common business situations.** The content and button group of a call-to-action block · a page
title + primary action · image + copy of an intro block · a form footer with a secondary and a
primary button · a search box + filter button · a figure cluster + caption cluster · a card that is
horizontal on desktop and vertical on mobile.

## `FLOW-6` — the product decides the column count

**Situation.** The items are INTERCHANGEABLE and must ALIGN IN COLUMNS, and the number of columns is
a content decision: three benefits across, two fields per row, four figures on one line.

**Recognition signs**

- The items are the same kind with the same role, and the reader compares them with one another.
- There is a "right" number of columns, and that number comes from the content rather than from the
  screen width.
- Cells in the same row should be the same height.

**Ask yourself.** Does this column count come from the CONTENT (three benefits, two fields) or from
the WIDTH (however many fit)? If from the content — `FLOW-6`.

**Boundary**

- `FLOW-7`: `FLOW-6` writes the count and the breakpoints; `FLOW-7` writes no breakpoint at all. If
  you are hesitating over "how many columns at medium", the real question is probably the item's
  minimum width — `FLOW-7`.
- `FLOW-4`: see above.
- `FLOW-3`: a `grid` that declares no count anywhere is `FLOW-3` written in the wrong family.

**One implicit column at the base width is valid** when a later breakpoint declares a count: `grid
sm:grid-cols-2` states plainly that the base width is one column. A bare `grid` declares nothing.

**Common business situations.** First name and last name fields · three overview figures · four plan
benefits · a grid of multiple-choice options · a three-tier price table · a fixed photo grid · the
day grid of a month.

## `FLOW-7` — the item's minimum width decides the column count

**Situation.** A set of UNKNOWN LENGTH, where each item has a width below which it stops being
readable. The column count is not a product decision; it is a CONSEQUENCE of the width that remains.

**Recognition signs**

- The number of items comes from data and changes with filters.
- You can say a sentence like "below 16rem the course title tangles and the image means nothing".
- This container is reused at several widths: full page, inside a rail, inside a dialog.

**Ask yourself.** Is there a width BELOW WHICH the item loses meaning? If there is, declare that
width and let the column count follow.

**Boundary**

- `FLOW-6`: see above. The deciding sign is the BREAKPOINT: `FLOW-7` has none.
- `FLOW-4`: wrapping does not make the items equal and does not align them in columns; `FLOW-7` does
  both.

**`auto-fill` and `auto-fit` are two different answers to the single-item state.** `auto-fill` keeps
the empty tracks, so a lone item stays at one item's width. `auto-fit` collapses them, so a lone
item stretches across the row. Choose by what the ONE-RESULT state must look like, and say which one
was chosen — this is where the choice is most often made out of habit.

**Common business situations.** A search result grid · a filtered course catalogue · a photo library
· a member list · a template grid · an attachment list · the article grid of a blog page.

## `FLOW-8` — tracks with distinct roles

**Situation.** The tracks are NOT interchangeable. Each has its own job and its own owned width: a
filter rail at a fixed width, a content region taking what is left, a pinned panel on the right.

**Recognition signs**

- Swapping the two tracks would change what the page means.
- At least one track's width is a layout decision, not a consequence of content.
- One track can disappear, be pinned, or scroll independently on a large screen.

**Ask yourself.** Could these two regions be swapped for each other? If NOT — `FLOW-8`.

**Boundary**

- `FLOW-6`: `grid-cols-2` says "two equal columns holding two things of the same kind". `FLOW-8`
  says "a rail and a content region". Using `grid-cols-2` for a rail forces the rail to half the
  page.
- `FLOW-5`: `FLOW-5` also changes axis when narrow, but its items do not own their own widths.

**The content track is always `minmax(0,1fr)`.** `1fr` has a floor of `min-content`, so the content
track refuses to shrink below the longest thing inside it: an unbreakable file name, a table, a code
block. The rail is then squeezed or the whole page scrolls sideways, and `truncate` inside silently
stops working. This is the most time-consuming defect in the whole module, because it looks like an
overflow defect.

**Common business situations.** Filter rail + results · navigation + content · file tree + editor ·
conversation list + chat pane · content + pinned table of contents · catalogue + cart · form +
preview pane.

## Inputs

| Input | Evidence required |
|---|---|
| child count | How many direct children in the loaded, empty, single-item and error states |
| interchangeability | Are the children members of one set, or parts with distinct jobs |
| reading order | Does meaning depend on left-to-right, on top-to-bottom, or on neither |
| cross-line alignment | Must a later item line up with an earlier one, or only fit |
| width ownership | Does an item's width come from its content, the container, or a product decision |
| legibility floor | Is there a width below which an item stops being readable |

## Rules

1. The parent declares the flow. No child declares the axis it sits on.
2. One parent, one flow. Two axes among one set of children means a parent is missing.
3. Row is the default axis: `flex` alone is already a row. `flex-row` is written only to undo
   `flex-col` at a breakpoint, which is `FLOW-5`.
4. A row either holds one line or wraps. `FLOW-2` and `FLOW-4` are mutually exclusive; declaring
   both declares neither.
5. A wrapped line never aligns to the line above it. Needing that alignment moves the situation into
   the grid family.
6. A column does not wrap. `flex-col flex-wrap` with no declared height wraps nothing and reads as a
   decision that was never made.
7. Every grid declares its column count literally, by minimum width, or by named tracks.
8. In `FLOW-8` the content track is `minmax(0,1fr)`, never `1fr`.
9. Visual order equals DOM order. Reversal and reordering utilities are not flow declarations.
10. A narrower screen does not change the code. `FLOW-5`, `FLOW-6` and `FLOW-7` already contain
    their own answer to running out of width.
11. Empty, single-item and skeleton states keep the parent's code.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and names the situation it
applies to.

- **One child that a state can multiply is not `FLOW-0`.** A list rendering one result today is the
  same situation as the list rendering nine. Declare the flow the set requires, not the flow today's
  data happens to permit.
- **A sentence that contains a chip, a link or an icon is still `FLOW-1`.** Inline children do not
  make a row. Wrapping them in `flex` removes the ability to break between words, which is the one
  behaviour prose cannot lose.
- **Two items that always fit are still `FLOW-4`** when a longer translation, a longer name or a
  larger text setting can make them not fit. "It fits in the mockup" is a statement about the
  mockup.
- **A single implicit column is `FLOW-6` only when a breakpoint later declares a count.** `grid`
  with no count at any width is `FLOW-3` written in the wrong family.
- **`auto-fit` and `auto-fill` are one code with two behaviours.** `auto-fill` keeps empty tracks, so
  a lone item stays its minimum width; `auto-fit` collapses them, so a lone item stretches across
  the row. Choose by what the single-item state must look like, and say which one was chosen.
- **Skeleton and content share the code.** A resting state that stacks where the loaded state rows
  predicts a layout that will never exist.

## Output

One block per container, outermost first:

```text
parent: <container>
children: <direct children, and how many in each state>
axis: <none | inline | row | column | grid>
wrap: <not allowed | may wrap | reflows to a column | grid rows>
situation: <FLOW-0 | FLOW-1 | FLOW-2 | FLOW-3 | FLOW-4 | FLOW-5 | FLOW-6 | FLOW-7 | FLOW-8>
className: <no class | flex | flex flex-col | flex flex-wrap | flex flex-col <bp>:flex-row | grid <bp>:grid-cols-<n> | grid grid-cols-[repeat(auto-fill,minmax(<min>,1fr))] | grid <bp>:grid-cols-[<track>_minmax(0,1fr)]>
reason: <business fact that excludes the adjacent code>
```

## Worked example

**Request.** "A course catalogue: a filter rail on the left and the results on the right; above the
results a strip of filter chips the user can add to; the results are cards, as many as the search
returns; each card shows its title with a level badge beside it on one line."

The request states five containers: the page area holding the rail and the results, the results
region holding the chip strip and the card set, the chip strip, the card set, and the title line
inside a card. It states no page header, no pagination and no card footer, so none of those are
resolved.

```text
parent: page area
children: filter rail, results region — 2 in every state
axis: grid
wrap: grid rows
situation: FLOW-8
className: grid lg:grid-cols-[16rem_minmax(0,1fr)]
reason: swapping the rail and the results would change what the page means and the rail's width is a layout decision, which excludes FLOW-6
```

```text
parent: results region
children: chip strip, card set — 2 in every state
axis: column
wrap: not allowed
situation: FLOW-3
className: flex flex-col
reason: the chips are read before the results and neither competes for width, which excludes FLOW-5
```

```text
parent: chip strip
children: filter chips — unknown count, grows as the user adds filters
axis: row
wrap: may wrap
situation: FLOW-4
className: flex flex-wrap
reason: chip four does not need to sit under chip one, which excludes FLOW-7
```

```text
parent: card set
children: course cards — as many as the search returns, one in the single-result state, none when empty
axis: grid
wrap: grid rows
situation: FLOW-7
className: grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]
reason: the count follows the width left over rather than a product number, which excludes FLOW-6
```

```text
parent: card title line
children: title, level badge — 2 in every state
axis: row
wrap: not allowed
situation: FLOW-2
className: flex
reason: the badge dropping to a second line would make one card taller than its neighbours in the same grid row, which excludes FLOW-4
```

The request does not state what the one-result state must look like, so `auto-fill` was chosen and
is named here: a single card keeps one card's width rather than stretching across the row. It also
does not state the rail's contents, so the rail's own flow is not resolved; resolve it when the
request says what sits inside it.

## Scope

This module decides **axis and wrap** only. Cross-axis alignment, seam size, who yields width when a
row is too tight, and the padding of any box belong to neighbouring modules; examples carry those
classes so the markup reads as real markup, but they are never the reason a code was chosen.

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is an ordinary `className` on ordinary markup.
