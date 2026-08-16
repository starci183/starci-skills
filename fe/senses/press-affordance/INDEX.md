---
id: fe-senses-press-affordance-index
title: INDEX.md
slug: /fe/senses/press-affordance
sidebar_label: press-affordance
sidebar_position: 0
description: Machine-oriented pointer, press, focus, touch, and nested-control affordance rules.
---

# INDEX.md

Version: `1.02`

Vietnamese guide: [vi.md](vi.md) · Human examples: [example.md](example.md)  
Governance: [audit.md](audit.md) · version history: `changelog.md`

## Objective

Make the element that will open or activate answer the reader's gesture once, through every input
mode. The visual answer must name the destination the gesture will actually produce.

## Load Policy

1. Apply this file to any row, card, tile, or region that is pressable as a whole.
2. Read `vi.md` for Vietnamese explanation and interaction boundaries.
3. Read `example.md` for nested-control, keyboard, touch, loading, and UI cases.
4. Do not load `audit.md` or `changelog.md` during ordinary implementation.

## Decision Procedure

Evaluate in order:

1. State the exact element that owns activation and the destination/outcome it opens.
2. Determine whether a visible line inside it names that destination.
3. If a naming line exists, let that line provide the hover answer using the product's ordinary link
   mark; otherwise let the whole surface provide one restrained hover answer.
4. Never apply both answers to the same gesture.
5. On pointer down/press, give immediate feedback even when navigation is slow.
6. When the pointer or focus is on a nested control with another outcome, suppress the outer answer
   and activation.
7. Keep cursor, hover, press, and focus behavior with the element that owns the handler.
8. Provide equivalent keyboard operation, visible focus, accessible naming, and non-hover discovery.
9. On touch, do not depend on hover to reveal that the region is actionable.

## Invariants

- **PRESS-1:** One gesture receives one visual answer.
- **PRESS-2:** A destination-naming line uses the same underline treatment as ordinary links.
- **PRESS-3:** A nested control is not part of the outer press target.
- **PRESS-4:** A press answers immediately, including before slow navigation resolves.
- **PRESS-5:** Affordance belongs to the element that owns activation, not to arrangement metadata.
- **PRESS-6:** Pointer affordance has keyboard-operable, focus-visible, accessibly named parity.
- Touch users receive an actionable cue or recognizable control pattern without requiring hover.
- Disabled or absent activation removes the affordance claim as well as the handler.

## Forbidden

- Dimming the whole surface and underlining its destination label on the same hover.
- Inventing a one-off underline colour, thickness, or offset for one pressable surface.
- Keeping the outer hover/press answer active while a nested link or button owns the gesture.
- Styling cursor/hover/active behavior in an arrangement that cannot know whether a handler exists.
- Providing hover feedback with no immediate pressed feedback.
- Making a region pointer-reactive but unreachable or inoperable from keyboard.
- Hiding the only actionable cue behind hover on a touch interface.
- Leaving press styling on a disabled or handler-less region.

## Narrow Cases

- A conventional visible link may use its ordinary link affordance; it does not need a surrounding
  surface answer.
- A selectable row and a navigable row are different controls. Selection state must not masquerade
  as navigation feedback.
- Dragging and pressing may share a region only when movement threshold and cancellation prevent a
  drag from activating navigation accidentally.
- A nested control may visually sit inside the surface while remaining a separate interaction owner.

## Review Output

For each pressable region, state:

```text
press_owner: <row/card/link/button/control>
outcome: <what opens or changes>
naming_line: none | <visible destination name>
hover_answer: link-mark | surface-answer | none-not-applicable
press_answer: <immediate state>
focus_answer: <visible state>
touch_discovery: <persistent cue or conventional control>
nested_controls: <owners and outcomes>
outer_suppression: pointer | focus | activation | all | not-applicable
disabled_behavior: <handler and affordance both absent>
```

Reject the design if one gesture has two answers, nested ownership is ambiguous, touch discovery
depends on hover, or keyboard operation differs from pointer outcome.

## Version Rule

`changelog.md` owns the module version. Increment an accepted module change by `0.01` and update the
visible version in every module record. `audit.md` is advisory and cannot change this file alone.
