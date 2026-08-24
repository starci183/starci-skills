# Execute Product Seed

1. Run `node validate-input.mjs <input.json>`. Continue only when the fail-closed validator confirms `seed.materialize / ready`, `source-written` and the closed state contract.
2. Compare required state IDs with the state contract. Refuse duplicate, unowned or unevidenced states.
3. Classify provenance. A business state must point to routed business evidence; a derived-block state must point to its owning Product Block rule.
4. Stop when a sensitive state lacks exact evidence or a safe materialization mechanism. Never infer money, access, entitlement, loss, legal or terminal truth.
5. Prepare isolated deterministic fixtures and controls. Prefer stable seed scripts, mocked service boundaries, test accounts and explicit clock controls over manual mutation.
6. Materialize every state and verify it through an observable route or locator. Record setup and reset operations.
7. Reset and repeat enough to prove determinism. Do not touch production credentials or data.
8. Build `proof.run / ready` only when every required state has a complete receipt. Otherwise build blocked with the uncovered state IDs.
9. Run `node validate-output.mjs <output.json>` before either result is emitted.

Product Seed may create test fixtures or invoke declared seed mechanisms. It may not change UI direction, component anatomy, Grammar, product rules or the approved source boundary.

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@product-seeding` | `fe.product-seeding` | qdrant | materialize evidenced business states safely and reproducibly for proof |
