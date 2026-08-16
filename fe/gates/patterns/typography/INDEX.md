---
id: fe-patterns-typography-index
title: INDEX.md
slug: /gates/patterns/typography
sidebar_label: typography
sidebar_position: 0
description: Binding rules for setting size, weight and tone from rank rather than from how loud a line should look.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `typography`

## Law

Type carries rank. How large a line is, how heavy, and what tone it takes are not independent
choices — together they say which of the things on screen matters most, and a reader decides where
to look before reading a word.

So the scale is small, and the steps are paired rather than free. A heading is not a size and a
weight chosen together; it is a LEVEL, and the level decides both, including the tag a screen reader
builds the outline from.

Headings are four levels:

| Level | Size | Weight |
|---|---|---|
| 1 | 20px | semibold |
| 2 | 16px | semibold |
| 3 | 14px | medium |
| 4 | 12px | medium |

Body text uses 14px and 16px. A third, restricted 12px step exists only for supporting copy beneath
or beside a primary line or joined surface; it is not another general-purpose body size, and because
it already means "supporting", every 12px line is muted. Size and tone are one rank there: no
default-tone or foreground-coloured 12px exception exists. The scale has three weights and two
tones, and callers do not invent further steps from nearby pixels.

Notice what the heading table does NOT do: it never pairs the largest size with the heaviest weight.
Rank comes from the STEP, not from shouting one line as loudly as the type system allows — which is
also why the ceiling is low enough that raising a line is rarely the move available.

**This is binding, not advisory.** Every rendered line of text falls under exactly one code below.
There is no line too small to have one: a three-word category above a card title is `TYPESET-5` for
the same reason a page name is `TYPESET-1`. "It is only a label" is not an exemption — it is the most
common place the rule gets skipped, because a single short line is exactly where a writer reaches for
whatever size looks right.

## Situation Codes

Every situation this module governs carries a code, `TYPESET-<n>`. The code names the SITUATION; the
requirement and prohibition columns name what that situation decides.

| Code | Requires | Forbids |
|---|---|---|
| `TYPESET-1` | A heading is rendered by the heading component from a `level`, which decides tag and set together | A heading tag written by hand; a size and a weight assembled into something that looks like a heading |
| `TYPESET-2` | Four levels; a fifth means the section nested further than a reader can hold, so flatten instead | A fifth heading level, or a smaller step invented to stand in for one |
| `TYPESET-3` | Rank expressed through size, weight and tone | A border, background or chip drawn to make a line important |
| `TYPESET-4` | Competing attention resolved by quietening the neighbours | Raising the contested line, which raises the floor for the next author too |
| `TYPESET-5` | A secondary line — eyebrow, count, category, meta — set below the rank of the title it belongs to | A secondary line the same size as, larger than, or heavier than its title; tone alone as the whole difference |
| `TYPESET-6` | Weight chosen on body text only; a heading's weight comes from its level | A weight prop or weight class pushed onto a heading |
| `TYPESET-7` | The 12px step always paired with muted tone, for supporting copy only | 12px in foreground tone; 12px used as compact primary copy |
| `TYPESET-8` | A temporal result marker rendered as a 14px muted subtitle outside the surface it partitions | A heading level, or the joined surface's own label treatment, given to a time bucket |
| `TYPESET-9` | Body title rank read from the content owner: dominant object title at 16px medium, compact or repeated titles at 14px medium, ordinary values at 14px normal | Rank chosen because a card hovers, a value is numeric, or space was available |

The scale stops at nine and stays at nine. A code names a situation somebody can be shown to have
got wrong; renumbering one silently breaks a citation already made elsewhere.

## Tầng giữ

Which tier actually holds each code — a closed type, a lint rule, or only a reader.

| Code | Tier | What holds it |
|---|---|---|
| `TYPESET-1` | `enforced` | `no-heading-tag-outside-heading-component` in `.claude/sources/fe/typography.mjs` reports any `h1`–`h6` in a source file that is not the heading component itself |
| `TYPESET-2` | `unrepresentable` | The closed level union `1 \| 2 \| 3 \| 4` on the heading data type; the same lint rule's `tooDeep` branch is the backstop for a hand-written `<h5>` |
| `TYPESET-3` | `documented` | Nothing mechanical. The text leaf draws no border and no background, so the box is always somebody else's element |
| `TYPESET-4` | `documented` | Nothing mechanical. The scale's ceiling makes climbing expensive, but no tool sees which direction an author moved |
| `TYPESET-5` | `documented` | Nothing mechanical. Both lines are legal in isolation; only their pairing is wrong |
| `TYPESET-6` | `unrepresentable` | The heading data type is closed over `content` and `level`; there is no weight field to pass |
| `TYPESET-7` | `unrepresentable` | The text data type is a discriminated union: `{ size: "xs"; tone?: "muted" }` makes a foreground 12px line impossible to write, and the component re-derives the tone at runtime |
| `TYPESET-8` | `documented` | Nothing mechanical. Every ingredient is a legal call; only the meaning of the string makes it a partition |
| `TYPESET-9` | `documented` | Nothing mechanical. Both sizes are legal; the content owner is not a fact any type or rule can read |

One rule, three closed types, five codes held by a reader alone. That gap is the honest state of this
law, not a defect in the table: what a type can refuse is a VALUE, what a lint rule can see is a
SHAPE, and most of this law is about a relationship between two lines that are each individually
fine. Every `documented` row is listed again in [`audit.md`](./audit.md) with what a rule would have
to see.

## Anchor

A law that cannot be pointed at in real code is a proposal. Paths are repository-relative.

| Code | Path | What to look for |
|---|---|---|
| `TYPESET-1` | `src/components/leaves/Heading/index.tsx` | `level` is passed to the outline tag AND used to select the class set — one prop, two facts, in one expression |
| `TYPESET-2` | `src/components/leaves/Heading/index.tsx` · `.claude/sources/fe/typography.mjs` | The level union stops at `4`; the rule's `DEEPEST_LEVEL` constant is the same `4` |
| `TYPESET-3` | `src/components/leaves/Text/index.tsx` | The class list has no `border-*` and no `bg-*` entry: the leaf that draws copy cannot draw a box around it |
| `TYPESET-4` | `src/components/leaves/Heading/index.tsx` | Level 1 is `text-xl font-semibold`, not `text-3xl font-bold` — the ceiling is low, so "louder" mostly does not exist |
| `TYPESET-5` | `src/components/blocks/courses/CourseCatalogCard/component.tsx` | The card's title is a heading at level 2 while its facts stay 14px muted — the secondary lines never reach the title's rank |
| `TYPESET-6` | `src/components/leaves/Heading/index.tsx` | The heading data type has exactly two fields; no weight is accepted, and the weight lives in the level class set |
| `TYPESET-7` | `src/components/leaves/Text/index.tsx` | The union branch `{ size: "xs"; tone?: "muted" }`, and the tone re-derivation that ignores a caller's tone when the size is `xs` |
| `TYPESET-8` | `src/components/blocks/dashboard/ActivityFeed/component.tsx` | The day label renders as 14px muted OUTSIDE the list surface, and the surface below is told to hide its own label |
| `TYPESET-9` | `src/components/pages/CourseFlashcardSessionPage/component.tsx` · `src/components/blocks/` | One dominant prompt at 16px medium against roughly thirty compact titles at 14px medium — the ratio is the evidence |

Every code is anchored; none reads `chưa neo được`. Two anchors prove less than they look: the
`TYPESET-4` anchor proves the ceiling, not the practice, and the `TYPESET-9` anchor proves a
distribution, not a per-call-site decision. Both are recorded in [`audit.md`](./audit.md).

## Inputs

| Input | Evidence required |
|---|---|
| outline rank | Whether this line is a rung of the document outline, and how deep the section already nests |
| content owner | The object the line names: a page, a section, one important object, a repeated row, a value, a qualifier |
| neighbours | What else on the same surface is competing, and at what rank it currently sits |
| surface ownership | Whether a joined surface already draws its own label for this text |
| partition role | Whether the line names a time bucket over results rather than a section of the page |

## Invariants

- A heading's tag and its set come from one prop.
- The scale is four heading levels, two body sizes, one restricted supporting size.
- Size, weight and tone are the only carriers of rank; boxes are not.
- The 12px step and muted tone are one decision, never two.
- A secondary line is strictly below its title in size or weight, not merely in tone.
- A heading takes no weight of its own.
- Rank follows the content owner, never interaction, data type or available space.
- Every rendered line resolves to exactly one code. No line is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Temporal partitions keep 14px.** Under `TYPESET-8`, a time bucket stays at body size with muted
  tone rather than dropping to the supporting step, because it names a scan partition rather than
  explaining the line above it. This is the one muted-subtitle case that is NOT `TYPESET-7`.
- **Weight as the whole difference between peers.** Under `TYPESET-5` and `TYPESET-9`, two compact
  peer lines may share 14px when one takes medium and the other stays normal or muted. Same size,
  different weight, is a rank; same size, same weight, different tone, is not.
- **State parity.** A resting or loading line keeps the code and the metrics of the line it will
  become. A skeleton that changes size is a promise about rank that the loaded state breaks.
- **The heading component itself.** Under `TYPESET-1`, exactly one file writes heading tags: the one
  that owns the level. The lint rule exempts that path and test files that assert against raw markup.
- **A fifth level requested.** Under `TYPESET-2` there is no styling answer. Flatten the section, then
  set the title with a level the scale has.

## Output

```text
line: <the text and where it sits>
owner: <page | section | object | repeated row | value | qualifier | partition>
situation: <TYPESET-1 … TYPESET-9>
element: <heading level N | body line>
set: <size + weight + tone>
reason: <the ownership fact that excludes the adjacent code>
```

## Load Policy

Read this file first. Read [`vi.md`](./vi.md) for the business situation behind each code,
[`example.md`](./example.md) for the cases, exceptions and request mapping, and
[`audit.md`](./audit.md) only while reviewing the canon.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Examples are ordinary TSX: plain markup with plain classes, plus a
heading component wherever the component boundary IS the law.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in
[`changelog.md`](./changelog.md).
