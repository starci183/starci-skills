# Direction visualization guidance

| Field | Value |
| --- | --- |
| Knowledge ID | `direction.visualization` |
| Contract revision | `7.6.0` |
| Scope | Internal `generate` guidance for a new or reconstructed product/technical direction |
| Search tags | `generate, redesign, alternatives, direction, visualize, mockup, architecture` |
| Dependencies | `fe.ui` for frontend routing and visual contract authority |

## Boundary

This record guides the optional `generate` stage; it does not own implementation or repair. Frontend
`refine` skips generation. A `new` or `reconstruct` mission also skips it when compile already binds
an approved direction. Only the parent frontend machine may open the alternatives-only user-choice
wait and resume the exact chosen direction at apply.

## Default decision

Produce one dominant, reversible direction, render enough realistic material to falsify it, and pass
the coherent artifact to apply. The agent owns this judgment; a user does not choose among variants
merely because the incumbent design failed.

Generate three or four materially different directions when the complete Grammar admits several real
compositions and none materially dominates, or when the user explicitly requests comparison.
Render all of them in one real inspectable comparison artifact and expose the material trade-offs.
Return `requiresChoice=true`; the parent machine then waits for one correlated user choice and resumes
that exact direction at apply without another ideation pass. Prose, Mermaid, ASCII, implementation
notes, or a trade-off table alone cannot satisfy a visual comparison.

Missing semantic rule, token, component/export, state, or responsive interface is `grammar-gap`, not
visual ambiguity. Stop generation, return the exact Grammar-owner repair/publish request, and
recompile after the new package identity exists. Never pad a comparison with local CSS improvisation
or directions that assume an unpublished Grammar contract.

A direction is material only when it changes a boundary, responsibility, sequence, interaction
model, information hierarchy, responsive composition, recovery strategy, or operational trade-off.
Color, decoration, token, spacing, or naming variants are one direction.

## Product-family evidence

Blind direction work is blind to the incumbent target as an answer, not blind to the product family.
Inventory nearby sibling surfaces and record relevant shared signatures: hero treatment, semantic
color roles, typography hierarchy, shell rhythm, navigation model, and published Grammar
compositions. Reuse each applicable signature or state why the target's outcome, owner, responsive
lifecycle, or interaction model makes it inapplicable.

Sibling pages and product examples are evidence of those signatures, never templates or
page-specific authority. Reuse the relationship, not the screenshot. A direction that invents a new
local website language without an evidenced exception is invalid.

Media is independent from family resemblance. Add media only for an explicit purpose such as
orientation, explanation, identity, evidence, or a meaningful empty state. Resolve task focus and
dead space through information structure first. `No media` is correct when an image would distract or
only fill area. Any reusable or generated asset declares purpose, owner, placement, responsive
behavior, and alternative-text intent.

## Render contract

### UX/UI

Render realistic pages or substantial surfaces with representative content, not abstract boxes.
Expose the changed journey, semantic block owners, reading and action order, selected Grammar
objects, multi-item behavior, wide and constrained composition, and at least one consequential
pending, failure, recovery, or boundary state.

### Architecture

Render ownership boundaries, data/control flow, normal operation, retry/idempotency, relevant
concurrency or stale state, dependency outage and recovery, migration/rollback, and differentiating
cost or coupling. A reviewer must be able to trace one real request or event.

### Journey, workflow, or business model

Render actors, decisions, state transitions, ownership, failure/recovery paths, and meaningful
outcomes using the visual form that best exposes the choice.

## Rejection conditions

Reject a generated product when:

- comparison mode contains fewer than three or more than four material directions;
- alternatives are manufactured even though one direction materially dominates, or a separate choice
  stage is introduced;
- any claimed direction lacks an inspectable visual reference;
- the visual omits the distinction used to recommend it;
- a UX/UI proposal lacks a constrained viewport or consequential state;
- a generated direction conflicts with frozen business facts, owner ceiling, or Grammar;
- a Grammar gap is disguised as a visual option or local implementation workaround;
- an architecture proposal cannot trace normal and adverse flows.
