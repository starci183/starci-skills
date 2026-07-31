# composite

A reusable shape assembled from atoms inside frames.

> **Read the worked examples first:** [`../examples/composite.md`](../examples/composite.md) — real components
> at this tier, each with what it renders and why it sits here. The rules below are easier to judge
> once the examples are in front of you.

## At a glance

| | |
|---|---|
| group | vocabulary — a word any product can use |
| owns | a reusable shape assembled from atoms inside frames |
| never | knows any domain entity |
| may import | atoms, frames |
| takes `className` | yes |
| composes classes (`cn`) | yes |
| tiers below | atom · frame |

## Rules

**COMPOSITE-1 · It owns a reusable shape assembled from atoms inside frames.**

Anything outside that scope belongs to another tier, whatever the folder says.

**COMPOSITE-2 · It never knows a domain entity.**

This is the line that decides the tier, not a preference about style.

**COMPOSITE-3 · It may import: atoms, frames.**

Imports run downward only. A lower tier that reaches up stops being usable anywhere the upper tier is absent.

**COMPOSITE-4 · It takes `className`: yes.**

This tier is vocabulary — the caller adjusts spacing and placement, and that is the whole point of it being reusable.

**COMPOSITE-5 · It composes classes (`cn`): yes.**

Deciding appearance is exactly this tier's work.

**COMPOSITE-6 · It belongs here when: props are shapes: items, title, onPress.**

Use this to confirm a placement, not to argue one.

**COMPOSITE-7 · It is in the wrong tier when: a prop names a domain entity — it is a block.**

This is the detection signal — the thing to look for in review.

**COMPOSITE-8 · Props are slots and shapes, never fields of an entity.**

`items`, `title`, `onPress`, `header`/`body`/`footer`. The moment a prop is named after a domain field, the component has moved a tier up.

**COMPOSITE-9 · Two components may share data and differ only in placement.**

A ratio as a ring and the same ratio as a bar are two components on purpose. Placement is a shape decision, and merging them hides it behind a variant flag.

## Notes

_Empty on purpose. Anchored rules for `composite` go here — each from something that actually broke,
with the case that proves it._

---

Examples: [`../examples/composite.md`](../examples/composite.md) · Architecture: [`concept.md`](../concept.md)
