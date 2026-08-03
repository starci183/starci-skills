# Landing generation — an oracle briefs the plan, the build lane proves it

> Two kinds of knowledge meet on a marketing surface. One is broad visual intelligence — which of
> the settled landing shapes fits this product, which palette and type pairing carry the tone, which
> motion tier is right, which UX guidelines are non-negotiable — the kind a searchable design
> database answers in seconds and a single hand reinvents slowly and unevenly (the `ui-ux-pro-max`
> skill is one such database: catalogued landing patterns each with a section order and a call-to-
> action placement, palettes, type pairings, a priority-ordered UX ruleset, and a pre-delivery
> checklist). The other kind of knowledge is this design system's own discipline: one book, the
> tiers, the real-data rule, the gates. A landing generated well uses the first to write the brief
> and the second to build and prove it. Either alone is the failure — the oracle alone ships an
> ungrounded, ungated page of invented proof; the lane alone reinvents visual decisions a database
> already settled.

## When this applies

Generating or redesigning a landing or marketing surface: a public selling or storytelling page with
no task or form inside it. The SHAPE of such a page is [`marketing-landing`](../layouts/marketing-landing.md);
the copy, claim and proof rules are [[landing-marketing]]. This pattern governs only *how the two
bodies of knowledge combine* while generating one.

Not for an app surface a person operates. There the shell-from-job rule and the component matrix
(`canon/fe/enforce/tiers/architecture.md`) already decide the shape, and a marketing-pattern database
has nothing to add. A landing page that grows a real form has become two surfaces wearing one route —
send the form to `centered-form-setup` and keep this pattern for the selling half.

## The oracle briefs the plan; it never writes code

The design database is consulted at exactly one moment: the **brief** step of designing the flow
(`starci-fe-layout-plan`), where each surface's shell is chosen and each block is briefed against a
looked-up component rather than invented. Instead of inventing the arrangement, ask the oracle for
the settled one — the landing pattern that fits the product type, and with it the palette, the type
pairing, the motion tier and the anti-patterns to avoid. Its answer SEEDS the region map, the block
briefs and the clickable prototype; it does not replace them. The operational commands and the
pattern-to-shell mapping live in [`references/pro-max-bridge.md`](references/pro-max-bridge.md).

The oracle's output is a recommendation, not a ruling. It is stack-agnostic and it does not know this
product's real catalogue. So it is read as advice a senior designer offers, and it stops at the
brief: it never emits application code, never names a tier, never touches the book, and never stands
in for a gate.

## Every recommendation passes the real-data filter before it enters the brief

A marketing-pattern database is optimised for conversion in the abstract, so it will hand you proof
you do not have — "86% more engagement", "join 10,000 readers", a live countdown, a five-star review
strip, an illustrative "87/100" score. [[landing-marketing]] is the filter every one of those passes
through before it is allowed onto the page, and where the two disagree, [[landing-marketing]] wins,
because it is the layer that gets enforced:

- **Invented proof becomes a real number with a gate, a static illustration, or editorial copy.** A
  metric on the page is a field the back end can actually produce, hidden below a minimum rather than
  padded; a sample card openly playing "example" is a static constant, not one real person's data; a
  claim with no number behind it stays a sentence, not a fake statistic ([[grounded-in-data]]).
- **A feature dump becomes a curated selection.** The oracle's "list every feature" grid collapses to
  a few representative sections — one entity, one section — and three or more items sharing one axis
  become a matrix drawn once, not the same criteria repeated inside every card.
- **Shared agreements are kept, not re-decided.** Where the database and this canon already agree —
  no emoji as structural icons ([[no-emoji]]), body contrast ≥ 4.5:1, semantic tokens over raw hex,
  motion in the 150–300ms range with a reduced-motion path, a real type scale — the oracle's version
  is simply adopted; it is the same rule stated twice.

## The build lane and its gates are unchanged

Once the brief is filtered, nothing about the build changes. The landing's blocks and composites are
authored at their tier in the one book, each with a story that puts its states side by side
(`starci-fe-layout-apply`), and synced into the app as twins (`starci-fe-sync`); motion runs through
the project's single motion system, not a snippet pasted per section. The source gates
(`scripts/gates/`) and the rendered-tree contract remain the only pass/fail — presentational purity,
skeleton parity, doc parity, one flat namespace, the spacing scale, and no `src` file reaching into
the book. The oracle's own pre-delivery checklist (contrast, touch-target size, motion timing,
reduced-motion, dark-mode parity) runs as an ADDITIONAL review pass over the built surface; it
supplements the gates and never substitutes for them.

The whole arrangement in one line: the oracle writes the brief, this system builds and proves it.
