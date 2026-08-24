# Execute state

1. Run `validate-input.mjs <input.json>`, validate the page-model identity, and read every product Block with its evidence references.
2. Enumerate the states needed to render, operate and recover each Block: initial, loading, available, empty, invalid, submitting, success, failure, unavailable and any evidenced business-specific state.
3. Keep only states relevant to the Block. Do not manufacture a universal matrix when a state cannot occur.
4. For each state, record domain meaning, trigger, available actions, transitions and provenance.
5. Derive a neutral presentation state from the domain meaning. Product Blocks own this mapping; Grammar owns only the later neutral visual treatment.
6. Audit missing truth across money, access, entitlement, data loss, legal consequence and terminal outcome.
7. Record every missing fact as unknown. If it touches a sensitive category, mark it blocking, emit `state.result / blocked`, and stop before layout.
8. Run `validate-output.mjs <output.json>` for either result. If no blocking unknown remains, hash and persist the state model and emit `layout.generate / ready` with `state-model-ready` and `neutral-facts-ready` only after validation passes.

Never infer a sensitive success, permission, price, entitlement or destructive outcome from component shape, copy tone or common product convention.

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@state-modeling` | `fe.state-modeling` | qdrant | bind domain state provenance, sensitive unknowns and neutral presentation mapping |
