# Execute `business/model`

This operator builds a closed business model. Input, output, context bindings, analysis evidence, worker observations, and receipts remain in task-session memory and are purged at every parent-skill terminal.

## Step 1 — Validate and freeze input

**Read:** the complete input envelope only.
**Context:** none; resolve no binding before validation succeeds.
**Action:** run `validate-input.mjs` and freeze the route, provided refs, load declarations, and session slots.
**Session write:** `payload.session.inputRef`.
**Stop:** stop before loading context if the schema, accepted route, facts, or session ownership fails.

## Step 2 — Resolve exact bindings

**Read:** `payload.loads.artifacts`, `payload.loads.knowledge`, and `payload.loads.business`.
**Context:** resolve exact task-session artifacts and retrieve only `business.authority-lifecycle` from its pinned Qdrant generation. Load only the declared business revision under `.worktrees/<project>/businesses/`.
**Analysis:** verify identity, revision, freshness, and ownership. Record applied rule IDs and match/mismatch evidence, never hidden reasoning.
**Session write:** `payload.session.scratchPrefix/bindings`.
**Stop:** stop when a binding is missing, stale, ambiguous, or outside the accepted route.

## Step 3 — Perform the operator decision

**Read:** validated bindings, and accepted machine facts.
**Context:** use no undeclared knowledge, business feature, artifact, or source file.
**Decision criteria:** actors, journeys, rules, states, operations, acceptance evidence, incentives, value exchange, loss allocation and lifecycle transitions remain traceable and mutually consistent.
**Analysis:** transform evidence into a feature model without inferring behavior from product source. Treat the user's preferred solution, current head, stakeholder confidence and repeated assertions as hypotheses rather than truth. Loyalty belongs to the evidenced outcome, not to consensus or the requester. Separate facts, assumptions, preferences and commitments; expose who benefits, who pays, who can abuse the rule, and which actor is missing from the happy-path framing. Record evidence, criteria, and conclusions only; never record chain-of-thought.
**Session write:** candidate `businessModelRef` at `payload.session.scratchPrefix/candidate`.
**Orchestration:** freeze the candidate before critique. Economical mode performs a second, explicitly adversarial pass. Balanced or parallel mode delegates a blind read-only critic that receives the evidence and frozen candidate but not the author's recommendation or rationale. The coordinator owns joining and the decision; popularity and agreement are not evidence.
**Stop:** emit only a declared decision when evidence is missing, contradictory, or outside scope.

The adversarial pass must attempt to falsify the candidate, not polish it. It must produce the structured `challengeSummary` and:

- identify material hidden assumptions and the evidence that would disprove each one;
- construct concrete counterexamples involving misuse, partial completion, refunds or reversals, delayed dependencies, concurrent actors and state recovery where applicable;
- compare at least one credible alternative, including doing nothing or narrowing scope when either is viable;
- run a pre-mortem across customer value, incentives, operational burden, support burden, compliance or trust, unit economics and irreversible commitments;
- surface conflicts between stakeholder goals instead of averaging them away;
- distinguish a real business requirement from a requested implementation or inherited behavior;
- change or reject the recommendation when the evidence warrants it, even when that contradicts the requester.

`ready` is allowed only when no critical challenge remains unresolved. Use `revise` when the model can be corrected within the frozen evidence and boundary. Use `blocked` when authority, evidence or stakeholder resolution is required. Never manufacture objections merely to fill the structure: every ID must bind to evidence in the challenge artifact.

## Step 4 — Validate the candidate

**Read:** candidate artifact, decision evidence, and exact context lineage.
**Context:** no new load is allowed.
**Analysis:** prove the candidate is closed, traceable, route-compatible, free of copied context or reasoning transcripts, and has survived the falsification-first pass. Confirm that `challengeSummary.verdict` matches the decision, every challenge ID resolves inside the challenge artifact, and a ready result contains no unresolved critical challenge.
**Session write:** accepted artifact at `payload.session.scratchPrefix/businessModelRef` and evidence under `scratchPrefix/evidence`.
**Stop:** do not invent evidence or broaden scope.

## Step 5 — Emit and register cleanup

**Read:** accepted candidate, decision, evidence refs, lineage, and any durable-effect refs.
**Context:** return refs and revisions only, not loaded content or worker prompts.
**Action:** construct `output.schema.json`, align `payload.decision`, `payload.state`, root route, and emitted facts, then run `validate-output.mjs`.
**Session write:** `payload.session.outputRef`; list every scratch ref in `payload.cleanup.scratchRefs`.
**Stop:** do not emit an invalid or partially joined result.
**Orchestration:** coordinator validates the final output and purges all intermediate session objects when the parent skill terminates.
