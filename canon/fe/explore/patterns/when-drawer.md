# When to use a Drawer — hiding secondary information behind a label that opens

> The decision heuristic: a surface carrying too much secondary information should not lay it all
> out inline. Collect the secondary part into a **Drawer** and leave a **label with a caret** that
> opens it on demand.

## The rule

When a surface — modal, panel, card or page — holds so much secondary information or so many
secondary choices that the primary one is diluted, hide the secondary part behind a
`label + caret-right` row that opens a Drawer. The **primary** part (the reason the user came) is
laid out directly; the **secondary** part (rarely used, optional, for reference) collapses into a
single label row. A Drawer is a drawer: it slides out temporarily and closes back into the main
flow, so it takes up no permanent space.

## What counts as secondary — any one of these is worth considering

1. **Rarely used, a minority need** — international payment gateways for a Vietnamese audience;
   advanced settings; history and logs.
2. **It dilutes the main decision** — placed level with the primary content, it pulls attention away
   from the one primary action.
3. **Large but not needed immediately** — a long list, a secondary form, reference detail.

## The trigger is a clickable label row, not a stray button

`[icon + label]` on the left, `caret-right` on the right, with hover and cursor on the whole row.
The classes and the pattern are in `elements/label` §2, the summary row that opens a drawer. The
caret slides on hover.

**Placement**: `right` on desktop, `bottom` on mobile (`useSmViewpoint`). Use the HeroUI `Drawer`
block already in the repo (`E2eResultDrawer` among others) rather than hand-rolling an overlay. Wrap
long content in `ScrollShadow`.

**Hide the label row when the secondary content is empty or unavailable** — never leave a row that
opens onto an empty drawer. The international gateway row is hidden outright when the order has no
USD price. No dead rows.

## Drawer against Modal against inline

- **Inline** — the primary content, needed immediately, and small. Laid out directly, as a list card
  or a section.
- **Drawer** — the secondary part of the *same* flow: open it, then return to the flow. Settings, a
  cluster of optional choices, detail. It slides in from the edge without leaving the context.
- **Modal** — a **blocking step** that must be decided or filled in before continuing: a
  confirmation, a required form. It takes the centre with a dimmed background. A modal is not for
  "see more secondary information" — that is a Drawer.

"A label that opens a modal" has the right instinct — hide it behind a label — but for information
that is read and then left behind, a Drawer fits better than a modal. Keep the modal for the
blocking step.

## The general form

Count what is on the surface: which part is the actual job? If the rest is **not always needed**, do
not pack it inline, where it both dilutes and lengthens the page — give it one label that opens a
Drawer. A tight surface is a fast decision, which is the same reason Baymard's checkout research
gives: secondary content must not steal the focus from the CTA.

## First applied 2026-06-24

`PaymentModal`: the domestic gateways (PayOS, Sepay — the primary case) are laid out directly as a
list card; the international gateways (Stripe, PayPal, Crypto — secondary, rarely used by a
Vietnamese audience) sit behind a "Thanh toán quốc tế ›" label row that opens a Drawer, and that row
is hidden when `!hasUsd`.

## Related

`overlay-from-popover-render-in-panel.md` — the exception: a Drawer opened from inside a popover
renders in-panel instead.
