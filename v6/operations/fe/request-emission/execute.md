# Execute request emission

1. Run `node validate-input.mjs <input.json>`. Continue only when the fail-closed validator confirms the schema shape, route guard and cross-field semantics.
2. Recompute each destination from `stableId`. Refuse absolute paths, traversal, nested paths and destinations outside `.claude/requests`.
3. Normalize each request to the obligation, approved decision, evidence references, intended owner, source boundary and requested resolution. Do not add implementation guesses.
4. Detect collisions before writing. Identical existing content is idempotent; differing content at the same stable path is a stop condition.
5. Write all request files atomically enough that a partial set is never reported as complete.
6. Hash the persisted bytes and construct the output receipt.
7. If any obligation is `grammar-gap`, return blocked after persistence. Do not invoke implementation and do not create a local substitute.
8. Run `node validate-output.mjs <output.json>` before emission. Otherwise return ready for implementation. This operation performs no product-source write.

The operation stops on invalid evidence, unstable IDs, path escape, collision, source-boundary mismatch or incomplete persistence.

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@request-lifecycle` | `fe.request-lifecycle` | qdrant | persist stable create and Grammar-gap obligations before source writes |
