# Execute `source/conversation-query`

## Context

Read only `context.policy`, `context.index`, and the bounded `context.candidateHeads` resolved by default search. Never load transcript bodies.

## Input

Use exactly one `input.identity` and its matching `input.authorizedScope`.

## Action

Resolve that identity once. Verify authorization and index freshness, require every candidate to match the identity, and accept only one candidate rebound to its current durable head hash. Do not record provenance, broaden the search, route the workflow, or manage session cleanup.

## Output

Return one typed outcome, its exact reason, current head and authorized artifact references only when found, and the evidence inspected. Never return query prose or transcript content.

## Stop

Reject malformed or over-broad candidate context. Report forbidden, stale, and ambiguous observations without repairing them.
