---
id: fe-principles-optical-index
title: INDEX.md
slug: /fe/principles/optical
sidebar_label: optical
sidebar_position: 0
description: Binding rules for when a measured value is knowingly overridden because the eye reads it wrong.
template: principles-v2
---

# INDEX.md

Version: `2.00` · Module: `optical`

## Law

A layout computes numbers: a padding, a size, a radius, an alignment. Those numbers are almost always
what should ship. This module governs the narrow set of cases where the number is arithmetically
correct and still wrong, because the thing being measured is a **box** and the thing being read is
the **ink inside that box**.

This is the one module in which a measured value is knowingly overridden. That privilege is paid for
in evidence: **an override is legal only when it cites a code below and names the measurable symptom
that code owns.** "It looks better" is not a symptom. "It looks off" is not a symptom. A symptom is a
difference someone else can go and measure — light on the left versus light on the right, cap band
versus box centre, padding on the flat versus padding at the diagonal.

**This is binding, not advisory.** Every proposed nudge resolves to exactly one code, and the code
that most proposals resolve to is `OPTICAL-0` — the measurement stands. There is no nudge too small
to need a code: a `translate-x-px` on an icon is `OPTICAL-1` for the same reason a whole nested
radius chain is `OPTICAL-5`. "It is only one pixel" is not an exemption — it is the most common place
this rule gets skipped, and one unnamed pixel is what licenses the next hundred.

## Situation Codes

Every situation this module governs carries a code, `OPTICAL-<index>`. The code names the SITUATION;
the className column names the override that situation is allowed to emit. They are not the same
thing, and one of them emits nothing.

| Code | Situation | className |
|---|---|---|
| `OPTICAL-0` | The measurement is correct and no named symptom applies | *no override class* |
| `OPTICAL-1` | The computed centre is not the perceived centre | `translate-x-px`, `-translate-y-px`, asymmetric `pl-*`/`pr-*` |
| `OPTICAL-2` | Equal boxes that do not read as equal mass | a different `size-*` on the lighter mark |
| `OPTICAL-3` | A line of type whose box is not its ink | `leading-none` + asymmetric `pt-*`/`pb-*`, `items-baseline`, `mt-*` |
| `OPTICAL-4` | Type spaced for a size it is no longer set at | `tracking-tight`, `tracking-tighter`, `tracking-wide` |
| `OPTICAL-5` | Nested corners measured from an outer radius and the padding between them | inner `rounded-*` = outer − padding |
| `OPTICAL-6` | Content that must hold an edge shared with other lines or rows | `-ml-*`, `-indent-*`, `tabular-nums`, `list-outside` |

`OPTICAL-0` IS A SITUATION, NOT AN ABSENCE. It is the verdict that the arithmetic won, and it is the
default verdict. It exists as a named code because a refusal that has no name cannot be cited, cannot
be reviewed, and cannot be shown to have been the right call. Most review conversations in this
module end at `OPTICAL-0`; a module in which every case found a correction would be a module that had
stopped discriminating.

The index is **continuous** — `0` through `6`, no holes. That is deliberate and it is the opposite of
a spacing scale. A scale with holes forces a relationship decision between rungs; this set has no
rungs to fall between, because the codes are not degrees of one quantity. They are six different
things the eye is measuring, plus the refusal. There is no averaging two codes, so there is nothing
for a hole to prevent.

The order is not arbitrary either: `1`–`2` correct a single mark against its own box (position, then
size), `3`–`4` correct a run of type against its own metrics (vertical, then horizontal), and `5`–`6`
correct a thing against something outside it (its container's corner, then an edge it shares with
neighbours). Reach grows with the index.

## Inputs

| Input | Evidence required |
|---|---|
| measured | The value the layout already computes: padding, size, radius, alignment |
| symptom | The difference the eye reports, stated as px, %, or a ratio someone else can re-measure |
| metric | The type or geometry fact that explains the symptom: ink box vs advance box, cap height, arc centre, drawn area |
| override | The single property the correction changes, and its magnitude |
| states | Whether the symptom survives hover, dark, RTL, wrap and every content length the element renders |

## Invariants

- An override cites exactly one code and one measurable symptom.
- An override changes one property, on the one element that carries the symptom.
- The unit of judgement is **one symptom on one property**, not one element. An element with two
  symptoms takes two codes on two properties; one code never does two jobs.
- The magnitude of an override is the smallest step that removes the measured difference. An override
  larger than its symptom is a layout change wearing an optical excuse, and belongs to whichever rule
  owns that measurement.
- An optical override never moves a seam between siblings. The seam value belongs to the spacing rule;
  this module corrects the ink, never the distance between two things.
- A direction-dependent horizontal override is mirrored for RTL, or it is wrong in RTL.
- An override does not change with viewport, theme or loading state unless the mark itself changes.
  Skeleton and loaded content carry the same code.
- Every proposed nudge resolves to exactly one code. `OPTICAL-0` is a resolution, not a gap in the set.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **Already corrected upstream.** Some icon sets ship optical centring inside the viewBox, and some
  faces ship a cap-centred em box. Measure before nudging: if the light is already equal, the case is
  `OPTICAL-0` and a second correction doubles the error.
- **Circles.** `OPTICAL-5`'s subtraction degenerates for a full round: a circle inset by padding is
  still a circle. `rounded-full` inside `rounded-full` is correct, not lazy.
- **Padding at or beyond the outer radius.** When the padding equals or exceeds the outer radius there
  is no nested corner left to be concentric with, and the inner radius becomes a free choice governed
  by nothing here. That case is `OPTICAL-0`.
- **Uppercase with diacritics.** Vietnamese uppercase carries marks above cap height. An `OPTICAL-3`
  override measured on a mark-free string will clip or mis-centre the moment real content arrives;
  the symptom must be measured on the tallest string the element can render.
- **Numerals held in a column.** `OPTICAL-4` never applies to figures whose job is to line up;
  `OPTICAL-6` owns them, and letter-spacing applied on top of a tabular column re-breaks the edge
  that `OPTICAL-6` just repaired.
- **Two codes both appear to match.** They are not competing. Name the property being corrected — the
  code that owns that property wins. If two properties are genuinely wrong, that is two codes and two
  overrides, not one bigger nudge.

## Output

```text
measured: <the value the layout computed>
symptom: <the difference, in px, % or ratio>
metric: <the type or geometry fact that explains it>
situation: <OPTICAL-0 | OPTICAL-1 | OPTICAL-2 | OPTICAL-3 | OPTICAL-4 | OPTICAL-5 | OPTICAL-6>
override: <single className, or none>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation and the measurement behind each code,
`example.md` for the cases, exceptions and request mapping of every code, and `audit.md` only while
reviewing the canon.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is an ordinary `className` on ordinary markup.

It governs the override, never the original measurement. Which seam, which type size, which colour
and which layout were correct in the first place belong to their own rules; this module is only ever
asked whether a value already chosen may be knowingly departed from, and by how much.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
