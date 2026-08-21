---
name: starci-fe-design-layout
description: Generate and iterate three to four complete layout JSON candidates independently for every requested or discovered StarCi surface. Use only inside starci-fe-design-plan before block design.
---

# StarCi FE Design Layout

Read [`../../skill-shape.md`](../../skill-shape.md),
[`../../fe/gates/layouts/`](../../fe/gates/layouts/INDEX.md), its schema, contract registry and
relevant [`../../fe/intent/`](../../fe/intent/INDEX.md) modules.
Require a user-declared `Project` or explicit `Frontend` and `Backend` inherited from the orchestrator.
Read the exact workspace-selected grammar/profile and the orchestrator's deterministic receipt before making
any candidate.

## CONTEXT

Print canonical `### CONTEXT`, session id, target surface ids, base hashes and registry heads.

## PROCESS

For each input page, layout, modal, drawer or overlay, classify closed `grammarFacts`, run the
selected grammar and freeze its decisions before divergence. Generate an independent set of 3–4 JSON
candidates only inside the remaining legal space. Every candidate explains `business`, detailed
`main` CSS/distribution/block inventory, `extends` and the exact grammar decisions each block obeys.
A dependent modal/drawer discovered by an accepted parent becomes a full target with its own facts
and candidate set. Never recommend or auto-select a candidate.

Reject a candidate that omits an obligation, changes a resolved primitive/owner, or hides an absent
owner behind local JSX. If the owner mapping says `extend` or `new-required`, preserve that decision
in the block brief so Gate Block cannot downgrade it to `reuse`.

Persist exact prompt, response and candidates as immutable objects. On feedback, require the current
`basedOnHash` and append a new round. On founder acceptance, bind candidate and decision hashes in
the approved ref, queue dependencies and rebuild graph maps. On rejection, preserve structured and
human reasons. Refuse stale-head writes.

## OUTPUT

Print `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED` and
`### OWED` in order. `OUTPUTS` lists candidate sets and hashes; `NEED APPROVALS` asks only
which candidate to accept or what to alter; `REJECTED` preserves exact refused candidates/reasons.
