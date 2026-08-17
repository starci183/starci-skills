---
name: starci-fe-design-execute
description: Implement one fully accepted StarCi frontend design through principles, patterns and lints. Use only when every reachable layout and block hash is whitelisted; never generate design alternatives.
---

# StarCi FE Design Execute

Read [`../../skill-shape.md`](../../skill-shape.md), [`../../fe/gates/`](../../fe/gates/INDEX.md),
[`../../fe/references/state-coverage.md`](../../fe/references/state-coverage.md) and
[`../../fe/references/live-flow-proof.md`](../../fe/references/live-flow-proof.md).
Require a user-declared `Project` or explicit `Frontend` and `Backend` inherited from the orchestrator.

## CONTEXT

Print canonical `### CONTEXT`, current branches, registry commit/manifest, accepted hashes, workflow
and exact production `Touching`. Confirm the production write boundary before the first source edit.

## PROCESS

Verify every accepted object's canonical bytes and decision ref, and prove no reachable unit is
queued. Run Gate 3 Principles, Gate 4 Patterns and Gate 5 Lints as a single exact-input chain. Each
stage emits one result and binds its input/output hash. If accepted JSON does not settle a product
choice, write `returned-to-owner`; do not choose inside execution.

Implement only the resulting source plan. Read the target `CONTRACT.md`/contract registry as LLM
context for every file. Run adopted lint, typecheck, focused tests, rendered state coverage and live
flow proof where applicable. Append `### LIVE FLOW PROOF` and inspect UI, Network, Console and
frontend/backend terminal evidence in the same time window. Record the production diff and
registry/workflow receipt.

## OUTPUT

Print `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED` and
`### OWED` in order. `CHANGES` names every production path; `WARNINGS` separates unrelated
dirty-tree failures; `OWED` names any proof not completed. Execution is complete only with a Gate 5
pass and connected hashes from accepted design through production proof.
