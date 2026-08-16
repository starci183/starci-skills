---
id: fe-principles-overflow-index
title: INDEX.md
slug: /fe/principles/overflow
sidebar_label: overflow
sidebar_position: 0
description: Binding rules for what gives way when content is longer or taller than the space it was given.
template: principles-v2
---

# INDEX.md

Version: `2.00` · Module: `overflow`

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

## Situation Codes

The code names the SITUATION. The className column names what that situation emits — and two codes
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

## The two codes that emit nothing are not the same code

`OVERFLOW-0` says overflow **cannot happen** — the value comes from a closed set, or is a number of
known width. `OVERFLOW-7` says overflow **is allowed to happen** and is somebody else's ceiling: a
page section grows to fit its content and the viewport scrolls. Writing a ceiling on an
`OVERFLOW-7` box is the single most common way a screen ends up with two scrollbars.

They are separate codes because they fail differently. Getting `OVERFLOW-0` wrong means real data
eventually breaks a box nobody guarded. Getting `OVERFLOW-7` wrong means the box is guarded twice.

## The scrolling box is its own owner

A box that scrolls does not also draw padding, shadow, radius or a sticky child. Put
`overflow-y-auto` on the surface itself and its own inset is what scrolls away first: the padding
scrolls off the top, the shadow is clipped at the seam, and anything sticky inside is confined to a
box the reader cannot see out of.

So an `OVERFLOW-4` or `OVERFLOW-5` situation introduces **one dedicated box** whose only job is to
scroll, sitting inside the surface and holding the content. The surface keeps its shape; the inner
box keeps the scroll. This is a structural consequence of the code, not a styling preference.

## The two classes that make scrolling and truncation work at all

Both are counter-intuitive and both are the reason a correct-looking declaration silently does
nothing.

- **`min-w-0` on a flex child.** A flex item's default minimum width is its content, so `truncate`
  on a child of a row is ignored: the child refuses to shrink below its text, and instead pushes its
  sibling out of the row. `OVERFLOW-1`, `OVERFLOW-2` and `OVERFLOW-6` inside a row all require it.
- **`min-h-0` on a flex child that scrolls.** The same rule on the block axis. A scroll box inside a
  flex column will grow to its content and overrun its parent's ceiling rather than scroll, until
  its minimum height is released.

A declaration that omits these has not failed loudly — it has failed silently, which is worse.

## Inputs

| Input | Evidence required |
|---|---|
| content bound | Is the length closed, or can real data be arbitrarily long? |
| loss tolerance | Does losing the tail lose meaning, or only detail? |
| recoverability | Can the reader recover the full value — tooltip, expand, detail view? |
| axis | Does it overrun inline (width) or block (height)? |
| ceiling owner | Which ancestor owns the height limit: this box, a rail, or the viewport? |

## Invariants

- Every box that can receive unbounded content resolves to exactly one code.
- Truncation always leaves a way to recover the full value, or it is the wrong code.
- A scrolling box holds no padding, radius, shadow or sticky child of its own.
- Horizontal scrolling is confined to its own frame. **The page body never scrolls sideways.**
- One ceiling per axis per chain. Two ancestors both capping height produces two scrollbars.
- A row declares who yields and who holds; leaving both undeclared is not a default, it is a defect.
- The code does not change with viewport. A narrower screen makes overflow more likely, not different.

## Exceptions

Exceptions are part of the rule, not relief from it.

- **Numbers and codes never truncate.** A truncated price, quantity, error code or identifier is not
  shortened, it is **wrong** — a reader cannot tell `1.299.000đ` cut short from a smaller number.
  These are `OVERFLOW-3` even where a neighbouring label is `OVERFLOW-1`.
- **Two lines is the floor for `line-clamp`.** `line-clamp-1` is `truncate` wearing a heavier class;
  choose `OVERFLOW-1` and say what you mean.
- **A closed vocabulary is `OVERFLOW-0` in every language it ships in.** If translation can make a
  fixed label arbitrarily long, the vocabulary was never closed, and the code is `OVERFLOW-1`.
- **Skeleton and content share the code.** A resting state whose placeholder wraps where the real
  value truncates predicts a layout that will never happen.
- **An expand control changes the code, not the box.** "Read more" moves a region from `OVERFLOW-2`
  to `OVERFLOW-7` for as long as it is open; it does not add a second ceiling.

## Output

```text
box: <the element that receives the content>
axis: <inline | block>
bound: <closed | unbounded>
situation: <OVERFLOW-0 | 1 | 2 | 3 | 4 | 5 | 6 | 7>
className: <no class | truncate | line-clamp-n | break-words | max-h-* overflow-y-auto | overflow-x-auto | min-w-0 flex-1 | flex-none>
recovery: <how the reader reaches the full value, or "none needed">
reason: <business fact that excludes the adjacent code>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is an ordinary `className` on ordinary markup.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
