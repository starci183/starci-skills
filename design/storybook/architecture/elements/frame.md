# frame

Direction, seam, alignment, and its own chrome between children.

> **Read the worked examples first:** [`../examples/frame.md`](../examples/frame.md) — real components
> at this tier, each with what it renders and why it sits here. The rules below are easier to judge
> once the examples are in front of you.

## At a glance

| | |
|---|---|
| group | vocabulary — a word any product can use |
| owns | direction, seam, alignment, and its own chrome between children |
| never | asks what its children are |
| may import | atoms, and only to place its own chrome |
| takes `className` | yes |
| composes classes (`cn`) | yes |
| tiers below | atom |

## Rules

**FRAME-1 · It owns direction, seam, alignment, and its own chrome between children.**

Anything outside that scope belongs to another tier, whatever the folder says.

**FRAME-2 · It never asks what its children are.**

This is the line that decides the tier, not a preference about style.

**FRAME-3 · It may import: atoms, and only to place its own chrome.**

Imports run downward only. A lower tier that reaches up stops being usable anywhere the upper tier is absent.

**FRAME-4 · It takes `className`: yes.**

This tier is vocabulary — the caller adjusts spacing and placement, and that is the whole point of it being reusable.

**FRAME-5 · It composes classes (`cn`): yes.**

Deciding appearance is exactly this tier's work.

**FRAME-6 · It belongs here when: every prop is about arrangement, none about content.**

Use this to confirm a placement, not to argue one.

**FRAME-7 · It is in the wrong tier when: a prop makes the caller describe its own content.**

This is the detection signal — the thing to look for in review.

**FRAME-8 · A frame may import an atom, and only for chrome it owns.**

A divider it places between children, decided by its own boolean. The test: is the imported thing something the caller handed in? If yes, the frame is doing a composite's job.

**FRAME-9 · Three content contracts, chosen by what the frame does.**

Wraps free-form content ⇒ `children`. Repeats a list ⇒ `items` data, `children` forbidden. Holds multiple roles ⇒ named slots, no `children`.

**FRAME-10 · A frame that changes shape names the width where it changes.**

`wrap` carries no threshold, so a row whose child can shrink almost never wraps. Name the breakpoint.

## Notes

_Empty on purpose. Anchored rules for `frame` go here — each from something that actually broke,
with the case that proves it._

---

Examples: [`../examples/frame.md`](../examples/frame.md) · Architecture: [`concept.md`](../concept.md)
