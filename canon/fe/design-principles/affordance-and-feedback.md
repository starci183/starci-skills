# Affordance and feedback: the interface always answers

This is the umbrella over two families that turn out to be one rule. The affordance side —
`interactive-needs-hover.md` and `hover-style-matches-clickable-nature.md` — governs what happens
when someone can click. The feedback side — the labelled-section empty-state rule,
`resume-cta-only-when-away.md`, and the removal of the artificial `AsyncContent` hold — governs
what happens while waiting or when there is nothing. Both say the same thing: **the interface never
goes silent.**

## The test

**Anything clickable must look clickable — hover, cursor, focus ring. Any region waiting on data
must handle loading, empty and error explicitly. Never render nothing silently, and never render a
control that does nothing.**

## The rules

- **Every interactive element** — a button, a row that opens a drawer, a link, a clickable chip —
  has a hover state, `cursor-pointer`, and a focus ring, and the **whole** element is the hit
  target via `group`. A hover that only fires when the pointer lands on the inner text is a bug.
- **The hover style matches the nature of the action.** Going somewhere (navigation) underlines the
  title. A user identity (avatar plus name) fades the whole cluster with opacity. Staying here (an
  accordion, an in-place select) fills the background. One hover style for all three is wrong.
- **A data-fetching region has four branches: `error → loading → empty → content`.** A section that
  carries a **label** on a page the user deliberately opened must render a meaningful empty state
  when it is empty — icon, title, hint — and must not `return null` to hide itself. A labelled hole
  reads as a broken page.
- **A call to action appears only when it does something.** "Tiếp tục" / Resume is hidden when the
  user is already at exactly that position; a no-op button is not rendered.
- **No fake loading.** No timer or artificial hold to "show that it is loading". The skeleton is
  visible for the duration of the real load and no longer.

Already applied in: `interactive-needs-hover.md` and `hover-style-matches-clickable-nature.md`
(hover mandatory, and matched to the nature of the action); the labelled-section rule (empty renders
an empty state rather than self-hiding); `resume-cta-only-when-away.md` (the CTA hides when it would
be a no-op); the `AsyncContent` change that removed a 3-second debug hold faking a load.

Related: `grounded-in-data.md` — an empty state is often empty because the real data is empty, which
is where these two principles meet.
