---
id: fe-principles-target-size-index
title: INDEX.md
slug: /fe/principles/target-size
sidebar_label: target-size
sidebar_position: 0
description: Binding rules for the smallest a touch target may be and how far apart two adjacent targets must sit.
template: principles-v2
---

# INDEX.md

Version: `2.00` · Module: `target-size`

## Law

A target is the region that accepts a press. Its size is not a matter of visual weight, and its
distance from the next target is not a matter of rhythm. Both are measured quantities with published
floors, and a finger does not become more accurate because a design looks tidy.

| Source | Floor |
|---|---|
| WCAG 2.5.5 Target Size (Enhanced), level AAA | 44 × 44 CSS px |
| WCAG 2.5.8 Target Size (Minimum), level AA | 24 × 24 CSS px |
| Apple Human Interface Guidelines | 44 × 44 pt |
| Material Design | 48 × 48 dp |

**The floor of this module is 44 × 44 CSS px, measured on the hit area.** Every published floor lands
at or above 44 except the AA minimum, which exists as a legal backstop rather than as a design
target. The two numbers therefore grade a failure rather than offering a choice: a target between 24
and 43 is a defect against this module, and a target below 24 is additionally a conformance failure.
Anyone reporting the second must say so in those words, because the remedy is scheduled differently.

**This is binding, not advisory.** Anything that accepts a press has a target situation, and that
situation has a code below. There is no control small enough or peripheral enough to be exempt: a
16 px dismiss glyph in the corner of an overlay is `TARGET-2` for the same reason a primary submit
button is `TARGET-1`. "It is only a little icon" is not an exemption — it is the single most common
place this rule is skipped, and it is also where the press is hardest.

The drawn shape and the hit area are two different rectangles. The law constrains the second one
only. A design that wants a small drawn shape may always have it; what it may not have is a small
hit area.

## Situation Codes

Every situation this module governs carries a code, `TARGET-<index>`. The code names the SITUATION;
the className column names what that situation emits. They are not the same thing, and three of them
emit nothing.

| Code | Situation | className |
|---|---|---|
| `TARGET-0` | Nothing here accepts a press | *no size class* |
| `TARGET-1` | An ordinary control; the drawn shape carries the floor itself | `min-h-11 min-w-11` |
| `TARGET-2` | The drawn shape must stay small; the hit area is grown around it | `relative after:absolute after:-inset-2.5 after:content-['']` |
| `TARGET-3` | Two adjacent targets; the seam between their hit areas | `gap-2` |
| `TARGET-4` | A target inside a run of non-target text, sized by the line | *no size class* |
| `TARGET-5` | Position is the information and a conforming equivalent carries the function | *no size class here* |

**Two axes, and a code from one never satisfies the other.** `TARGET-0`, `TARGET-1`, `TARGET-2`,
`TARGET-4` and `TARGET-5` classify ONE target. `TARGET-3` classifies the SEAM between two adjacent
targets. A toolbar of three icon buttons therefore carries three target codes and two seam codes.
Sizing each button correctly does not answer the seam question, and spacing them generously does not
answer the size question. The axes are kept in one module because the standards themselves trade one
against the other — 2.5.8 accepts an undersized target when its offset from every neighbour is large
enough — so a rule that judged them apart would be citing half of its own source.

`TARGET-0`, `TARGET-4` and `TARGET-5` ARE SITUATIONS, NOT SIZES. They exist because "this one is
exempt" is a claim that must be nameable, quotable and refutable. An exemption with no code is an
exemption nobody can be shown to have taken wrongly, and every audit of undersized controls ends in
the same argument about which ones were supposed to count.

The index skips no numbers and means nothing by their order beyond distance from the plain case:
`0` has no target, `1` is the target that carries its own floor, `2` is the target that borrows one,
`3` leaves the single target for the seam, and `4` and `5` are the two closed ways out.

## Inputs

| Input | Evidence required |
|---|---|
| element | Whether it accepts pointer activation, `Enter`/`Space`, or a gesture |
| drawn size | The rendered box in CSS px, both axes, at the smallest supported viewport |
| hit area | The activatable region including any grown area, in CSS px |
| flow | Whether the target sits inside a sentence of non-target text |
| neighbours | Distance from this hit area to the nearest adjacent hit area |
| density | Whether the target's position on screen is itself the information |
| equivalent | Whether another control on the same view performs the same function at full size |

## Invariants

- The floor is measured on the hit area, never on the drawn shape, the icon glyph or the label text.
- 44 × 44 CSS px is the floor. 24 × 24 is the conformance backstop, and naming it in a review means
  naming a legal failure, not a smaller target.
- A grown hit area never moves, resizes or restyles the drawn shape.
- Grown hit areas of two neighbours never overlap.
- Every target on screen resolves to exactly one target code, and every adjacency between two targets
  resolves to exactly one seam code.
- A code maps to exactly one className, and no className serves two codes.
- Disabled, loading and error states keep the target code of the state they replace.
- Hover affordances, cursor changes and elevation are not evidence that something is a target;
  accepting activation is.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **User agent control.** A control the author has not sized — a bare checkbox, radio, file input or
  native select rendered at the browser's own metrics — is `TARGET-1` with the floor satisfied by the
  user agent, so no class is emitted. Applying any width, height, padding, `appearance` or transform
  to it revokes the exception immediately and the class becomes owed.
- **Joined surface.** `TARGET-3` emits nothing when both neighbours measure at least 44 CSS px along
  the axis of adjacency. A segmented control, a numeric stepper and a list of tiled full-width rows
  are correct with their hit areas touching, because every centre is already half a target away from
  the seam.
- **Inline target suspends the seam.** A `TARGET-4` target carries no seam obligation to the other
  targets in the same run of text. Line wrapping decides where two inline links land, and a rule that
  the author cannot satisfy is a rule that gets ignored everywhere else too.
- **Essential density needs a partner, not a waiver.** `TARGET-5` applies only when a conforming
  equivalent exists on the same view. Essential density with no equivalent is not this code; it is an
  unrepaired failure of `TARGET-1`.
- **State parity.** A skeleton occupies the target code of the control it stands in for. A control
  that shrinks while loading has changed its target size for the state in which the user is most
  likely to press it again.
- **Two codes both match.** Prefer the code that emits a class. An exemption is only taken when its
  own condition is proved, never as the residue of an unproved one.

## Output

```text
element: <what accepts the press>
drawn: <rendered box in CSS px>
hit: <activatable region in CSS px>
situation: <TARGET-0 | TARGET-1 | TARGET-2 | TARGET-3 | TARGET-4 | TARGET-5>
className: <no class | min-h-11 min-w-11 | relative after:absolute after:-inset-2.5 after:content-[''] | gap-2>
reason: <measured or behavioural fact that excludes the adjacent code>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is an ordinary `className` on ordinary markup.

It owns the size of a target and the distance between two targets. It does not own the seam between
things that are not targets, the padding inside a control, the focus indicator, or the order in which
targets receive focus.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
