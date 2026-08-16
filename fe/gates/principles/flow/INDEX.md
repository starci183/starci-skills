---
id: fe-principles-flow-index
title: INDEX.md
slug: /gates/principles/flow
sidebar_label: flow
sidebar_position: 0
description: Binding rules for which axis content runs along and whether that axis may wrap.
template: principles-v2
---

# INDEX.md

Version: `2.00` · Module: `flow`

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

## Situation Codes

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

## The two codes that emit nothing are not the same code

`FLOW-0` says there is **no axis to declare**: one child, and one child has no direction relative to
anything. `FLOW-1` says the axis exists and is **already owned by line-breaking**: a sentence runs
along the inline axis and wraps at word boundaries, and no class needs to say so.

They are separate codes because they fail in opposite directions. Getting `FLOW-0` wrong means a
container that grows a second child later and arranges it by accident. Getting `FLOW-1` wrong means
someone writes `flex` on a paragraph, at which point every word becomes a flex item, the spaces
between words stop being spaces, and the text stops wrapping like text. That defect is impossible to
name if the situation has no code.

## The column count is always declared somewhere

A grid without a declared count is not a grid, it is a stack that borrowed the wrong family name.
The three grid codes differ only in who declares the count:

- `FLOW-6` — the **product** declares it: three benefits across, two fields per row. The count is a
  content decision and therefore changes at breakpoints the author writes.
- `FLOW-7` — the **item** declares it, through the width below which it stops being readable. The
  author writes one minimum and never writes a breakpoint; the count is whatever fits.
- `FLOW-8` — the **roles** declare it. Tracks are not interchangeable: a rail is a rail at its own
  width, and the content track takes what is left.

## Wrapping and gridding are not the same answer

A wrapping row and a grid look alike on a wide screen and diverge the moment the items differ in
size. A wrapped line does not align to the line above it; a grid row does. So the discriminator is
never how it looks when it fits — it is:

> Must item four line up under item one, or must it merely find somewhere to sit?

If alignment across lines carries meaning — comparable cards, a form's fields, a price table — the
situation is a grid. If the items are a bag of chips, tags or filters whose order matters but whose
columns do not, the situation is a wrapping row.

## Inputs

| Input | Evidence required |
|---|---|
| child count | How many direct children in the loaded, empty, single-item and error states |
| interchangeability | Are the children members of one set, or parts with distinct jobs |
| reading order | Does meaning depend on left-to-right, on top-to-bottom, or on neither |
| cross-line alignment | Must a later item line up with an earlier one, or only fit |
| width ownership | Does an item's width come from its content, the container, or a product decision |
| legibility floor | Is there a width below which an item stops being readable |

## Invariants

- The parent declares the flow. No child declares the axis it sits on.
- One parent, one flow. Two axes among one set of children means a parent is missing.
- Row is the default axis: `flex` alone is already a row. `flex-row` is written only to undo
  `flex-col` at a breakpoint, which is `FLOW-5`.
- A row either holds one line or wraps. `FLOW-2` and `FLOW-4` are mutually exclusive; declaring both
  declares neither.
- A wrapped line never aligns to the line above it. Needing that alignment moves the situation into
  the grid family.
- A column does not wrap. `flex-col flex-wrap` with no declared height wraps nothing and reads as a
  decision that was never made.
- Every grid declares its column count literally, by minimum width, or by named tracks.
- In `FLOW-8` the content track is `minmax(0,1fr)`, never `1fr`.
- Visual order equals DOM order. Reversal and reordering utilities are not flow declarations.
- A narrower screen does not change the code. `FLOW-5`, `FLOW-6` and `FLOW-7` already contain their
  own answer to running out of width.
- Empty, single-item and skeleton states keep the parent's code.

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

```text
parent: <container>
children: <direct children, and how many in each state>
axis: <none | inline | row | column | grid>
wrap: <not allowed | may wrap | reflows to a column | grid rows>
situation: <FLOW-0 | FLOW-1 | FLOW-2 | FLOW-3 | FLOW-4 | FLOW-5 | FLOW-6 | FLOW-7 | FLOW-8>
className: <no class | flex | flex flex-col | flex flex-wrap | flex flex-col <bp>:flex-row | grid <bp>:grid-cols-<n> | grid grid-cols-[repeat(auto-fill,minmax(<min>,1fr))] | grid <bp>:grid-cols-[<track>_minmax(0,1fr)]>
reason: <business fact that excludes the adjacent code>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module decides **axis and wrap** only. Cross-axis alignment, seam size, who yields width when a
row is too tight, and the padding of any box belong to neighbouring modules; examples carry those
classes so the markup reads as real markup, but they are never the reason a code was chosen.

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is an ordinary `className` on ordinary markup.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
