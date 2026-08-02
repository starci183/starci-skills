# block

Domain data and its async decisions.

> **Read the worked examples first:** [`../examples/block.md`](../examples/block.md) — real components
> at this tier, each with what it renders and why it sits here. The rules below are easier to judge
> once the examples are in front of you.

## At a glance

| | |
|---|---|
| group | sentence — one product saying something specific |
| owns | domain data and its async decisions |
| never | draws a shape of its own |
| may import | atoms, frames, composites |
| takes `className` | **no** |
| composes classes (`cn`) | rarely, and each time is a smell |
| tiers below | atom · frame · composite |

## Rules

**BLOCK-1 · It owns domain data and its async decisions.**

Anything outside that scope belongs to another tier, whatever the folder says.

**BLOCK-2 · It never draws a shape of its own.**

This is the line that decides the tier, not a preference about style.

**BLOCK-3 · It may import: atoms, frames, composites.**

Imports run downward only. A lower tier that reaches up stops being usable anywhere the upper tier is absent.

**BLOCK-4 · It does **not** take `className`.**

Accepting it hands the caller an escape hatch: the difference then lives at the call site, invisible to every other screen that will need the same thing. Closing it forces the change one tier down, where it gets a name.

**BLOCK-5 · It composes classes (`cn`): rarely, and each time is a smell.**

Composing a class string is deciding what something looks like. A tier that decides that has taken a lower tier's job — read it as: a composite is missing, or an existing one needs a variant.

**BLOCK-6 · It belongs here when: takes an entity and owns empty/loading/error.**

Use this to confirm a placement, not to argue one.

**BLOCK-7 · It is in the wrong tier when: it takes no data — it is a composite in the wrong folder.**

This is the detection signal — the thing to look for in review.

**BLOCK-8 · A block owns the async switch, in a fixed order.**

Error, then loading, then empty, then content. Error outranks a stale loading flag. Written in another order, a background refetch renders a stale error, or a real error hides behind a spinner.

**BLOCK-9 · A block takes an entity, not loose fields.**

A block with fourteen string props made its caller do the unpacking, and every caller will unpack it slightly differently.

**BLOCK-10 · Nothing below this tier may know a request exists.**

That is why the switch has exactly one place it can live.

See [`../split.md`](../split.md): the block is written as two files — a connected `index.tsx` that owns the
request and a presentational `component.tsx` (`_Name`) that owns the switch render, fed a status rather than
a request. BLOCK-8 and BLOCK-10 both still hold across the split.

## Notes

_Empty on purpose. Anchored rules for `block` go here — each from something that actually broke,
with the case that proves it._

---

Examples: [`../examples/block.md`](../examples/block.md) · Architecture: [`concept.md`](../concept.md)
