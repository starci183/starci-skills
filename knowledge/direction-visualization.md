# Direction visualization

| Field | Value |
| --- | --- |
| Knowledge ID | `direction.visualization` |
| Scope | Any redesign or unresolved product/technical direction choice |
| Search tags | `redesign, alternatives, direction, visualize, mockup, architecture` |

## Decision law

When a redesign has no already approved direction, brainstorm one dominant direction, render its
representative layout through `visualize`, and construct it immediately inside the frozen boundary.
Do not stop for a direction-choice round and do not generate alternatives by default. The agent owns
the judgment required to make the single direction coherent; the user should not have to choose among
options merely because the current layout failed.

Generate three or four materially different directions only when the user explicitly asks to compare
options, alternatives, or directions before implementation. In that explicit comparison mode, prose,
Mermaid, ASCII boxes, a Markdown table, implementation notes, or a list of trade-offs cannot
substitute for the rendered comparison.

Blind direction work is blind to the incumbent target as an answer, not blind to the product family.
Before generating candidates, inventory the nearest sibling surfaces and name the reusable visual
signatures that make them one product: hero treatment, semantic color roles, typography hierarchy,
shell rhythm, navigation model, and shared Grammar compositions. Every rendered direction must reuse
each relevant signature or visibly state why its user outcome or owner contract makes that signature
inapplicable. Reuse the product language, not a screenshot: never copy a sibling whose semantic owner,
interaction, responsive lifecycle, or business purpose differs. A direction that invents a new local
website language without this reconciliation is invalid and cannot enter `direction-choice`.

A direction is material only when it changes an important boundary, responsibility, sequence,
interaction model, information hierarchy, responsive composition, recovery strategy, or operational
trade-off. Color, decoration, spacing, or naming variants do not count as separate directions.

Every explicit comparison:

- renders all three or four directions in one inspectable HTML comparison or in separately inspectable
  HTML artifacts, with an exact visual panel reference for every direction;
- uses realistic domain content and labels, not generic placeholder boxes;
- exposes the states and scale needed to understand the decision, including at least one normal path
  and the most consequential failure, recovery, constrained, or boundary condition;
- states one recommendation and the strongest trade-off against it without visually hiding the other
  directions;
- remains presentation-only: visual controls may compare states but never approve, publish, mutate,
  submit, or silently select a direction;
- enters a user-choice wait only after the comparison is visibly rendered in the conversation.

A single-direction construct still renders enough of the normal path, consequential state, and
responsive composition to guide implementation, but it is an internal design artifact rather than a
user-choice gate. `fe/dominant-direction-generate` returns exactly one direction and routes directly
to Grammar bind/freeze/apply; it must never pass through ranking or `direction-choice`. Construct
resumes as soon as that artifact is coherent.

For frontend work, family coherence and media uniformity are separate decisions. Every direction must
reuse the relevant product-family signatures, but it must not add an illustration merely because a
sibling page has one. Evaluate media only against an explicit user purpose such as orientation,
explanation, identity, evidence, or a meaningful empty state. Resolve task-focus and dead-space
problems through information structure and responsive composition first. Choose `no media` when an
image would distract or only fill area; reuse or generate an asset only when the frozen media brief
names its purpose, owner, placement, responsive behavior, and alternative-text intent.

## Domain render contract

### Architecture

Render system and ownership boundaries, data/control flow, normal operation, retry or idempotency,
concurrency or stale state where applicable, dependency outage and recovery, migration/rollback, and
the cost or coupling that differentiates the alternatives. The diagram must let the reviewer trace a
real request or event; decorative topology alone is insufficient.

### UX/UI

Render realistic page or substantial-surface mockups, not abstract layout rectangles. Include enough
representative surfaces to expose the changed journey, plus wide and constrained responsive
composition and at least one material interaction or recovery state. A reconstruct proposal must
make region ownership, reading order, actions, reusable Grammar objects, and multi-item behavior
visible before source mutation begins.

### Journey, workflow, or business model

Render actors, decisions, state transitions, ownership, failure/recovery paths, and the meaningful
outcome. Use a diagram, timeline, or interactive comparison appropriate to the choice; prose-only
process descriptions are incomplete.

## Stop conditions

- Fewer than three or more than four directions when the user explicitly requested a comparison.
- Multiple directions or a direction-choice wait when the user did not request alternatives.
- A claimed direction lacks a visual panel or inspectable HTML artifact.
- The visual omits the exact distinction used to recommend or reject that direction.
- A UX/UI proposal shows only one viewport or only a pretty baseline state.
- An architecture proposal cannot trace boundaries and flows under both normal and adverse operation.
- The approval request appears before the rendered comparison.
