# layout

The shell a whole route sits in.

> **Read the worked examples first:** [`../examples/layout.md`](../examples/layout.md) — real components
> at this tier, each with what it renders and why it sits here. The rules below are easier to judge
> once the examples are in front of you.

## At a glance

| | |
|---|---|
| group | sentence — one product saying something specific |
| owns | the shell a whole route sits in |
| never | owns content |
| may import | composites, frames |
| takes `className` | **no** |
| composes classes (`cn`) | only for the shell it owns |
| tiers below | atom · frame · composite · block |

## Rules

**LAYOUT-1 · It owns the shell a whole route sits in.**

Anything outside that scope belongs to another tier, whatever the folder says.

**LAYOUT-2 · It never owns content.**

This is the line that decides the tier, not a preference about style.

**LAYOUT-3 · It may import: composites, frames.**

Imports run downward only. A lower tier that reaches up stops being usable anywhere the upper tier is absent.

**LAYOUT-4 · It does **not** take `className`.**

Accepting it hands the caller an escape hatch: the difference then lives at the call site, invisible to every other screen that will need the same thing. Closing it forces the change one tier down, where it gets a name.

**LAYOUT-5 · It composes classes (`cn`): only for the shell it owns.**

Deciding appearance is exactly this tier's work.

**LAYOUT-6 · It belongs here when: every route of a section renders inside it.**

Use this to confirm a placement, not to argue one.

**LAYOUT-7 · It is in the wrong tier when: it is used by one screen only — it is a composite.**

This is the detection signal — the thing to look for in review.

**LAYOUT-8 · It is a layout only if every route of a section renders inside it.**

Used by one screen, it is a composite that got promoted by its name. Count the routes.

## Notes

_Empty on purpose. Anchored rules for `layout` go here — each from something that actually broke,
with the case that proves it._

---

Examples: [`../examples/layout.md`](../examples/layout.md) · Architecture: [`concept.md`](../concept.md)
