# Execute `quality/rule-binding-check`

This operator checks law-to-gate-to-machine bindings. Input, output, loaded context, command captures, diagnostics, observations, and receipts remain session-only and are purged at every parent-skill terminal.

## Step 1 — Validate and freeze input

**Read:** the complete input envelope only.
**Context:** none; resolve no binding before validation succeeds.
**Action:** run `validate-input.mjs` and freeze route, provided refs, load declarations, and session slots.
**Session write:** `payload.session.inputRef`.
**Stop:** stop before loading context if schema, route, facts, or task ownership fails.

## Step 2 — Validate registry authority

**Read:** `payload.loads.artifacts`, `payload.loads.knowledge`.
**Context:** rule registry, gate catalog, and published-machine identities plus revisions only. Do not retrieve knowledge yet.
**Analysis:** deterministically verify schema, hashes, shared release identity, freshness, and complete registry readability.
**Session write:** `payload.session.scratchPrefix/bindings`.
**Stop:** stale, unreadable, or foreign-release registries block the audit; they are not failed rule bindings.

## Step 3 — Evaluate the result

**Read:** validated bindings, and accepted machine facts.
**Context:** retrieve `quality.readiness-repair` only if deterministic comparison produces a mismatch needing classification. Load no source or business feature.
**Decision criteria:** each published rule has one governing law, gate situation, machine identity, and executable proof.
**Analysis:** prove for every rule exactly one accountable executable binding and classify missing, duplicate, orphaned, shadowed, and revision-mismatched bindings with exact rule/gate/machine refs. Record conclusions only; never record chain-of-thought.
**Session write:** candidate `ruleBindingReceiptRef` at `scratchPrefix/candidate`.
**Orchestration:** economical mode is sequential. Balanced/parallel modes may classify independent evidence items read-only; the coordinator owns route classification and join.
**Stop:** `fail` requires fresh complete authority and at least one measured binding defect. Emit `blocked` for stale or unavailable authority.

## Step 4 — Emit and register cleanup

**Read:** candidate, decision evidence, lineage.
**Context:** return refs and revisions only, not loaded content, full command logs, prompts, or observations.
**Action:** construct `output.schema.json`; align decision, state, root route, and emitted facts; run `validate-output.mjs`.
**Session write:** `payload.session.outputRef`; list all scratch refs in `payload.cleanup.scratchRefs`.
**Stop:** do not emit an invalid or partially joined output.
**Orchestration:** coordinator validates output and purges all intermediate session objects at the parent terminal.
