# Execute Product Proof

1. Run `node validate-input.mjs <input.json>`. Continue only when the fail-closed validator confirms `proof.run / ready` plus seed, unit, E2E and UI evidence facts.
2. Reconcile the actual change set with the exact approved source boundary. Refuse unreported or out-of-bound changes.
3. Verify that every required business state has deterministic seed evidence and a matching E2E/UI scenario.
4. Reconcile unit evidence with every required focused gate. Refuse zero-test, skipped-target or suppressed-failure receipts.
5. Reconcile E2E evidence with every connected journey transition and cleanup obligation.
6. Reconcile UI evidence with real-browser, test-account, ordinary-user interaction, wide/intermediate/compact, accessibility, trace and screenshot obligations. Do not rerun or substitute browser proof here.
7. Check journey continuity, the single global journey-progress owner, per-page references, block purpose, hierarchy, nested-surface legibility, state treatment, responsive persistence and interaction outcomes against the approved direction.
8. Classify every failure before routing:
   - `in-boundary-repair` when source can be corrected without changing approved structure, ownership, responsive transformation or file boundary;
   - `boundary-drift` when correction changes any of those bindings;
   - `blocked` when the environment, evidence or safety boundary prevents judgment.
9. Emit complete only when all four evidence layers—seed, unit, E2E and UI—are complete and mutually bound by hashes. Partial proof is failure, not success.
10. Build the route: in-boundary repair returns to Implementation with exact failed check IDs; boundary drift returns to the existing layout approval checkpoint. Never create a third approval checkpoint.
11. Run `node validate-output.mjs <output.json>` before the verdict is emitted.

Product Proof writes proof artifacts only. It does not patch source, change seed truth, approve its own direction or publish externally.

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@product-proof` | `fe.product-proof` | qdrant | prove the connected journey and classify in-boundary repair, boundary drift or blocker |
