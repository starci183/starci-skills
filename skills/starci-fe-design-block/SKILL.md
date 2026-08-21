---
name: starci-fe-design-block
description: Generate and iterate three to four detailed render JSON candidates independently for each block in an accepted StarCi layout. Use only after a layout hash is whitelisted.
---

# StarCi FE Design Block

Read [`../../skill-shape.md`](../../skill-shape.md),
[`../../fe/gates/blocks/`](../../fe/gates/blocks/INDEX.md), the accepted layout object, contract
registry and relevant intent modules.
Require a user-declared `Project` or explicit `Frontend` and `Backend` inherited from the orchestrator.
Load the exact workspace-selected grammar/profile and require their hashes to equal the accepted layout receipt.

## CONTEXT

Print canonical `### CONTEXT`, session id, accepted layout/decision hashes, block ids and heads.

## PROCESS

For every requested block, generate its own 3–4 candidates. A whole surface with `N` blocks yields
`N` sets and 3–4 × N candidates. Each candidate states exactly what renders: role, title,
description, reading order, collection/item grammar, fields/order/source, states, actions, copy,
responsive behavior, contract decision, pure/connected ownership and every applicable grammar
decision. Collection kind never substitutes for interaction: a navigation list resolved to
`selection-listbox` must name HeroUI ListBox and its owner; hierarchical disclosure must name the
Accordion owner and all state obligations.

Never combine unrelated choices into page-wide variants. Preserve accepted blocks while unresolved
blocks receive later rounds. Record exact prompt/response, `basedOnHash`, delta, rejection and
acceptance objects; refuse a block whose source layout hash is not approved.

When the project profile reports `extend` or `new-required`, keep that result. Do not hand-roll a
button/caret, nested `map()` or styled container to make the owner appear to exist.

## OUTPUT

Print `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED` and
`### OWED` in order, with one row per block set, candidate hashes, current whitelist and
only the unresolved block choices in `NEED APPROVALS`.
