# Execute implementation

1. Run `node validate-input.mjs <input.json>`. Continue only when the fail-closed validator confirms one accepted route, the closed payload and its cross-field semantics.
2. Verify the approved layout hash, exact source boundary, resolved effective contracts and request receipts. Stop on a Grammar gap.
3. Build an allowlist from `exactSourceBoundary`. Every planned and actual write must be inside it.
4. Start with Product Blocks. Compose package-owned leaves, branches and composites from `@starci/ui/common` and the one routed `@starci/grammar/<id>` package.
5. Apply a lower-tier extension only when its exact path, extension axis, effective contract and request receipt are all declared. Do not modify closed invariants.
6. Implement all evidenced states and responsive transformations without changing the approved direction. Business state remains owned by Product Blocks and is mapped to neutral presentation state before Grammar treatment.
7. Keep `global.css` limited to approved color-token values. Reject structural utility, component anatomy or business selectors there.
8. Run formatting, type and focused static checks appropriate to the changed boundary. Record commands and receipts; do not suppress a failure.
9. Compare actual changes to the allowlist and declared tier policy.
10. Build the complete change set for Product Seed. On a stop condition, build a blocked result with precise evidence and no false ready result.
11. Run `node validate-output.mjs <output.json>` before either result is emitted.

An in-boundary repair repeats these steps only for cited proof failures. A change that would alter the approved page structure, journey ownership or source boundary is boundary drift and must return to layout approval through Product Proof.

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@implementation-boundaries` | `fe.implementation-boundaries` | qdrant | enforce Block-upward ownership, exact package reuse and repair boundaries |
