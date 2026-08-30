# Direction visualization

| Field | Value |
| --- | --- |
| Knowledge ID | `direction.visualization` |
| Scope | Any redesign or unresolved product/technical direction choice |
| Search tags | `redesign, alternatives, direction, visualize, mockup, architecture` |

## Decision law

When a redesign has no already approved direction, produce three or four materially different
directions and render them through `visualize` before asking the user to choose. Prose, Mermaid,
ASCII boxes, a Markdown table, implementation notes, or a list of trade-offs cannot substitute for
the rendered comparison. The agent owns the effort required to make the alternatives understandable;
the reviewer must not have to imagine the proposed structure from text.

A direction is material only when it changes an important boundary, responsibility, sequence,
interaction model, information hierarchy, responsive composition, recovery strategy, or operational
trade-off. Color, decoration, spacing, or naming variants do not count as separate directions.

Every comparison:

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

- Fewer than three or more than four directions when a genuine choice is required.
- A claimed direction lacks a visual panel or inspectable HTML artifact.
- The visual omits the exact distinction used to recommend or reject that direction.
- A UX/UI proposal shows only one viewport or only a pretty baseline state.
- An architecture proposal cannot trace boundaries and flows under both normal and adverse operation.
- The approval request appears before the rendered comparison.
