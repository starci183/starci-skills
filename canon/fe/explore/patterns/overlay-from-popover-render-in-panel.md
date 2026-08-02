# A secondary overlay opened from inside a popover renders in-panel, not as a body-level drawer or modal — STRICT

> The mechanism is CSS stacking, not a component bug, and every design system that publishes layering
> guidance — Material's elevation model, Fluent's layer stack — says the same thing in the end: one
> floating layer at a time. A popover stacked on a popover has no defensible z-order, and the WAI-ARIA
> authoring practices agree from the keyboard side, since a popover is expected to close when focus
> leaves it and a child dialog is exactly focus leaving it.

## Root cause, from the real cascade

Component libraries commonly bake `position: fixed; inset: 0; z-index: 50` into the backdrop of their
modal and drawer, applied inside a utility layer. A z-index added afterwards through a class name
lands in the **same layer**, so the winner is decided by **source order rather than specificity** —
the library's stylesheet comes later in the bundle, its value wins, and the hand-added one does
nothing at all. The class is present in the DOM and inert, which is why this costs an afternoon.

Meanwhile the popover itself is usually portalled by a headless layer that does not pin a z-index
this way, and it sits above that backdrop. A modal or drawer opened from inside the popover therefore
sinks underneath the very panel that opened it.

## The rule

A secondary overlay opened **from inside a popover** — settings, a sub-list, a confirmation — renders
**in-panel**: a view that slides over the panel's current content, inside the parent popover's single
floating layer. Not a separate body-level drawer or modal.

There is then no stacking fight at all, because there is only one floating layer, and the same code
serves the desktop popover and its mobile presentation alike.

## How it is built

The panel holds a view state — main, and one value per sub-view. Whichever control opens a sub-view
switches the state; every sub-view carries a back control returning to main. Do not also mount a
global drawer or modal for it, and remove it from any application-wide overlay registry, or an
orphaned copy stays mounted and reachable by nothing.

Worked example: an assistant panel opened from a floating action button needs a settings view and a
conversation list. Both are views inside the panel with a back arrow, not overlays of their own.

## Do not fight the z-index

A plain class cannot beat a z-index applied inside the same layer. If an **independent** modal or
drawer genuinely needs to move — one that is not inside a popover — the escapes that work are an
importance flag or an inline style, both of which sit outside the layer contest. For a secondary
overlay opened from a popover, that is the wrong fix even when it works: it leaves two floating
layers and a focus model nobody can reason about.

## The question that decides it

Is this overlay opened from a popover that is already open, or from the page or root layout? From a
popover, render in-panel. From the page, an ordinary modal or drawer is correct, because there is no
popover ancestor for it to sit above.

## Related

`when-drawer.md` — when a drawer is the right container in the ordinary, non-nested case.
