# When to use a drawer — hiding secondary information behind a label that opens

> Progressive disclosure, as Nielsen has argued it for decades: show the few options most people need
> first, and defer the rest behind one clear control. Hick's Law gives the cost of not doing it — the
> time to decide grows with the number of options presented at once — and Baymard's checkout research
> gives the commercial version, where content competing with the primary action measurably reduces
> completion.

## The rule

When a surface — modal, panel, card or page — holds so much secondary information, or so many
secondary choices, that the primary one is diluted, hide the secondary part behind a row of label
plus caret that opens a drawer. The **primary** part, the reason the reader came, is laid out
directly. The **secondary** part — rarely used, optional, for reference — collapses into a single
label row. A drawer is a drawer: it slides out temporarily and closes back into the main flow, so it
occupies no permanent space.

## What counts as secondary — any one of these is worth considering

1. **Rarely used, a minority need** — payment methods a small share of the audience uses, advanced
   settings, history and logs.
2. **It dilutes the main decision** — set level with the primary content, it pulls attention away
   from the one primary action.
3. **Large but not needed immediately** — a long list, a secondary form, reference detail.

## The trigger is a clickable label row, not a stray button

An icon and label on the left, a right-pointing caret on the right, with hover state and pointer
cursor on the whole row rather than on the caret alone. The caret shifts slightly on hover, which is
what tells the reader the row is the control.

**Placement**: from the right edge on desktop, from the bottom on small viewports. Use the drawer
component the system already has rather than hand-rolling an overlay, and wrap long content in a
scroll container that shades its overflow, so the reader can see there is more.

**Hide the label row when the secondary content is empty or unavailable.** Never leave a row that
opens onto an empty drawer — that is worse than not offering it, because the reader spent a click
to learn nothing. In the payment example below, the international row is not rendered at all when the
order carries no foreign-currency price.

## Drawer against modal against inline

- **Inline** — the primary content: needed immediately, and small. Laid out directly as a card or a
  section.
- **Drawer** — the secondary part of the *same* flow: open it, then return. Settings, a cluster of
  optional choices, supporting detail. It slides in from the edge without leaving the context.
- **Modal** — a **blocking step** that must be decided or completed before continuing: a
  confirmation, a required form. It takes the centre with a dimmed background. A modal is not for
  "see more secondary information"; that is a drawer.

"A label that opens a modal" has the right instinct — hide it behind a label — but for information
that is read and then left behind, a drawer fits better. Keep the modal for the blocking step, or the
dimmed background stops meaning anything.

## The general form

Count what is on the surface and ask which part is the actual job. If the rest is **not always
needed**, do not pack it inline, where it both dilutes and lengthens the page. Give it one label that
opens a drawer. A tight surface is a fast decision.

## A worked example

A payment step offers, for most of its audience, two local methods: bank transfer and a domestic
wallet. Those are laid out directly as a list of options. The international methods — card, PayPal,
crypto — are a genuine minority need, and they sit behind a single row reading "International
payment" with a caret, which opens a drawer. The row is not rendered when the order has no
foreign-currency price. The primary decision is two options wide instead of five, and nothing was
removed from the product to get there.

## Related

`overlay-from-popover-render-in-panel.md` — the exception: a drawer opened from inside a popover
renders in-panel instead.
