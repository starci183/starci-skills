# Session metadata admission — 2026-09-06

Two independent confirmed missions could not open their first attempt:

- The business writer retained an authorizing statement and impact excerpt of 8,015 characters each. The state schema allowed 1,000.
- Its coordinator retained a done-when evidence description of 251 characters. The state schema allowed 200.

`session-open` had checked semantic scope authority without validating the complete candidate state before retaining immutable mission history. A later `validate-session` rejected those same states. Both confirmations and their original sources were present; this was not absent user authorization.

The user explicitly authorized widening the limits. The existing state schema now allows 8,192 characters for authority statements and coverage excerpts, and 2,000 for done-when evidence. The shared schema hygiene limit and approval, scope-hash, frozen-history and attempt ownership checks remain intact.

`session-open` now validates candidate state before persisting a new session, discovered scope, topology mutation, confirmation or rejection. Reusing a session without changing topology also checks its complete state. A corrected candidate and its prior confirmed state are validated before retaining the prior mission. Existing state and immutable snapshots are left unchanged when admission fails. No new correction choice, session identity or replacement of retained approval is needed to admit the original two records under the corrected schema.

## Verification

- `session-metadata.spec.mjs` exercises the observed lengths, exact schema boundaries, byte preservation, refusal before history creation, invalid opening, discovery and correction rollback, reuse, topology changes, rejection and invalid prior metadata.
- `session-correction.spec.mjs` retains its historical-wait checks; its synthetic attempt now includes the schema-required bookkeeping fields.
- The isolated implementation's targeted metadata, correction, session, workflow topology, workflow ownership and shared-schema run passed all 50 tests.
- The coordinator reported both original live sessions returned `session valid` after the original shared-tree schema change without modifying their confirmed mission records. The writer snapshot still hashed to its original content address.
- The coordinator's original shared-tree full `npm test` exited 0: routing/resources/knowledge/alias/operator/helper/template checks, operator self-tests and generated documentation checks passed. That script suite reported 436 tests: 435 passed, one skipped, zero failed. Its retained log is `C:/Users/Cuong/Documents/Codex/2026-09-05/p/outputs/starci-session-metadata-tests.log`. This prior run is evidence for the metadata incident, not a substitute for validating the complete isolated release.

These observations verify metadata admission and preservation. They do not assert that a business operator, portfolio verification, product UAT or publication has completed.
