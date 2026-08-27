# Architecture decision review

This file governs presentation only. Operator schemas, validated task-session artifacts and the parent state machine remain authoritative.

## Required review

- Before any `OK ARCHITECTURE` wait, render the validated `architecture/decision-challenge` `payload.reviewPreview` artifact through `visualize` in the conversation.
- Compare every challenged option and make the recommended option useful on first render, while showing the strongest evidence-linked case against it with equal visual prominence.
- Show decision-relevant system boundaries and data flow, plus normal operation, retry/idempotency, concurrency/stale state, dependency outage and recovery, migration, rollback, coupling, cost and reversibility.
- Preserve every exact option ID, the exact option-set hash and the exact approval command for the active option.
- Show hidden assumptions, counterexamples, falsification tests, operational surprises, unresolved critical challenges and whether adversarial review changed the recommendation.
- Keep selection inside the review presentation-only. A click or toggle never approves an option or mutates the operator result.
- Ask for the exact approval command outside the rendered review and enter the wait only after the visualization is visible.

## Stop conditions

- Prose, a Markdown table, Mermaid, ASCII art or a static code block cannot replace the interactive review for a ready architecture decision.
- If the preview is absent, incomplete, unvalidated or cannot be rendered, stop before architecture approval.
- Do not invent architecture facts, business constraints or scores for presentation.
- Do not use polished diagrams, consensus language or recommendation-first ordering to bury adverse evidence.
- Keep the review task-session-only and register it as evidence and for terminal purge.
- Resolve the review artifact to its absolute executor-side HTML path, then generate the content reference only with `node <Source>/.claude/scripts/visualize-directive.mjs <absolute-path>` and paste stdout unchanged into the same response as the approval request. Never handwrite or interpolate the `visualize` JSON. The helper normalizes Windows separators to `/`, rejects control characters such as interpreted `\\n`, `\\r`, or `\\t`, and proves JSON round-trip safety. Stop before approval when the helper fails or the preview is not visibly rendered.
