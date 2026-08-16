---
id: fe-principles-typography-index
title: INDEX.md
slug: /gates/principles/typography
sidebar_label: typography
sidebar_position: 0
description: Binding rules for choosing a typography className from outline depth and content ownership.
template: principles-v2
---

# INDEX.md

Version: `2.00` · Module: `typography`

## Law

A line of text states what it OWNS. Choose its size, weight and tone from that ownership, never from
how prominent it should look.

Two facts decide, and only two: **outline depth** — whether the line is a rung of the document
outline — and **content ownership** — whether the line names an object, states a fact, qualifies
another line, partitions a stream, or belongs to a control that already owns its own text.

Visual preference, numeric shape, label length, hover, available space, breakpoint and screenshot
geometry select nothing.

**This is binding, not advisory.** Every rendered line of text falls under exactly one code below.
There is no line too small to have one: a twelve-character caption under a metric is `TYPOGRAPHY-9`
for the same reason a route name at the top of a page is `TYPOGRAPHY-1`. "It is only one word" is not
an exemption — it is the most common place the rule gets skipped, because a single word is exactly
where a writer reaches for whatever size looks right.

## Situation Codes

Every situation this module governs carries a code, `TYPOGRAPHY-<index>`. The code names the
SITUATION; the element and className columns name what that situation emits. They are not the same
thing, and one of them emits nothing.

| Code | Situation | Element | className |
|---|---|---|---|
| `TYPOGRAPHY-1` | Root name of the page or route | `h1` | `text-xl font-semibold tracking-tight` |
| `TYPOGRAPHY-2` | First outline depth under the page | `h2` | `text-base font-semibold` |
| `TYPOGRAPHY-3` | Local subsection inside a section | `h3` | `text-sm font-medium` |
| `TYPOGRAPHY-4` | Final admitted outline depth | `h4` | `text-xs font-medium text-muted-foreground` |
| `TYPOGRAPHY-5` | One short title for the single dominant object of a region | `div` | `text-base font-medium text-foreground` |
| `TYPOGRAPHY-6` | Title of a repeated, compact, long or localizable peer object | `div` | `text-sm font-medium text-foreground` |
| `TYPOGRAPHY-7` | Ordinary UI copy: a description, a metadata line, a value | `p` | `text-sm leading-5 font-normal text-foreground` |
| `TYPOGRAPHY-8` | Prose whose job is sustained reading | `p` | `text-base leading-6 font-normal text-foreground` |
| `TYPOGRAPHY-9` | Copy that only qualifies a primary line or surface | `p` | `text-xs leading-4 font-normal text-muted-foreground` |
| `TYPOGRAPHY-10` | A marker that partitions a result stream without creating a section | `div` | `text-sm leading-5 font-normal text-muted-foreground` |
| `TYPOGRAPHY-11` | Text a control already owns | *the control's own element* | *no typography class* |
| `TYPOGRAPHY-12` | No outline depth and no declared owner | `p` | `text-base font-normal text-foreground` |

`TYPOGRAPHY-11` IS A SITUATION, NOT A RECIPE. A button label, a badge, a link, a field placeholder
and a status chip carry typography that the control itself settled. Re-declaring a size on that text
from the outside claims an ownership the caller does not have, and the claim is invisible until the
control changes and one call site stops matching every other. The code exists because "the control
already decided" is a case a reader must be able to recognise, cite and be corrected against — a
situation with no name is a situation nobody can be shown to have got wrong.

`TYPOGRAPHY-12` IS A FLOOR, NOT AN ESCAPE. It is the readable answer when a request genuinely
declares no owner, so that a public table never returns a refusal. It is not permission to skip the
ownership question when the answer is available in the request.

The outline stops at four. There is no fifth heading depth, and adding one is a rule change rather
than a shortcut: a content structure that needs depth five is a content structure that has to
flatten. A closed ladder forces an ownership decision; an open one invites inventing a rung, which is
taste re-entering through arithmetic.

## Inputs

| Input | Evidence required |
|---|---|
| outline | `none · 1 · 2 · 3 · 4` — whether the line is a rung of the document outline, and which |
| owner | `page · section · dominant-object · repeated-peer · ui-copy · reading-prose · control · partition` |
| relationship | `independent · qualifies-primary · partitions-results` |
| repetition | Whether the line appears once in the region or repeats as one of many peers |
| length risk | Whether the string can grow long, wrap, or grow under localization |
| state | `ready · loading · empty · error` — recorded to prove parity, never to change the answer |

`outline` and `owner` are required. `relationship`, `repetition` and length risk are required whenever
they are what separates two adjacent codes.

## Invariants

- One rule owns semantic heading depth and visible rank together. An `h2` that is styled as body, or
  a `div` styled as a heading, is a rule violation in both directions.
- Four heading depths are the whole outline. A fifth means the content must flatten.
- One bounded region has exactly one typographic lead.
- `text-xs` always means muted supporting copy. There is no foreground `text-xs`, and no muted
  `text-xs` that is not support — except the `h4` of `TYPOGRAPHY-4`, which is `font-medium` and is in
  the outline.
- Numbers, hover, label length, available space and breakpoints never promote rank.
- Loading, empty, error, localization, responsive and theme preserve the settled code.
- Rank is never manufactured with a border, background, badge or box. Those state a surface, not a
  rank.
- No unlisted size, weight or tone recipe is assembled. The vocabulary is closed.
- A situation code maps to exactly one recipe, and no recipe serves two codes.
- Every rendered line resolves to exactly one code. No text is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **Control-owned text.** `TYPOGRAPHY-11` wins over every other code. If the string lives inside a
  button, badge, link, field or status control, the control's recipe stands and no free-text class is
  emitted, even when the string reads exactly like `TYPOGRAPHY-7` copy.
- **Page name that is also an object name.** On a detail route, the object's own name IS the page
  name and takes `TYPOGRAPHY-1`. The same string listed among siblings on an index route is
  `TYPOGRAPHY-6`. The route decides, not the string.
- **Fifth heading depth.** Do not emit anything. Ask the author to flatten the outline. This is the
  one request the module answers with a question rather than a class.
- **Numeric value with no declared owner.** A number does not promote itself. Emit `TYPOGRAPHY-12`
  and ask which line leads the region only when promotion is actually being requested.
- **State parity.** Skeleton, empty and error renderings of the same content keep the same code. A
  skeleton that changes rank is lying about ownership while it waits.
- **Long copy without a reachability policy.** Truncation versus wrapping is not a typography
  decision. Keep the settled code and ask whether the full value must remain reachable.
- **Two adjacent codes both match.** Choose the code that claims LESS ownership — the peer over the
  dominant, the support over the section, the UI copy over the reading prose. Ask one discriminating
  question only when the requester explicitly requires the larger claim.

## Output

```text
line: <the text being classified>
outline: <none | 1 | 2 | 3 | 4>
owner: <page | section | dominant-object | repeated-peer | ui-copy | reading-prose | control | partition>
relationship: <independent | qualifies-primary | partitions-results>
situation: <TYPOGRAPHY-1 … TYPOGRAPHY-12>
element: <h1 | h2 | h3 | h4 | div | p | none — the control's own>
className: <exact closed recipe, or none>
reason: <business fact that excludes the adjacent code>
```

## Load Policy

Read this file first for routine classification. Read `vi.md` for the business situation behind each
code, `example.md` for the cases, exceptions, request mapping and boundary questions of every code,
and `audit.md` only while reviewing the canon. `changelog.md` is history, not an implementation
input.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is ordinary markup with an ordinary `className`. Where
a recipe uses `text-foreground` or `text-muted-foreground`, those are the two content tones any theme
must define; a front end that spells them as literal palette steps substitutes its own two names and
the law is unchanged.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
