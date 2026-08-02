# A secondary overlay opened from inside a popover renders in-panel, not as a body-level Drawer or Modal — STRICT

> Read from the AI chat panel, a FAB popover, which needed to open "Cài đặt" and "Cuộc trò chuyện".
> Both landed *behind* the popover that opened them.

## Root cause, from the real CSS

HeroUI bakes `@apply fixed inset-0 z-50` into `.modal__backdrop` and `.drawer__backdrop` **in the
utility layer**. Adding `z-[70]` or `z-[80]` through `className` lands in the *same* utility layer,
so the winner is decided by **source order rather than specificity** — the component CSS comes later
in the bundle, the original `z-50` wins, and the hand-added `z-[N]` does nothing.

Meanwhile the popover (a react-aria portal, which does not pin a z-index this way) sits above a
`z-50` backdrop. The child Modal or Drawer therefore sinks underneath the parent popover that opened
it. This is the popover-on-popover problem every design system warns about: a third floating layer
means a dialog or an in-place render, not a popover stacked on a popover.

## The rule

A secondary overlay opened **from inside a popover** — settings, a sub-list, a confirmation —
renders **in-panel**: a view that slides over the panel's current content, inside the parent
popover's single floating layer. Not a separate body-level `Drawer` or `Modal`. There is then no
z-fight at all, because there is only one floating layer, and the same code works for the desktop
popover and the mobile presentation alike.

## How it is built

The component holds `view: "main" | "subViewA" | "subViewB"`. The header, or whichever control opens
a sub-view, switches `view`; every sub-view carries a back arrow returning to `"main"`. Do not mount
a global `Drawer` or `Modal` for it — and remove it from the app-wide modal container if one is
already registered there, or it is orphaned.

## Do not fight the z-index

A plain class cannot beat an `@apply z-50` baked into the same layer. If an independent Modal or
Drawer genuinely needs to move — one that is *not* inside a popover — the ways that work are
`!z-[N]` or an inline `style={{ zIndex: N }}`. For a secondary overlay opened from a popover, that
is the wrong fix: rendering in-panel is the answer, not a z-index patch.

## The question that decides it

Is this overlay opened from a popover that is already open — a chat FAB, a dropdown — or from the
page or root layout? From a popover, render in-panel. From the page, a normal Modal or Drawer is
fine, because there is no popover ancestor to sit above it.

## Related

`when-drawer.md` — when a Drawer is the right container in the ordinary, non-nested case.
