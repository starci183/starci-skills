---
id: fe-principles-density-index
title: INDEX.md
slug: /gates/principles/density
sidebar_label: density
sidebar_position: 0
description: Binding rules for choosing a density declaration from the context a subtree sits in, never from the component itself.
template: principles-v2
---

# INDEX.md

Version: `2.00` · Module: `density`

## Law

Density is how tightly repeated information packs. It is decided by the **context a subtree sits
in** — the reader's task in that region — and never by the component doing the sitting.

A component does not know how densely it should render, because the answer is not a property of the
component. The same row of a name, a status and an amount is spacious on a page that is trying to
persuade one reader of one thing, and compact in a table where the same reader is comparing two
hundred of them. Nothing inside the row changes between those two readings. Only the context does.

This is the whole reason the rule exists. When a component is allowed to answer the question itself,
the answer arrives as a prop — `size`, `dense`, `compact`, `variant="sm"` — and that prop grows one
new value per call site, because each call site is a context and the component has been made to
carry every context it will ever be placed in. The context declaring density once, above, replaces
all of them.

Visual preference selects nothing. "It looks cramped", "make it breathe", "fit more above the fold",
a screenshot, a designer's screen width and the amount of empty space left over are not evidence.
The evidence is the reader's task: dwelling on one thing, working through a few, or scanning many.

**This is binding, not advisory.** Every rendered subtree sits in exactly one density situation and
carries exactly one code below. There is no subtree too small to have one: a two-button toolbar is
`DENSITY-0` for the same reason a transactions table is `DENSITY-3` — because both of them are
answering the question, and only one of them is answering it out loud. "It is just one component"
is not an exemption; it is the most common place the rule gets skipped, and it is skipped by adding
a size prop.

## Situation Codes

Every situation this module governs carries a code, `DENSITY-<index>`. The code names the SITUATION;
the className column names what that situation emits. They are not the same thing, and one of them
emits nothing.

| Code | Situation | className |
|---|---|---|
| `DENSITY-0` | The subtree declares nothing and inherits the enclosing context | *no density class* |
| `DENSITY-1` | Spacious: one reader dwelling on one thing, to read or to be persuaded | `[--density:1]` |
| `DENSITY-2` | The default working density: a task with a handful of members | `[--density:2]` |
| `DENSITY-3` | Compact: scanning, comparing or operating on many members at once | `[--density:3]` |

The declaration paints nothing by itself, and that is deliberate. Everything density would otherwise
paint is already owned: the seam between siblings belongs to the relationship rule, a boundary's own
inset belongs to the boundary rule, and a line's size belongs to the line-ownership rule. If the
declaration painted, it would be overruling three modules from a distance. So it declares, and the
region's repeating members read the declaration and write the rhythm below.

Declaring in the markup rather than only in someone's head is what makes the rule reviewable. A
region whose density is a decision nobody wrote down cannot be audited, and cannot be inherited
correctly by anything placed inside it later.

`DENSITY-0` IS A SITUATION, NOT AN ABSENCE OF ONE. There is no `[--density:0]` class, and adding one
is a rule change rather than a shortcut: inheriting a context is a different fact from declaring the
context to be nothing. `DENSITY-0` is the correct and expected answer for almost every component
ever written — a row, a card, a field, a button. The code exists because "this component does not
decide" is a case a reader must be able to recognise, cite and be corrected against. A situation
with no name is a situation nobody can be shown to have got wrong, and the wrong answer here is a
size prop.

The indices run `0`–`3` without holes, unlike a measurement scale. These are not four amounts of
space with room between them; they are four kinds of context, and there is nothing between
"persuading one reader" and "working through a few" to split the difference on. A request to insert
`DENSITY-1.5` is a request for a fifth kind of reading task, and must be argued as one.

### Rhythm the code fixes

Density moves **only what repeats** inside the region. A member that appears once, at one size, in
one place, is not repeating and is not density's business.

| Repeating member | `DENSITY-1` | `DENSITY-2` | `DENSITY-3` |
|---|---|---|---|
| Control box (button, input, select, trigger) | `h-11 px-4` | `h-9 px-3` | `h-7 px-2` |
| Icon inside a control | `size-5` | `size-4` | `size-3.5` |
| Media token in a repeated row (avatar, thumbnail) | `size-12` | `size-10` | `size-8` |
| Repeated row or cell inset | `p-4` | `p-3` | `p-2` |
| Table cell inset | `px-4 py-3` | `px-3 py-2` | `px-2 py-1` |

A subtree at `DENSITY-0` writes the rhythm of the context it inherits. It does not get its own
column, because it does not have its own answer.

## Inputs

| Input | Evidence required |
|---|---|
| context | The nearest ancestor that declares a density, or the root |
| task | Dwell on one, work through a few, or scan and compare many |
| volume | How many members of the same shape the region renders at once |
| pointer | Whether the region's members are operated by touch |
| region boundary | Where the declared context starts and stops |

## Invariants

- The context declares density; the component never requests it.
- A component takes no `size`, `dense` or `compact` prop. It reads the declaration above it.
- One region declares one density. A subtree that needs a different one is a new declared region.
- Density moves only what repeats. It never moves a seam, a boundary's own inset, or a line's size.
- The outermost context must declare. `DENSITY-0` at the root inherits from nothing and is an error.
- A declaration is written where the context begins, not sprinkled on every wrapper inside it.
- Density changes how tightly information packs, never which information is present. Dropping a
  field is disclosure, not density.
- Skeleton, empty, error and loaded states of one region share one code.
- A situation code maps to exactly one className, and no className serves two codes.
- Every rendered subtree resolves to exactly one code. No component is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **Nested region with a different task.** A table inside a spacious page declares `DENSITY-3` out
  loud. It does not inherit `DENSITY-1` and then compensate per element.
- **Reset out loud.** A subtree that needs the default back inside a compact region declares
  `DENSITY-2`. Declaring nothing is `DENSITY-0` and means "keep inheriting", which is the opposite
  of a reset. The reset is written, never assumed.
- **Overlay.** A menu, popover or picker opened from a control inherits the density of the region
  that opened it, not of the layer it renders into. The reader's task did not change when the layer
  did. If the overlay's own content is a long scanning list, it declares `DENSITY-3` for that reason
  and not because it is an overlay.
- **Touch floor.** `DENSITY-3` never takes an interactive member below the touch target minimum. A
  region whose members are tapped on a touch pointer is `DENSITY-2` at the least, and a compact
  variant of that region is a separate pointer-conditioned region, not a smaller control.
- **Two codes both match.** Fall back to `DENSITY-2`. Ask one discriminator question only when the
  requester explicitly states reading volume or persuasion intent.
- **Responsive.** A breakpoint does not change density. It changes axis, column count and what is
  visible. Density changes only if the region's task changes with it — for example a table that
  becomes a stack of single records on a narrow pointer-driven screen.

## Output

```text
context: <nearest declaring ancestor, or root>
region: <the subtree being decided>
situation: <DENSITY-0 | DENSITY-1 | DENSITY-2 | DENSITY-3>
className: <no density class | [--density:1] | [--density:2] | [--density:3]>
rhythm: <control box · media token · row inset the code fixes>
reason: <task fact that excludes the adjacent code>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is an ordinary `className` on ordinary markup.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
