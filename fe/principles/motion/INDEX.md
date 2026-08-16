---
id: fe-principles-motion-index
title: INDEX.md
slug: /fe/principles/motion
sidebar_label: motion
sidebar_position: 0
description: Binding rules for choosing a motion className from what actually changed between two frames.
template: principles-v2
---

# INDEX.md

Version: `2.00` · Module: `motion`

## Law

Movement is a claim that two frames show the same thing. Choose it from what actually changed
between them — presence, appearance, geometry, or nothing — never from how the movement feels.

The element that changes owns its own movement. One element expresses one change; two changes at
once are two elements or two codes, never one blended duration.

**This is binding, not advisory.** Anything that can look different from one frame to the next has a
motion situation, and that situation has a code below. There is no change too small to have one: a
button darkening under the cursor is `MOTION-2` for the same reason a drawer sliding in is
`MOTION-1`. "It is only a hover" is not an exemption — it is the most common place the rule gets
skipped, and the place where `transition-all` gets written.

Motion that carries no meaning is decoration, and decoration that moves is noise. The code for it is
`MOTION-0`, and `MOTION-0` emits nothing.

## Situation Codes

Every situation this module governs carries a code, `MOTION-<index>`. The code names the SITUATION;
the className column names the **timing pair** that situation emits. They are not the same thing, and
one of them emits nothing.

| Code | Situation | className |
|---|---|---|
| `MOTION-0` | Nothing changed that movement could explain | *no transition class* |
| `MOTION-1` | Something arrives in or leaves the tree | `transition-opacity duration-200 ease-out` · exit `duration-100 ease-in` |
| `MOTION-2` | A thing that stays repaints, or turns in place | `transition-colors duration-150 ease-out` |
| `MOTION-3` | A thing that stays takes a different place or a different amount of room | `transition-transform duration-300 ease-in-out` |
| `MOTION-4` | An unbounded wait with no endpoint to move toward | `animate-spin` · `animate-pulse` (infinite, linear) |
| `MOTION-5` | The user has asked the system for less motion | `motion-reduce:*` · `motion-safe:*` |

`MOTION-0` IS A SITUATION, NOT A SPEED. There is no `duration-0`, and writing `transition-none` to
mean "I decided nothing moves here" is only correct when a parent or a variant would otherwise have
imposed movement. The absence of movement is a different fact from a movement of length zero. The
code exists because "does not move" is a case a reader must be able to recognise, cite and be
corrected against — a situation with no name is a situation nobody can be shown to have got wrong.

`MOTION-5` IS A SITUATION, NOT A MODIFIER. The unit this module classifies is one rendered movement
under one motion preference. Under `prefers-reduced-motion: no-preference` an element resolves to
exactly one of `MOTION-0`…`MOTION-4`. Under `prefers-reduced-motion: reduce` the same element
resolves to `MOTION-5`, because in that situation the preference decides and the author does not.
The two never apply at the same instant, so the set stays exclusive, and every emitted movement is
obliged to state both halves in the same class string.

The property named in the className column is the property that changed; it is **not** what tells the
codes apart. What tells them apart is the timing pair, and a timing pair belongs to exactly one code:

| Timing pair | Code |
|---|---|
| `duration-100 ease-in` | `MOTION-1`, exit half only |
| `duration-150 ease-out` | `MOTION-2` |
| `duration-200 ease-out` | `MOTION-1`, enter half only |
| `duration-300 ease-in-out` | `MOTION-3` |
| infinite, `linear`, no end state | `MOTION-4` |

The ladder is `100 · 150 · 200 · 300` and it skips `250`, `500`, `700` and `1000` deliberately. A
closed ladder with holes in it forces a meaning decision; a continuous one invites splitting the
difference, which is taste re-entering through arithmetic. Nothing in an interface is allowed past
`300` except a `MOTION-4` loop, because interface time is bounded by attention, not by pixels: a
full-screen surface still travels in `300`, and a longer duration does not read as elegance, it
reads as lag.

`MOTION-1` is the only code that owns two timing pairs, and that asymmetry is the code's content.
Arriving matter has to be found, so it decelerates into place and is given `200`. Leaving matter has
already been dismissed, so it accelerates away and is given `100`. Making them equal is the most
common way an interface starts to feel slow while every individual number looks reasonable.

## Inputs

| Input | Evidence required |
|---|---|
| element | The single node whose frames differ |
| presence | Whether the node exists before AND after the change |
| geometry | Whether its box, its place in the flow, or a sibling's place changed |
| endpoint | Whether the final value is known at the instant the change starts |
| initiator | Whether the user asked for the change, or the system delivered it |
| preference | The resolved value of `prefers-reduced-motion` |

## Invariants

- The element that changes owns its transition. A parent does not animate on a child's behalf.
- `transition-*` belongs to `MOTION-1`, `MOTION-2` and `MOTION-3` only.
- An infinite `animate-*` belongs to `MOTION-4` only.
- `motion-reduce:` and `motion-safe:` belong to `MOTION-5` only, and every emitted motion class
  carries its `MOTION-5` answer in the same class string.
- `transition-all` is forbidden. It animates properties nobody decided, including ones added later.
- Duration comes from the code, never from the distance travelled or the size of the element.
- Easing comes from which ends are on screen: arriving decelerates, leaving accelerates, staying at
  both ends is symmetric, never ending is linear.
- Motion never carries information alone. An animation is not a state, and a state that is only
  animated is a state a stopped renderer cannot report.
- Nothing flashes more than three times per second, at any code, under any preference.
- A situation code maps to exactly one timing pair, and no timing pair serves two codes.
- Every rendered change resolves to exactly one code. No change is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **Focus indication.** The indicator itself is `MOTION-0`. It appears on the frame the focus moves;
  a keyboard user outruns any duration, and a delayed ring is a lost ring. Only the surrounding
  colour may be `MOTION-2`.
- **Text that is read, not tracked.** Replacing the words in a slot is `MOTION-0`. A cross-fade
  holds two illegible strings on screen and buys nothing, because nobody was following the letters.
- **Change the user did not ask for.** A reorder, insertion or resize delivered by the system while
  the user is reading or pointing is `MOTION-0`, not `MOTION-3`. Moving a target under a cursor is a
  worse failure than a jump.
- **Wait shorter than perception.** An indeterminate loop shown for less time than it takes to
  notice is `MOTION-0`. A loop that appears and vanishes reads as a fault, not as work.
- **Hover on a device with no hover.** A `MOTION-2` pointer state is stated inside a hover query, so
  that a touch device does not strand it in the hovered frame after a tap.
- **`MOTION-5` substitutes, it does not delete.** A loop removed under reduced motion leaves a
  static, announced indicator behind. Removing the movement and the fact together is a regression,
  not an accommodation.
- **Two adjacent codes both match.** Choose the quieter one. Ask one discriminator question only when
  the requester explicitly requires the larger movement.

## Output

```text
element: <the node whose frames differ>
change: <presence | paint | geometry | none | unbounded wait>
situation: <MOTION-0 | MOTION-1 | MOTION-2 | MOTION-3 | MOTION-4 | MOTION-5>
className: <no class | timing pair | animate class | motion-reduce answer>
reduced: <what MOTION-5 emits for this element>
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
