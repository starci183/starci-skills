# Affordance and feedback: the interface always answers

Two families turn out to be one rule. The affordance side governs what happens when something can be
clicked; the feedback side governs what happens while the interface waits, or when there is nothing
to show. Both say the same thing: **the interface never goes silent.**

The two halves have separate lineages that arrive at the same place. Norman's account of affordances
and signifiers says a control has to advertise what it will do before it is touched; Nielsen's first
usability heuristic, visibility of system status, says the system has to keep saying what it is
doing afterwards. A surface that fails either one leaves the reader guessing, and guessing is where
they stop.

## The test

**Anything clickable must look clickable — hover, cursor, focus ring. Any region waiting on data
must handle loading, empty and error explicitly. Never render nothing silently, and never render a
control that does nothing.**

## The rules

- **Every interactive element** — a button, a row that opens a drawer, a link, a clickable chip —
  has a hover state, a pointer cursor, and a focus ring, and the **whole** element is the hit
  target. A hover that only fires when the pointer lands on the inner text is a bug: the reader
  aimed at the row, and the row is what has to respond.
- **The hover style matches the nature of the action.** Going somewhere underlines the title. A
  person's identity — an avatar with a name — fades as one cluster. Staying here, as with an
  accordion or an in-place select, fills the background. One hover style applied to all three tells
  the reader nothing about what is about to happen.
- **A data-fetching region has four branches: error, loading, empty, content.** A section that
  carries a **label** on a page the reader deliberately opened must render a meaningful empty state
  when it is empty — icon, title, hint — rather than removing itself from the page. A labelled hole
  reads as a broken page; a section that vanishes reads as one the reader has lost.
- **A call to action appears only when it does something.** Resume is hidden when the reader is
  already at exactly that position. A control that cannot act is not rendered, and is not rendered
  disabled either unless the disabled state itself carries the explanation.
- **No fake loading.** No timer, no artificial hold to "show that it is loading". The skeleton is
  visible for the duration of the real request and no longer. Nielsen Norman's work on skeleton
  screens is about matching the shape of what is coming, not about performing a wait that is not
  happening.

The two halves meet at the empty state. A region is often empty because the data really is empty,
which makes the empty branch a design surface in its own right rather than an error path — see
`grounded-in-data.md`.

Related: `interactive-needs-hover.md`, `hover-style-matches-clickable-nature.md`,
`content-linking.md` (an empty state that offers no way onward is a dead end).
