# Heavy technology proves capability; it is not decoration

Some products make a claim about their own technical competence. When they do, their interface is
part of the evidence: a three-dimensional scene, a node graph, a live canvas, a real-time surface
all carry weight, because they are congruent with the claim. Congruence is what buys authority — the
demonstration and the claim have to be about the same thing. Prettiness buys nothing.

## The rule

- **Heavy technology must serve a real job** — describing a system, letting someone draw one,
  walking a data flow, showing a signal as it arrives — **and** demonstrate capability at the same
  time. Beautiful with no substance is showing off, and gets cut.
- **The one-sentence test:** *does this scene, graph or canvas prove a capability the product
  actually claims, or is it eye candy?* If the first half cannot be answered, remove it.
- **Where it is right:** an infrastructure product drawing the real topology of a running deployment
  as a pannable node graph, so the reader can trace one request through it; a design tool whose
  canvas is the product; an analytics surface streaming values as they land instead of on a refresh
  button. **Where it is wrong:** particle effects behind a pricing table, a rotating model on a
  settings page, an animation nobody needed and nobody can turn off.
- **It still has to be honest.** Demonstrate a capability that is real. A staged animation of a
  system the product does not actually run is a claim, not a demonstration, and it is the kind of
  claim a technical audience checks.
- **The cost is paid by everyone, so cap it.** Honour `prefers-reduced-motion` (WCAG 2.2, 2.3.3
  Animation from Interactions), give the canvas a static fallback and a keyboard path to the same
  information, and do not let a decorative scene sit on the critical rendering path of the page it
  decorates.
- Heavy **with a purpose** is not a violation of `design-restraint.md`. Restraint forbids the
  superfluous; it does not forbid serious engineering that has a reason.

The aesthetic-usability effect is real — Nielsen Norman's write-up of it is the standard reference —
but it cuts both ways here. A beautiful surface buys tolerance for small friction; it does not buy
credibility for a claim it has nothing to do with, and a reader who notices the mismatch discounts
the claim rather than the decoration.

Related: `persuasion-psychology.md` (authority is capability shown, not asserted),
`design-restraint.md` (heavy but not superfluous), `accessibility.md`.
