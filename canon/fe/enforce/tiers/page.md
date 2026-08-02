# page

A list of functions: which blocks, in which frames, fed which data.

> **Read the worked examples first:** [`../examples/page.md`](../examples/page.md) — real components
> at this tier, each with what it renders and why it sits here. The rules below are easier to judge
> once the examples are in front of you.

A page is a data-owning tier, so it splits into two files — see [`../split.md`](../split.md). The
presentational `component.tsx` (`_Name`) is the arrangement and composes **connected** blocks; the connected
`index.tsx` owns the page-level data and i18n.

## At a glance

| | |
|---|---|
| group | sentence — one product saying something specific |
| owns | a list of functions: which blocks, in which frames, fed which data |
| never | draws a shape of its own |
| may import | blocks, composites, frames |
| takes `className` | **no** |
| composes classes (`cn`) | **never** |
| tiers below | atom · frame · composite · block · layout · overlay |

## Rules

**PAGE-1 · It owns a list of functions: which blocks, in which frames, fed which data.**

Anything outside that scope belongs to another tier, whatever the folder says.

**PAGE-2 · It never draws a shape of its own.**

This is the line that decides the tier, not a preference about style.

**PAGE-3 · It may import: blocks, composites, frames.**

Imports run downward only. A lower tier that reaches up stops being usable anywhere the upper tier is absent.

**PAGE-4 · It does **not** take `className`.**

Accepting it hands the caller an escape hatch: the difference then lives at the call site, invisible to every other screen that will need the same thing. Closing it forces the change one tier down, where it gets a name.

**PAGE-5 · It composes classes (`cn`): **never**.**

Composing a class string is deciding what something looks like. A tier that decides that has taken a lower tier's job — read it as: a composite is missing, or an existing one needs a variant.

**PAGE-6 · It belongs here when: it names blocks and passes typed data, nothing more.**

Use this to confirm a placement, not to argue one.

**PAGE-7 · It is in the wrong tier when: it builds a shape inline — a block is missing.**

This is the detection signal — the thing to look for in review.

**PAGE-8 · A page reaching for an atom means a block is missing.**

Not illegal, but it has one cause: the page needed a shape, no block offered it, so it built one inline where no other screen can find it. The fix is to write the block, never to allow the reach.

## Notes

_Empty on purpose. Anchored rules for `page` go here — each from something that actually broke,
with the case that proves it._

---

Examples: [`../examples/page.md`](../examples/page.md) · Architecture: [`concept.md`](../concept.md)
