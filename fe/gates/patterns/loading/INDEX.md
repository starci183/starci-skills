---
id: fe-patterns-loading-index
title: INDEX.md
slug: /gates/patterns/loading
sidebar_label: loading
sidebar_position: 0
description: Binding rules for how a surface draws itself while the data it shows is still on its way.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `loading`

## Law

A surface waiting for data draws **the same shape it will draw when the data arrives**, with the
values taken out. Not a different tree, not a stack of grey bars that happens to look similar — the
same components, in the same arrangement, resting.

The reason is drift, and it is not hypothetical. A second tree describing the first is a description
that nobody updates: it is correct on the day it is written, and wrong the first time the real shape
changes. Nothing turns red, because a resting shape has no assertion to fail — it is simply wrong on
screen, and only for the second somebody happens to be watching.

The question that settles it: **if this component changes shape tomorrow, does the waiting version
change with it?** If it does not, it is a second description and it will drift.

**This is binding, not advisory.** Anything that renders before its data has arrived is in one of the
seven situations below. There is no surface too small to be in one: a single line of copy is
`LOADING-2` for the same reason a whole dashboard column is `LOADING-6`. "It is only a spinner" is
not an exemption — it is the most common place the rule gets skipped.

### How the two halves meet

This is the seam most often got wrong, so it is written down rather than inferred. A block and a leaf
express waiting differently, and the translation between them is one line:

| Tier | How waiting is expressed |
|---|---|
| block | `pending` is a member of the state union — a real situation, beside `ready`, `empty`, `failed` |
| leaf, composite | `isLoading`, a flag received and never decided |
| the seam | `const isLoading = input.state === "pending"` in the presentational half |

The block owns the SITUATION because only it knows whether the answer has arrived. The leaf owns the
LOOK of resting because only it knows its own anatomy. Neither can do the other's half, and the one
line between them is where they meet.

## Situation Codes

Every situation this module governs carries a code, `LOADING-<n>`. The code names the SITUATION; the
requirement column names what a surface in that situation must do.

| Code | Requires | Forbids |
|---|---|---|
| `LOADING-1` | The component that draws the data draws the waiting | A twin whose job is to mirror another's shape; a ready-made placeholder handed in as a prop |
| `LOADING-2` | Same tag, same arrangement, same measure — values gone, a resting surface in their place | A ternary at a call site choosing between two DIFFERENT components |
| `LOADING-3` | The resting region stands at the height of a real one; the repeat count is a declared decision | A region that draws nothing while waiting |
| `LOADING-4` | A resting element is hidden from assistive technology | A shimmer, or an emptied value, announced as if it were content |
| `LOADING-5` | A control appears only once it has somewhere to go | A pressable target drawn over a destination that does not exist yet |
| `LOADING-6` | Each region resolves on its own request and lands when it lands | One waiting flag shared across independent requests |
| `LOADING-7` | `pending` is a member of the state union and carries what the frame needs | Treating waiting as `undefined`, `null` or "no data yet" |

The numbering runs `1`–`7` with no holes and no reserved rungs. Unlike a scale, these are not degrees
of one thing: `LOADING-3` is not more of `LOADING-2`. They are seven distinct ways the same surface
can lie about what it knows, and a surface can be in several of them at once.

## Tầng giữ

Which tier actually holds each code. `unrepresentable` means a closed union or branded type makes the
wrong value impossible to write; `enforced` means a lint rule from
[`sources/fe/loading.mjs`](../../../../sources/fe/loading.mjs) reports it; `documented` means nothing
mechanical holds it and only a reader does.

| Code | Tier | What holds it |
|---|---|---|
| `LOADING-1` | `enforced` | `no-resting-twin-component` and `no-placeholder-prop` |
| `LOADING-2` | `enforced` | `no-resting-branch-at-call-site` |
| `LOADING-3` | `unrepresentable` | The child-spec union: `repeats: true` cannot be written without `restingCount: number`, and `repeats: false` cannot carry one |
| `LOADING-4` | `documented` | Nothing. A missing `aria-hidden` on a resting element compiles, passes lint and renders |
| `LOADING-5` | `documented` | Nothing. The branch rule EXEMPTS a `null` arm rather than requiring one — an exemption is not an enforcement |
| `LOADING-6` | `documented` | Nothing. One flag threaded through four regions is ordinary, well-typed code |
| `LOADING-7` | `documented` | Nothing. A union may legally omit `pending`; the type system cannot know a member is missing |

Four codes rest on a reader alone. That is the point of stating the tier rather than the rule: a law
whose tier is unwritten is read as if enforcement existed, and the first person to trust that reading
ships the defect the law was written to prevent. What each of the four would need in order to move up
a tier is in [`audit.md`](./audit.md).

`LOADING-3`'s tier holds the DECLARATION, not the render. A repeating region cannot be declared
without stating how many rows it rests as; nothing forces those rows onto the screen.

## Anchor

Real code each law can be checked against. A law that cannot be pointed at in real code is a
proposal, not a law. Paths are relative to the front-end component tree.

| Code | Anchor | What to look for |
|---|---|---|
| `LOADING-1` | `src/components/leaves/Text/index.tsx` | The leaf accepts `isLoading` and rests as itself. There is no second file beside it describing the same line |
| `LOADING-2` | `src/components/leaves/Text/index.tsx` (~133–160) | One element on both paths: the class set and the character swap change, the tag and the arrangement do not |
| `LOADING-3` | `src/components/contracts/index.ts` (~146–147) and `src/components/blocks/dashboard/WeeklyGoals/component.tsx` (~60, ~109) | The union that pairs `repeats` with `restingCount`; and a named constant of resting rows substituted for the real rows |
| `LOADING-4` | `src/components/leaves/Avatar/index.tsx` (~67) | `aria-hidden` present only while the leaf rests, and absent once it carries a name |
| `LOADING-5` | `src/components/blocks/dashboard/ContinueLearning/component.tsx` (~145–147) | The slot holding the way out is omitted from the record entirely while the item is unresolved — not rendered disabled, not rendered resting |
| `LOADING-6` | `src/components/blocks/dashboard/pending-gate.test.tsx` | Each block is asserted resting against its OWN unresolved request, one at a time |
| `LOADING-7` | `src/components/blocks/dashboard/ContinueLearning/component.tsx` (~68–73) | `pending` standing in the union beside `onboarding`, `empty`, `failed` and `ready`, carrying the frame rather than nothing |

Every code is anchored. None reads `chưa neo được`.

## Inputs

| Input | Evidence required |
|---|---|
| region | The component or section that is waiting, and the request it waits on |
| tier | block, composite or leaf — which half of the seam this file is on |
| situation | Whether the answer has not arrived, has arrived empty, or has failed |
| shape | The tree this surface draws once the answer lands |
| repeat count | For a repeating region, how many rows it rests as |
| destination | For each control, whether the thing it leads to exists yet |

## Invariants

- One component, two states. The waiting version and the real one are the same file.
- The block owns the situation; the leaf owns the look of resting. Neither does the other's half.
- A resting element keeps its tag, its arrangement and its measure.
- A resting region keeps the height of a real one, and the repeat count is a declared decision.
- A resting element is hidden from assistive technology for exactly as long as it rests.
- A control is absent, not disabled and not resting, until its destination exists.
- One waiting flag per request. Independent requests do not share one.
- `pending` is a member of the state union, and it carries what the frame needs to draw itself.
- Layout does not move at the moment the data lands.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **A test may build a resting shape by hand.** A twin written inside a `.test.tsx` or `.spec.tsx`
  file is a fixture asserted against, not a second description shipped to a reader. `LOADING-1` does
  not reach it.
- **A shared resting primitive is not a twin.** One generic resting surface that a component rests
  WITH is the opposite of a twin: it describes no particular shape, so it cannot drift from one.
  `LOADING-1` refuses a mirror of a NAMED component, not a primitive.
- **A control whose width is its label cannot rest.** A line of copy has a declared measure and can
  rest without knowing what it will say. A control sized by its own text does not, which is why
  `LOADING-5` removes it rather than emptying it.
- **A cached answer is not a waiting situation.** A region re-fetching behind data it already shows
  stays `ready`; it is not `pending`, and blanking it would be `LOADING-2` inverted — a shape moving
  backwards.
- **A `null` arm is correct.** A ternary whose other side is `null` is `LOADING-5`, not a second
  tree, and `LOADING-2` does not apply to it.

## Output

```text
region: <the component or section that waits>
tier: <block | composite | leaf>
situation: <LOADING-1 | LOADING-2 | LOADING-3 | LOADING-4 | LOADING-5 | LOADING-6 | LOADING-7>
expression: <state: "pending" | isLoading flag | const isLoading = input.state === "pending">
resting shape: <the same tree, named — and what is emptied out of it>
held by: <unrepresentable | enforced: <rule> | documented>
reason: <the business fact that excludes the adjacent code>
```

## Load Policy

Read this file first. Read [`vi.md`](./vi.md) for the business situation behind each code,
[`example.md`](./example.md) for the cases, exceptions and request mapping of every code, and
[`audit.md`](./audit.md) only while reviewing the canon.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is ordinary TSX.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in
[`changelog.md`](./changelog.md). A code is never renumbered and never removed: the numbers are cited
from other law files and from task records, and a silent renumber breaks a citation somebody has
already made.
