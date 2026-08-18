# Distribution

## LOADS

None.

## Record

You are given a plain request in prose — "a file row with an icon, the file name, the size and a
delete button" — and you return, for every participant that request implies, one situation code and
one className. The request never states a width and you never estimate one: the width follows from
what each participant does when there is space left over and what it does when there is not enough.

## Law

A row has one width and more than one claim on it. Distribution is the decision of **who takes the
surplus, who gives way to the deficit, and who holds still through both**.

The space is divided among **participants**. A participant is a direct child of the distributing
parent, or a seam between two of them. Every participant answers the same two questions — what do
you do when there is space left over, and what do you do when there is not enough — and the pair of
answers is the code.

**When the two answers disagree, the deficit decides the code.** A child may take surplus and still
refuse the deficit; it is named by its refusal, because the refusal is the fact that breaks the row.
Surplus is a matter of appearance. Deficit is a matter of whether the row still holds its contents.

**This is binding, not advisory.** Any parent that lays its children along an axis — a flex row, a
flex column, a grid — gives every one of its participants a distribution situation, and that
situation has a code below. There is no row too small to have one: an icon beside a label is
`DIST-3` next to `DIST-1` for the same reason a fixed rail beside a result region is `DIST-5` next
to `DIST-1`. "It is only an icon and a label" is not an exemption — it is the row where the first
long name in production pushes the icon off the card.

## Situation codes

The code names the SITUATION — one participant's role in dividing one axis of one parent. The
className column names what that situation emits, and one of the codes emits nothing.

| Code | Situation | className |
|---|---|---|
| `DIST-0` | The participant takes its natural size and nothing is declared about it | *no distribution class* |
| `DIST-1` | One child takes the whole surplus and absorbs the whole deficit | `min-w-0 flex-1` |
| `DIST-2` | Several children divide the axis between them in equal measure | `min-w-0 flex-1` on each · `grid-cols-<n>` |
| `DIST-3` | A child that must never shrink, whatever the row is asked to hold | `shrink-0` |
| `DIST-4` | A child that must be permitted to shrink, though it takes no surplus | `min-w-0` |
| `DIST-5` | A child that holds a measure decided by layout, not by its content | `w-64 shrink-0` · track `16rem` |
| `DIST-6` | No child takes the surplus; a chosen seam takes it | `ml-auto` · parent `justify-between` |

`DIST-0` IS A SITUATION, NOT A BLANK. A flex child that declares nothing is not neutral: it already
refuses to grow, and it already agrees to shrink — but only down to the width of its own content,
and not one pixel further. That floor is invisible in every mockup and decisive in production. The
code exists because "nothing declared" is a case a reader must be able to recognise, cite and be
corrected against. A situation with no name is a situation nobody can be shown to have got wrong,
and this is the situation that is got wrong most often — not by choosing it, but by arriving at it.

`min-w-0` is a permission, not a style. A flex child's minimum size is its content. Until that
minimum is released, the child does not shrink: it holds its full content width and pushes its
sibling out of the row instead. Nothing appears broken in the class list — the row simply stops
being a row. This is why `DIST-4` exists as a code of its own, and why `DIST-1` and `DIST-2` carry
`min-w-0` in their emission rather than leaving it to be remembered. **A truncation, a clamp or a
scroll box inside a row is inert until every link of the chain between the row and that element has
been given permission to shrink.** One `min-w-0` on the outer child does not release a nested child
three levels down. On the block axis the same law reads `min-h-0`.

A declared width does not hold. Writing a width on a flex child states a preference, not a rule.
Flex shrinking is on by default, so that child gives up its declared measure the moment the row is
short — quietly, proportionally, and without any sign that a number was ever written. `DIST-5` is
therefore always two declarations: the measure, and the refusal to give it up. In a grid the same
fact reads differently: a `1fr` track has an automatic minimum, so a track holding long content
refuses to shrink and stretches the grid past its container. `minmax(0,1fr)` is the grid spelling of
`min-w-0`, and it is required for the same reason.

The seam is a participant. Free space that no child claims does not vanish; it collects somewhere.
`DIST-6` is the decision to put it in a chosen seam instead of inside a child — the difference
between a title that stretches and a title that stays its own width while the action moves to the
far edge. This module owns **who** receives the space; the resting distance between siblings is a
different decision. A seam given surplus by `DIST-6` is a gap that grew, not a gap that was chosen
larger.

## Reading a request

1. **List the distributing parents the request states**, and for each one name its axis. "A file row
   with an icon, the file name, the size and a delete button" states one parent, one inline axis.
2. **Do not invent a participant the request never mentions.** A rail, a second column or a menu is
   not in that request. Resolve what is stated; resolve the rest when it arrives.
3. **Resolve outermost first**, then each nested distributing parent. A participant's code belongs
   to one axis of one parent; a child never inherits the code of the row inside it.
4. **For each participant ask the two questions** — what does it do with surplus, what does it do
   with deficit — and read the sections below. The first code whose situation matches is the answer.
   When the two answers disagree, the deficit decides.
5. **Check the row can hold.** At most one child is `DIST-1` per axis per parent, and at least one
   participant must be able to absorb the deficit. A row of only `DIST-3` and `DIST-5` has declared
   in advance that it will overflow.
6. **If two codes both match, prefer the code that declares less.** If one parent mixes roles that
   cannot coexist, nest before choosing.

## `DIST-0` — nothing declared, and that is still a behaviour

**Situation.** Nothing in the row is long enough to compete for space: every child is short, closed
content, and their total width is always less than the row. Nobody needs priority, nobody needs
protection.

**Ask yourself.** Is there any real data that makes the children's total width exceed the row? If
there is none — `DIST-0`.

**Boundary**

- `DIST-3`: `DIST-0` is "there has never been a deficit"; `DIST-3` is "there may be one, but this
  child is exempt from giving way". If even one child in the row comes from user-entered data, the
  row is no longer `DIST-0`.
- `DIST-4`: both take no surplus, but `DIST-0` stops at the content floor and pushes its sibling
  out; `DIST-4` is when that floor is the thing that must be removed.

## `DIST-1` — one child takes the whole row

**Situation.** Exactly one thing in the row is real content of unpredictable length, and everything
else is an accessory around it: avatar, icon, badge, button, timestamp. That content both takes the
surplus and is the one that gives way to the deficit.

**Ask yourself.** If the longest possible string lands in this row, who gives way? If there is only
one such participant and it is also the one entitled to the leftover space — `DIST-1`.

**Boundary**

- `DIST-2`: `DIST-1` is **one** child taking everything; `DIST-2` is several dividing it. Two
  children both carrying `flex-1` are not two `DIST-1` — that is `DIST-2` misspelled.
- `DIST-4`: `DIST-4` gives way but takes no surplus. If the child must shrink yet must not stretch
  to the edge, it is `DIST-4`, not `DIST-1`.
- `DIST-3` carrying `grow`: if the child grows but must never be cut, the deficit decides — it is
  `DIST-3`, and the row must find someone else to give way.

`min-w-0` is part of this code, not an addition. Without it the child grows exactly as expected when
wide and does **not** shrink when narrow — it pushes its sibling out of the row. This is the failure
that reports nothing: the class list still reads correctly, only the row has stopped being a row.

## `DIST-2` — several children divide the axis equally

**Situation.** Nobody in the row outranks anybody. The children are **peer** items, and equal width
is the message itself: these things can be compared with each other.

**Ask yourself.** Is equal width here a business statement ("these things rank the same"), or does
it merely happen to look even?

**Boundary**

- `DIST-1`: see above.
- `DIST-5`: if **one** of the columns must hold a fixed measure, that column is `DIST-5` and only
  the rest divide what is left.
- Equal share of the axis versus equal share of the surplus are two different things. `flex-1`
  produces equal columns; `grow` keeps each child's content width and divides only the leftover.
  Both are `DIST-2`; the discriminator is whether equality is between the columns or between the
  additions.

The number of columns is a layout decision, not a decision of each child. When the item count
changes with the data, declare the column count on the parent instead of letting each child compute
its own fraction.

## `DIST-3` — never shrink, whatever the row must hold

**Situation.** Something in the row loses everything when it loses a part: an icon squashed into an
oval, a button with its word swallowed, a number cut in half. These are not allowed to be the one
that gives way.

**Ask yourself.** If this got 30% smaller, would the reader be **misled**, or simply read less? If
misled — `DIST-3`.

**Boundary**

- `DIST-0`: `DIST-0` is a row that has never been short; `DIST-3` is a row that can be short with
  this child exempted. Once a `DIST-1` stands beside them, every accessory in the row needs to be
  stated as `DIST-3`.
- `DIST-5`: `DIST-3` takes its measure from **its own content** and locks it; `DIST-5` takes its
  measure from a **layout decision**.
- `DIST-1`: a child carrying both `grow` and `shrink-0` is still `DIST-3` — the deficit decides.

`shrink-0` says exactly one thing; `flex-none` says two. `flex-none` forbids both shrinking and
growing, and refusing to grow is already the default. Say the one thing you mean, so the next reader
does not have to guess which half was intentional.

## `DIST-4` — must be permitted to shrink, but takes no surplus

**Situation.** This child **must give way** when the row is narrow, but must not swell when the row
is wide. It takes exactly what it needs and returns space when space is demanded.

**Ask yourself.** Must this get smaller when the row is narrow, and should it hold still when the
row is wide? If both are true — `DIST-4`.

**Boundary**

- `DIST-1`: `DIST-1` gives way **and** takes; `DIST-4` only gives way.
- `DIST-0`: both take no surplus, but `DIST-0` stops at the content floor while `DIST-4` is exactly
  the case where that floor must be lifted.

This is the most frequently missed code, and missing it produces no error to read. Every `truncate`
inside a row needs `min-w-0` on **every link** between the row and the element that is cut. One
`min-w-0` on the outermost child does not unlock a child three levels in. On the block axis the law
reads `min-h-0`: a column that must scroll inside a bounded parent grows past its ceiling instead of
scrolling until its minimum height is released.

## `DIST-5` — a measure decided by layout

**Situation.** This child's width is a **layout decision**, not a consequence of content. The filter
rail is 16rem wide because that is the size chosen for the rail, not because the longest label
inside it measures that much.

**Ask yourself.** Where does this number come from — from the longest content inside, or from a
layout decision already settled? If from the layout decision — `DIST-5`.

**Boundary**

- `DIST-3`: see above. `DIST-3` locks a **content size**; `DIST-5` locks **a number**.
- `DIST-2`: if every column is decided by layout and they are **equal**, that is `DIST-2` in grid
  form, not several `DIST-5`.

Writing the width alone does not hold it. Flex shrinking is **on** by default, so a child with
`w-64` quietly becomes narrower than 64 when the row is short, with no sign that a number was ever
there. `DIST-5` is always **two** declarations: the measure, and the refusal to give it up. In a
grid the same fact reads differently: a `1fr` track has an automatic floor, so a track holding long
content **stretches the whole grid** past its container. `minmax(0,1fr)` is the grid spelling of
`min-w-0`, and it is required for the same reason.

## `DIST-6` — the surplus falls into a seam, not into any child

**Situation.** Every child in the row wants to keep its own width, but the row must still span the
full measure: one side sits hard left, the other hard right. The leftover has to go somewhere — and
it goes into **the space between**.

**Ask yourself.** Is the thing I want to grow a **child**, or the **seam** between children?

**Boundary**

- `DIST-1`: this is the most expensive confusion in the module. `flex-1` on the title also pushes
  the button right — but it simultaneously turns the title into the participant that absorbs the
  whole deficit, and the title's press target now stretches across the empty space. If the intent is
  to **push**, use `DIST-6`.
- The resting distance between siblings is a separate decision; `DIST-6` owns who receives the
  **leftover**. A seam widened by `DIST-6` is a seam that was stretched, not one that was chosen
  larger.

Never use an empty element to push. A `<div className="flex-1" />` is a child with no content and no
meaning, and screen readers still traverse it as an element. Surplus is claimed by a seam, not by a
fake child. And `justify-between` with three children answers a different question: it divides the
surplus among **every** seam. When only one seam should open, group the children into two, or put
`ml-auto` on exactly the child that opens that seam.

## Rules

1. Every participant of a distributing parent resolves to exactly one code, on exactly one axis.
2. Deficit behaviour decides the code; surplus behaviour never overrides it.
3. Every row contains at least one participant able to absorb the deficit. A row of `DIST-3` and
   `DIST-5` only has declared, in advance, that it will overflow.
4. At most one child is `DIST-1` per axis per parent. Two children claiming the whole surplus is
   `DIST-2` misspelled.
5. `min-w-0` is required on every link of the chain from the row to the element that yields.
6. A declared measure is always paired with a refusal to shrink.
7. Empty elements are never used to push. Space is claimed by a seam, not by a spacer child.
8. Percentage and fraction widths are not distribution declarations in a parent that also draws a
   seam: the seam is added on top of them and the row overruns.
9. The code does not change with viewport. A narrower screen makes the deficit more likely, not
   different.
10. Skeleton and loaded content carry the same code on the same participant.

## Exceptions

Exceptions are PART of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **A grower that must never be cut.** A child that takes surplus but must keep its content intact
  is `DIST-3` carrying `grow`, not `DIST-1`. The deficit decides. Some other participant in that row
  must then be `DIST-1`, `DIST-2` or `DIST-4`, or the row has nobody to give way.
- **Equal share of the row versus equal share of the surplus.** `DIST-2` emits `flex-1` when the
  columns must end up equal to each other, and `grow` when each child keeps its content measure and
  only the leftover is split. Both are `DIST-2`; the discriminator is whether equality is between
  the columns or between the additions.
- **Numbers, prices, identifiers and controls are `DIST-3` even beside a `DIST-1` sibling.** A value
  the reader cannot verify once shortened is not allowed to be the participant that gives way.
- **A single child is not a distribution situation.** One child in a row divides nothing; give it a
  code only when a second participant exists.
- **Two codes both match.** Prefer the code that declares less: `DIST-0` over `DIST-3` when nothing
  in the row can push, `DIST-4` over `DIST-1` when the child must yield but was never meant to fill.
  Ask one discriminating question only when the requester states that the larger role is required.
- **Responsive.** A participant changes code only when the parent it belongs to changes — a rail
  that becomes a stacked block above the content is a different parent, not the same rail behaving
  differently.
- **Block axis.** The same code set, read as `min-h-0`, `shrink-0` and `flex-1` on the block axis. A
  scroll region inside a flex column does not scroll until its minimum height is released.

## Output

One block per participant, outermost parent first:

```text
parent: <flex row | flex column | grid>
axis: <inline | block>
participant: <the child, or the seam>
surplus: <takes all | equal share | none | into the seam>
deficit: <absorbs | refuses | content floor>
situation: <DIST-0 | DIST-1 | DIST-2 | DIST-3 | DIST-4 | DIST-5 | DIST-6>
className: <no class | min-w-0 flex-1 | shrink-0 | min-w-0 | w-* shrink-0 | ml-auto>
reason: <business fact that excludes the adjacent code>
```
