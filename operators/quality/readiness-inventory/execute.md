# Execute `quality/readiness-inventory`

This operator inventories source readiness. Input, output, loaded context, command captures, diagnostics, observations, and receipts remain session-only and are purged at every parent-skill terminal.

## Step 1 — Validate and freeze input

**Read:** the complete input envelope only.
**Context:** none; resolve no binding before validation succeeds.
**Action:** run `validate-input.mjs` and freeze route, provided refs, load declarations, and session slots.
**Session write:** `payload.session.inputRef`.
**Stop:** stop before loading context if schema, route, facts, or task ownership fails.

## Step 2 — Run deterministic inventory checks

**Read:** route, declared-gate, and stale-registry artifacts plus their revision headers.
**Context:** registry entries, route IDs, gate IDs, owner IDs, receipt revisions, expiry, and evidence hashes only. Do not retrieve knowledge, source, or command logs.
**Analysis:** verify registry integrity and freshness first; then check route coverage, exactly one owner per gate, required receipt presence, revision match, expiry, and independent evidence identity.
**Session write:** `payload.session.scratchPrefix/bindings`.
**Stop:** stale, unreadable, foreign-revision, or incomplete authority prevents a verdict and must route blocked/inconclusive; it is not a repairable product finding.

## Step 3 — Evaluate the result

**Read:** validated bindings, and accepted machine facts.
**Context:** retrieve `quality.readiness-repair` only when deterministic checks produced measured candidates requiring ownership classification. Load no source, business body, command log, or unrelated quality record.
**Decision criteria:** routes, gates, and stale records resolve to a complete green result or owned findings.
**Analysis:** classify every measured candidate as product-owned finding or non-verdict blocker, deduplicate by stable finding fingerprint, and preserve gate/owner/evidence lineage. Green requires zero findings and zero blockers. Record conclusions only; never record chain-of-thought.
**Session write:** candidate `inventoryReceiptRef` at `scratchPrefix/candidate`.
**Orchestration:** economical mode is sequential. Balanced/parallel modes may classify independent evidence items read-only; the coordinator owns route classification and join.
**Stop:** emit findings only when each has an exact owner, boundary and proving gate. Emit `blocked` for stale or unavailable authority; never disguise it as a finding or green result.

## Step 4 — Emit and register cleanup

**Read:** candidate, decision evidence, lineage.
**Context:** return refs and revisions only, not loaded content, full command logs, prompts, or observations.
**Action:** construct `output.schema.json`; align decision, state, root route, and emitted facts; run `validate-output.mjs`.
**Session write:** `payload.session.outputRef`; list all scratch refs in `payload.cleanup.scratchRefs`.
**Stop:** do not emit an invalid or partially joined output.
**Orchestration:** coordinator validates output and purges all intermediate session objects at the parent terminal.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@provided-artifacts` | `payload.loads.artifacts` | session | resolve only previous-state refs |
| `@knowledge-1` | `quality.readiness-repair` | qdrant | retrieve only to classify measured candidates after deterministic inventory |
| `@orchestration-profile` | `payload.loads.orchestration` | orchestration | select strategy independently of provider/model |

No repository source-context load exists for this operator.
