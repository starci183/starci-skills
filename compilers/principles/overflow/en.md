---
title: Overflow
---

# Overflow

You are given a plain request in prose — "a list of attachments, each row showing the file name and
its size" — and you return, for every box that request implies, one situation code and one
className. The request never states how long the real data will be, and you never wait to see it
break: you look at the box before the data arrives and ask who yields when the longest real value
turns up.

## Law

Space is finite and content is not. Decide **in advance** which one gives way: the content is cut,
the content wraps, the box scrolls, or the box grows.

A composition that does not decide has still decided — it handed the decision to the browser, and
the browser answers by breaking the layout. A name that pushes a price out of its column, a rail
that grows past the viewport and strands its own last action, a table that makes the whole page
scroll sideways: none of these are rendering bugs. Each is an undeclared overflow situation.

**This is binding, not advisory.** Any box that can receive content of unbounded length carries an
overflow situation, and that situation has a code below. "The text is short in the mockup" is not an
exemption — it is the assumption that produces every one of the failures above the first time real
data arrives.

## Situation codes

Every situation this module governs carries a code, `OVERFLOW-<n>`. The code names the SITUATION;
the className column names what that situation emits. They are not the same thing, and two of them
emit nothing, because deciding to let content grow is a decision, not an absence of one.

| Code | Situation | className |
|---|---|---|
| `OVERFLOW-0` | The content has a closed, known length; no box can be overrun | *no overflow class* |
| `OVERFLOW-1` | One line, recognisable from its start; the tail may be lost | `truncate` |
| `OVERFLOW-2` | Prose read for its gist; a fixed number of lines is enough | `line-clamp-<n>` |
| `OVERFLOW-3` | Cutting changes or destroys the meaning; it must wrap in full | `break-words` |
| `OVERFLOW-4` | The box owns a height ceiling and its content scrolls inside it | `max-h-* overflow-y-auto` |
| `OVERFLOW-5` | The content is wider than the column and scrolls sideways in its own frame | `overflow-x-auto` |
| `OVERFLOW-6` | Siblings in one row compete for width; who yields must be declared | `min-w-0 flex-1` · `flex-none` |
| `OVERFLOW-7` | Content owns the height; the ceiling belongs to an ancestor, not here | *no overflow class* |

THE TWO CODES THAT EMIT NOTHING ARE NOT THE SAME CODE. `OVERFLOW-0` says overflow **cannot happen** —
the value comes from a closed set, or is a number of known width. `OVERFLOW-7` says overflow **is
allowed to happen** and is somebody else's ceiling: a page section grows to fit its content and the
viewport scrolls. Writing a ceiling on an `OVERFLOW-7` box is the single most common way a screen
ends up with two scrollbars. They are separate codes because they fail differently. Getting
`OVERFLOW-0` wrong means real data eventually breaks a box nobody guarded. Getting `OVERFLOW-7`
wrong means the box is guarded twice.

Two classes decide whether a correct-looking declaration does anything at all, and both are
counter-intuitive. **`min-w-0` on a flex child**: a flex item's default minimum width is its content,
so `truncate` on a child of a row is ignored — the child refuses to shrink below its text and
instead pushes its sibling out of the row. `OVERFLOW-1`, `OVERFLOW-2` and `OVERFLOW-6` inside a row
all require it. **`min-h-0` on a flex child that scrolls**: the same rule on the block axis. A scroll
box inside a flex column grows to its content and overruns its parent's ceiling rather than scroll,
until its minimum height is released. A declaration that omits these has not failed loudly — it has
failed silently, which is worse.

## Reading a request

1. **List the boxes the request states.** "A list of attachments, each row showing the file name and
   its size" states four: the list region, the row, the name cell and the size cell.
2. **Do not invent a box the request never mentions.** A dialog, a search field, a header or a fixed
   height is not in that request. Resolve what is stated; resolve the rest when it arrives.
3. **Resolve outermost first**, then each box inside. Every box gets its own answer; a code applies
   to one box, never to a whole tree. A grid can be `OVERFLOW-7` while the cards inside it are
   `OVERFLOW-1` and `OVERFLOW-2`.
4. **For each box, name the longest real value it can receive and ask the question** in the section
   for each code: is the length closed, does losing the tail lose meaning, is there a recovery path,
   does it overrun inline or block, and which ancestor owns the ceiling. The first code whose
   situation matches is the answer.
5. **A row and the cells inside it are different decisions.** The row decides who yields
   (`OVERFLOW-6`); each cell decides what happens to its own value. Two codes on one row is normal,
   and three is common.
6. **If two codes both match, one fact separates them.** Closed in every shipped language or not;
   missing information or wrong information; overflow impossible or overflow permitted; a sibling
   that must always be visible or none. If that fact is genuinely absent from the request, ask one
   specific question and stop. The answer is a className or a question, never both.

## `OVERFLOW-0` — nothing can overrun

**Situation.** The value comes from a **closed set** you control, or is a number of known width. No
real datum exists that can break this box, so declaring overflow here is a lie about a risk that
does not exist.

**Recognition signs**

- The longest possible string can be listed, now, by hand.
- The content comes from no user, no third party and no open translation table.
- The maximum width follows from the format: two digits of percentage, one currency symbol, one of
  four status labels.

**Ask yourself.** Can I list **every** value this cell can receive? If I can, and the list does not
change with the data — `OVERFLOW-0`.

**Boundary**

- `OVERFLOW-1`: a set that is closed **in one language only** was never closed. A status label three
  times longer in translation is `OVERFLOW-1`.
- `OVERFLOW-3`: a number **can** be unusually long — a large amount, a view count — and still must
  not be cut. If the width cannot be derived, it is no longer `OVERFLOW-0`.
- `OVERFLOW-7`: `OVERFLOW-0` says overflow is **impossible**; `OVERFLOW-7` says overflow is
  **permitted** and somebody else caps it.

**Common business situations.** Status label from a fixed set · progress percentage · page number ·
rank · star count · level label · unit symbol · avatar initials · a button label you wrote yourself
in a settled language · streak count.

## `OVERFLOW-1` — one line, recognised from its start

**Situation.** The value is **an identity** the reader recognises at the front: a person's name, a
file name, a title, an email address. Losing the tail loses detail; it does **not** lose
recognition and does **not** change the meaning.

**Recognition signs**

- The heaviest information sits at the start of the string.
- Two different values almost never agree on their first 20 characters.
- There is a way back to the full value: a tooltip, a detail page, or the row itself being
  clickable.

**Ask yourself.** Looking only at the first half of the string, does the reader recognise **this**
record and no other?

**Boundary**

- `OVERFLOW-2`: `OVERFLOW-1` cuts to **keep the row one line high** — the height is a convention of
  the row. `OVERFLOW-2` cuts to **keep density** — the reader really is reading the content, just
  not all of it.
- `OVERFLOW-3`: if cutting makes the value **wrong** rather than incomplete — an amount, an order
  code, an error code — it is never `OVERFLOW-1`.
- `OVERFLOW-6`: `OVERFLOW-1` is the decision of the **cell**; `OVERFLOW-6` is the decision of the
  **row that holds it** about who yields. Inside a flex row the two codes almost always appear
  together.

**No recovery path, no code.** Cutting without offering a way to see the whole value deletes data in
front of the reader. Hard clipping with no ellipsis is worse still: it is silent data loss, not a
code.

**Common business situations.** Course title in a card · attachment file name · email in a member
row · notification title · branch name · subject line in a mailbox · person's name in a leaderboard
· tab title · the middle link of a breadcrumb · organisation name in a context switcher.

## `OVERFLOW-2` — prose read for its gist

**Situation.** The paragraph is read to **take the point**, not to be read through in place. Two to
four lines are enough for the reader to decide whether to open it, and holding every card in a grid
to one height has real business value: it makes them comparable.

**Recognition signs**

- The content is sentences, not an identity.
- There is somewhere to read it in full: a detail page, a panel, or an expand control.
- Left to grow freely, neighbouring items fall out of alignment and lose comparability.

**Ask yourself.** On this screen, is the reader **scanning** or **reading**? Scanning is
`OVERFLOW-2`; reading is `OVERFLOW-7`.

**Boundary**

- `OVERFLOW-1`: one line is `OVERFLOW-1` — say so. `line-clamp-1` is `truncate` wearing a heavier
  class.
- `OVERFLOW-7`: the main body of an article is **not** line-clamped. Clamping there hides the thing
  the reader came for.
- `OVERFLOW-4`: a clamp **throws away** the excess; scrolling **keeps** it. Choose the clamp when
  the excess is not worth holding here, scrolling when it is.

**The line count is a business decision.** It says "this much is enough to choose by". Do not tune
it to flatter one card, and do not vary it by viewport; change it when the definition of "enough to
choose by" changes.

**Common business situations.** Course description in a card grid · article excerpt · review body in
a list · shortened prompt in an exercise list · message preview in a mailbox · product description
in a card · note in a table · change summary in a history.

## `OVERFLOW-3` — cutting is wrong, so it wraps

**Situation.** The value **loses or changes its meaning** when cut. The reader has no way of knowing
it was cut, so what they read is **wrong** information, not missing information.

**Recognition signs**

- It is a number, a code, an identifier, a path, or an error message.
- The tail carries the distinguishing information: the end of an order code, the end of a URL, the
  end of an error sentence.
- The string may contain no spaces at all, so the browser has nowhere to break it.

**Ask yourself.** If the tail of this string were cut, would the reader **believe** they were
looking at the complete value? Yes — `OVERFLOW-3`.

**Boundary**

- `OVERFLOW-1`: this is the most frequently crossed boundary. A person's name can be cut because it
  is recognised from the front; an amount cannot, because `1.299.000đ` cut to `1.299` is a different
  number and still looks valid.
- `OVERFLOW-5`: if the thing that is too wide is **a structured block** — a table, a code snippet —
  it cannot wrap and must scroll sideways. `OVERFLOW-3` is for strings of text, not for grids.
- `OVERFLOW-2`: a line clamp is a form of cutting. `OVERFLOW-3` content is never line-clamped.

**A string with no spaces needs saying out loud.** A long URL or a design token is a single "word"
to the browser; it must be allowed to break **inside the word** or it will push the column apart.
`break-words` keeps words whole and breaks only a word longer than the line; `break-all` breaks
anywhere and belongs to machine-readable strings only.

**Common business situations.** Amounts · order codes · error codes · discount codes · wallet
addresses · file paths · a URL the user pasted · validation error messages · an email address on a
detail page · phone numbers · a file name in a failing upload · a measured value with its unit.

## `OVERFLOW-4` — the box owns the ceiling and scrolls inside it

**Situation.** The list may be **unbounded**, but the region it sits in must keep its shape so that
the things around it stay usable: a dialog's confirm action must always be visible, a header must
stay put, a panel must not stretch past the screen.

**Recognition signs**

- The excess is **worth keeping**: the reader will want to see more of it, not skip it.
- There is a sibling that must always be present — an action footer, a header, a summary bar.
- The number of items is decided by the data, not by the design.

**Ask yourself.** Is there something beside this region that the reader **must always see**? Yes —
the ceiling belongs here, and this is `OVERFLOW-4`.

**Boundary**

- `OVERFLOW-7`: this is the boundary that produces two scrollbars. If this region only needs to grow
  and let the page scroll, it is `OVERFLOW-7` and a ceiling here is redundant.
- `OVERFLOW-2`: see above — the clamp discards the excess, the scroll keeps it.
- `OVERFLOW-5`: the same mechanism on the other axis. One box can be both `OVERFLOW-4` and
  `OVERFLOW-5`, but then it scrolls in two directions and that must be deliberate.

**The scrolling box is its own box.** It is not also the surface: the surface keeps the padding, the
radius, the shadow and the always-visible parts; the scrolling box sits **inside** it and does one
job. Put `overflow-y-auto` on the surface itself and the first thing to scroll away is the surface's
own padding, the shadow is clipped at the seam, and anything sticky inside is confined to a box the
reader cannot see out of. This is a structural consequence of the code, not a styling preference.

**A sticky element belonging to the scrolling content** — the header row of a long table — belongs
inside the scrolling box, because it belongs to the content. An element belonging to the **surface**
— an action footer, a panel's search bar — inside the scrolling box is wrong, because it belongs to
the frame.

**Scrolling inside an overlay must contain its overscroll.** When the scrolling box sits in an
overlay and the reader hits the bottom without containment, the page behind scrolls on and they lose
their place.

**Common business situations.** Dialog body with an action footer · search suggestion list ·
conversation panel · notification panel · multi-select list · cart inside a panel · activity log in
a card · member list in an invite dialog · a kanban column.

## `OVERFLOW-5` — wider than the column, scrolling in its own frame

**Situation.** The content has **horizontal structure** that cannot be reduced: the columns of a
table, the lines of a code snippet, a strip of chips. Dropping a column drops data; forcing a wrap
destroys the structure.

**Recognition signs**

- The minimum width of the content is a fact, not a choice.
- Wrapping misaligns the rows and the table can no longer be read down its columns.
- Space is short only on narrow screens; on wide screens nothing overflows at all.

**Ask yourself.** Would taking width away here **lose data or break the structure**? Yes —
`OVERFLOW-5`.

**Boundary**

- `OVERFLOW-3`: a long string of text wraps; a structured block scrolls sideways.
- `OVERFLOW-6`: `OVERFLOW-6` settles the competition **between siblings in a row** by naming who
  shrinks. `OVERFLOW-5` is when **nobody can shrink** and the whole block must slide.
- `OVERFLOW-7`: a section that only grows taller is `OVERFLOW-7`; a block that grows wider always
  needs its own frame.

**Horizontal scrolling never climbs to the body.** A page that scrolls sideways is broken, not a
presentation. The scrolling frame must close at the column that holds it, and that column must be
allowed to narrow or the frame does nothing.

**Hiding the scrollbar removes the only signal.** If the scrollbar is hidden for appearance, another
signal must say there is more to the right: a fade at the edge, an arrow control, or snap points.

**Common business situations.** Wide table on a phone · code snippet · filter chip strip ·
horizontal timeline · week calendar grid · plan comparison table · thumbnail strip · a tab bar with
too many items.

## `OVERFLOW-6` — in a row, who yields must be declared

**Situation.** Several elements sit in **one row** and their combined desired width exceeds the row.
Leave it undeclared and the browser decides, and the way it decides is to push the last element out
of the row or to squeeze an element that must not be squeezed.

**Recognition signs**

- The row has a **shrinkable** part — a name, a title, a description — and a part that **must not
  shrink**: a button, a status label, a price, an avatar, an icon.
- The unshrinkable part has fixed meaning: cutting it loses a function or a value.
- On a narrow screen, exactly the element on the right is the first to disappear.

**Ask yourself.** In this row, which element **may** lose detail, and which **may not**? Answer that
and you already have `OVERFLOW-6`.

**Boundary**

- `OVERFLOW-1`: `OVERFLOW-1` says that cell truncates; `OVERFLOW-6` says that cell is the yielding
  side. Without the second half, the first half **silently does nothing** — a flex item refuses by
  default to be narrower than its own content.
- `OVERFLOW-5`: when **no** element in the row may shrink, there is no competition left to settle;
  it is a wide block and belongs to `OVERFLOW-5`.
- `OVERFLOW-0`: a row made only of closed-set values has no competition to declare.

**Both sides are declared, or neither works.** `flex-1` without `min-w-0` is half a declaration, and
the missing half is the half that has an effect. Marking everything unshrinkable is the same as
declaring nobody yields. When both sides may lose detail, the ratio still has to say which loses
first — otherwise the browser decides by the length of the data rather than by importance.

**Common business situations.** List row with a name and a button · card header with a title and a
status label · top bar with a breadcrumb and an action group · file row with a name and a size ·
member row with an email and a role · lesson row with a title and a duration · transaction row with
a description and an amount · comment row with a name and a timestamp.

## `OVERFLOW-7` — the content owns the height

**Situation.** This region is **allowed to be as tall as its content**. The only ceiling is the
viewport, and the viewport already has its own way of scrolling. Nothing is declared here — and that
is a decision, not a blank.

**Recognition signs**

- No sibling needs to stay visible.
- The reader came here to read it all, not to glance at it.
- Putting a ceiling here would create a second scrollbar nested inside the page's own.

**Ask yourself.** Does anyone **other than the viewport** need to cap the height of this region? No
— `OVERFLOW-7`.

**Boundary**

- `OVERFLOW-4`: the only difference is **who owns the ceiling**. The same list is `OVERFLOW-4` in a
  dialog body with a footer, and `OVERFLOW-7` placed directly on a page.
- `OVERFLOW-0`: `OVERFLOW-0` is *overflow impossible*; `OVERFLOW-7` is *overflow permitted with
  somebody else responsible*.
- `OVERFLOW-2`: an `OVERFLOW-2` region **becomes** `OVERFLOW-7` for as long as it is expanded. It
  does not grow a second ceiling.

**One ceiling per axis per ancestor chain.** Two ancestors both capping height are two scrollbars,
and the reader will scroll the wrong one at least once before they understand. A height inherited
down a chain where nobody actually sets one has no effect: a ceiling needs a real owner, either the
viewport or an ancestor with a definite height.

**`OVERFLOW-7` is not "forgot to declare".** It is the conclusion that this region may grow, and
that conclusion has to be sayable out loud when the review asks.

**Common business situations.** Article body · a section on a home page · a long form column · card
grid on a catalogue page · order detail page · paginated search results · tab content on a page ·
the main content area between two rails.

## Inputs

| Input | Evidence required |
|---|---|
| content bound | Is the length closed, or can real data be arbitrarily long? |
| loss tolerance | Does losing the tail lose meaning, or only detail? |
| recoverability | Can the reader recover the full value — tooltip, expand, detail view? |
| axis | Does it overrun inline (width) or block (height)? |
| ceiling owner | Which ancestor owns the height limit: this box, a rail, or the viewport? |

## Rules

1. Consider **each box** before the data exists, at the greatest length real data can reach.
2. Every box that can receive unbounded content resolves to exactly **one** code.
3. Truncation always carries a **recovery path** to the full value; without one, the code is wrong.
4. Numbers, codes and identifiers are **never** truncated.
5. A scrolling box is not also a surface: padding, radius, shadow and must-always-be-seen elements
   sit outside it.
6. Horizontal scrolling closes inside its own frame; **the page body never scrolls sideways**.
7. One axis, one ceiling, per ancestor chain.
8. In a flex row, declare **both** sides: who yields and who holds.
9. Changing the viewport does **not** change the code. A narrower screen makes overflow more likely,
   not different.
10. `min-w-0` on a truncating or shrinking flex child, and `min-h-0` on a scrolling flex child, are
    required for the declaration to have any effect at all.

Beyond these: a situation code maps to exactly one className, no className serves two codes, and
every box that can receive unbounded content resolves to exactly one code. No composition is out of
scope.

## Exceptions

Exceptions are PART of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **Numbers and codes never truncate.** They are `OVERFLOW-3` even when the label right beside them
  is `OVERFLOW-1`. One row is perfectly allowed to carry two different codes in two cells.
- **Two lines is the floor for `line-clamp`.** `line-clamp-1` does not exist in this rule:
  `line-clamp-1` is `truncate` wearing a heavier class, so choose `OVERFLOW-1` and say what you
  mean.
- **A closed vocabulary is `OVERFLOW-0` in every language it ships in.** If translation can make a
  fixed label arbitrarily long, the vocabulary was never closed, and the code is `OVERFLOW-1`.
- **Skeleton and content share the code.** A resting state whose placeholder wraps where the real
  value truncates predicts a layout that will never happen.
- **An expand control changes the code, not the box.** "Read more" moves a region from `OVERFLOW-2`
  to `OVERFLOW-7` for as long as it is open; it does not add a second ceiling.
- **A sticky element inside a scrolling box** is valid only when it belongs to the **scrolling
  content** — the header row of a long table. An element belonging to the **surface** must sit
  outside the scrolling box of that `OVERFLOW-4` situation.
- **Hard clipping with no signal is forbidden.** Hiding the excess with no ellipsis, no scrolling
  frame and no expand control is silent data loss — not a code, a defect.
- **Hiding a scrollbar must return another signal.** An `OVERFLOW-5` frame with no signal at all is
  a scrolling frame the reader does not know can scroll.

## Output

One block per box, outermost first:

```text
box: <the element that receives the content>
axis: <inline | block>
bound: <closed | unbounded>
situation: <OVERFLOW-0 | 1 | 2 | 3 | 4 | 5 | 6 | 7>
className: <no class | truncate | line-clamp-n | break-words | max-h-* overflow-y-auto | overflow-x-auto | min-w-0 flex-1 | flex-none>
recovery: <how the reader reaches the full value, or "none needed">
reason: <business fact that excludes the adjacent code>
```

## Worked example

**Request.** "A page listing the attachments of an order. Each row shows the file name and the file
size, and the whole row links to the attachment's detail page."

The request states four boxes: the list region on the page, the row, the name cell and the size
cell. It states no dialog, no header that must stay visible and no fixed height, so no scrolling box
is resolved. It states no description prose and no status label, so neither a clamp nor a closed-set
cell is resolved.

```text
box: attachment list region
axis: block
bound: unbounded
situation: OVERFLOW-7
className: no class
recovery: none needed
reason: nothing beside the list has to stay visible while it grows, so no ancestor other than the viewport owns a ceiling, which excludes OVERFLOW-4
```

```text
box: attachment row
axis: inline
bound: unbounded
situation: OVERFLOW-6
className: min-w-0 flex-1 · flex-none
recovery: none needed
reason: the name may lose detail while the size may not, so the row has a yielding side to declare, which excludes OVERFLOW-5
```

```text
box: file name cell
axis: inline
bound: unbounded
situation: OVERFLOW-1
className: truncate
recovery: the row links to the attachment's detail page
reason: a file name is recognised from its start and cutting it leaves the reader with less detail rather than a false value, which excludes OVERFLOW-3
```

```text
box: file size cell
axis: inline
bound: unbounded
situation: OVERFLOW-3
className: break-words
recovery: none needed
reason: a measured value cut short reads as a smaller, valid-looking number, which excludes OVERFLOW-1
```

When the request later moves this list into a dialog whose confirm action must stay visible, the
list region becomes `OVERFLOW-4` and the ceiling moves to it; the row and the two cells keep their
codes. If the request instead adds four more columns that must be read down, the row stops having a
yielding side and becomes `OVERFLOW-5`.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is an ordinary `className` on ordinary markup.
