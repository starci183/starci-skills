# Execute `fe/interaction-container-decision`

## Step 1 — Classify each interaction job

**Read:** the approved direction, modeled UX flow, exact interaction references, and interaction-container knowledge. **Context:** inspect user goal, trigger, task criticality, navigation ownership, persistence, comparison need, content length, and recovery; ignore current component availability. **Session write:** one task role and behavior profile for every meaningful interaction. **Stop:** when an interaction lacks a trigger, owner, or user outcome. **Orchestration:** independent classification is allowed in parallel, but one coordinator owns cross-flow consistency.

## Step 2 — Compare all containers

**Read:** one behavior profile at a time. **Context:** compare `page`, `modal`, `drawer`, `popover`, and `inline`; do not default to page/inline and do not choose an overlay for visual emphasis. **Session write:** selected container, decision basis, and an explicit reason rejecting each other container. **Stop:** on an unbounded modal, a primary journey hidden in a drawer, a workflow inside a popover, or inline content without a stable owner. **Orchestration:** challenge ambiguous modal-versus-drawer and page-versus-drawer decisions independently in balanced, parallel, or deep modes.

## Step 3 — Define behavior and responsive transformation

**Read:** selected container and flow transitions. **Context:** preserve navigation semantics while adapting presentation; mobile is a new constraint, not a scaled desktop. **Session write:** blocking behavior, close/back and dismissal rules, focus return, scroll/context ownership, and desktop/mobile containers with transformation reason. **Stop:** when dismissal can lose work, focus return is undefined for an overlay, or a desktop drawer/popover has no constrained-viewport decision. **Orchestration:** the coordinator validates the complete container map before emitting review.
