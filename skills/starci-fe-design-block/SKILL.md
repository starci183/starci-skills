---
name: starci-fe-design-block
description: Generate and iterate three to four detailed render JSON candidates independently for each block in an accepted StarCi layout. Use only after a layout hash is whitelisted.
---

# StarCi FE Design Block

Read [`../../skill-shape.md`](../../skill-shape.md),
[`../../fe/gates/blocks/`](../../fe/gates/blocks/INDEX.md), the accepted layout object, contract
registry and relevant intent modules.
Require a user-declared `Project` or explicit `Frontend` and `Backend` inherited from the orchestrator.

## CONTEXT

Print canonical `### CONTEXT`, session id, accepted layout/decision hashes, block ids and heads.

## PROCESS

For every requested block, generate its own 3–4 candidates. A whole surface with `N` blocks yields
`N` sets and 3–4 × N candidates. Each candidate states exactly what renders: role, title,
description, reading order, collection/item grammar, fields/order/source, states, actions, copy,
responsive behavior, contract decision and pure/connected ownership.

Never combine unrelated choices into page-wide variants. Preserve accepted blocks while unresolved
blocks receive later rounds. Record exact prompt/response, `basedOnHash`, delta, rejection and
acceptance objects; refuse a block whose source layout hash is not approved.

## OUTPUT

Print `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED` and
`### OWED` in order, with one row per block set, candidate hashes, current whitelist and
only the unresolved block choices in `NEED APPROVALS`.
