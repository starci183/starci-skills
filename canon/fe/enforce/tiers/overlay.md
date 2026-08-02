# overlay

A surface that covers the page: modal, drawer, popover shell.

> **Read the worked examples first:** [`../examples/overlay.md`](../examples/overlay.md) — real components
> at this tier, each with what it renders and why it sits here. The rules below are easier to judge
> once the examples are in front of you.

## At a glance

| | |
|---|---|
| group | sentence — one product saying something specific |
| owns | a surface that covers the page: modal, drawer, popover shell |
| never | owns domain data |
| may import | composites, frames |
| takes `className` | **no** |
| composes classes (`cn`) | only for the surface it owns |
| tiers below | atom · frame · composite · block · layout |

## Rules

**OVERLAY-1 · It owns a surface that covers the page: modal, drawer, popover shell.**

Anything outside that scope belongs to another tier, whatever the folder says.

**OVERLAY-2 · It never owns domain data.**

This is the line that decides the tier, not a preference about style.

**OVERLAY-3 · It may import: composites, frames.**

Imports run downward only. A lower tier that reaches up stops being usable anywhere the upper tier is absent.

**OVERLAY-4 · It does **not** take `className`.**

Accepting it hands the caller an escape hatch: the difference then lives at the call site, invisible to every other screen that will need the same thing. Closing it forces the change one tier down, where it gets a name.

**OVERLAY-5 · It composes classes (`cn`): only for the surface it owns.**

Deciding appearance is exactly this tier's work.

**OVERLAY-6 · It belongs here when: it traps focus and dims what is behind.**

Use this to confirm a placement, not to argue one.

**OVERLAY-7 · It is in the wrong tier when: it does not cover anything — it is a composite.**

This is the detection signal — the thing to look for in review.

**OVERLAY-8 · It must trap focus and dim what is behind.**

If it does neither it is not covering anything, and a composite in a card does the job with far less machinery.

**OVERLAY-9 · The surface is the overlay's; the entity belongs to a block inside it.**

A modal with a domain-shaped prop list has stopped being a reusable shell and become one feature's.

## Notes

_Empty on purpose. Anchored rules for `overlay` go here — each from something that actually broke,
with the case that proves it._

---

Examples: [`../examples/overlay.md`](../examples/overlay.md) · Architecture: [`concept.md`](../concept.md)
