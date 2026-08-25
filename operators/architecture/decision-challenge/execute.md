# Execute `architecture/decision-challenge`

This operator challenges the architecture option set. Input, output, context bindings, analysis evidence, worker observations, and receipts remain in task-session memory and are purged at every parent-skill terminal.

## Step 1 — Validate and freeze input

**Read:** the complete input envelope only.
**Context:** none; resolve no binding before validation succeeds.
**Action:** run `validate-input.mjs` and freeze the route, provided refs, load declarations, and session slots.
**Session write:** `payload.session.inputRef`.
**Stop:** stop before loading context if the schema, accepted route, facts, or session ownership fails.

## Step 2 — Resolve exact bindings

**Read:** `payload.loads.artifacts`, `payload.loads.knowledge`.
**Context:** resolve exact task-session artifacts and retrieve only `architecture.decision-analysis` from its pinned Qdrant generation.
**Analysis:** verify identity, revision, freshness, and ownership. Record applied rule IDs and match/mismatch evidence, never hidden reasoning.
**Session write:** `payload.session.scratchPrefix/bindings`.
**Stop:** stop when a binding is missing, stale, ambiguous, or outside the accepted route.

## Step 3 — Perform the operator decision

**Read:** validated bindings, and accepted machine facts.
**Context:** use no undeclared knowledge, business feature, artifact, or source file.
**Decision criteria:** coupling, cost, migration risk, reversibility, constraints, deployable ownership, data ownership, cross-process consistency, operability, failure isolation, security boundaries and organizational ownership are resolved.
**Analysis:** treat the current architecture, the user's preferred option and the most elegant diagram as hypotheses to attack. The operator is loyal to system outcomes and evidence, not to agreement. Test each option against the explicit frame, including the recommended option first and most aggressively. In a monorepo, reject any option whose flow is described only by logical subsystem names: every affected ingress, execution, persistence, side effect and reconciliation hop must name its deployable owner and transport direction. Record evidence, criteria, and conclusions only; never record chain-of-thought.
**Session write:** candidate `challengeReceiptRef` at `payload.session.scratchPrefix/candidate`.
**Orchestration:** freeze the option set and provisional recommendation before critique. Economical mode performs a second, explicitly adversarial pass. Balanced or parallel mode delegates at least one blind read-only critic that receives the frame, current state and options but not the author's rationale or recommendation. The coordinator owns joining and the decision; majority agreement, user preference and implementation familiarity carry no evidentiary weight.
**Stop:** emit only a declared decision when evidence is missing, contradictory, or outside scope.

The adversarial pass must attempt to falsify every option and emit the structured `challengeSummary`. It must:

- enumerate hidden assumptions about scale, ordering, availability, trust, ownership, latency, cost and operator behavior;
- construct counterexamples for retries, duplicate delivery, concurrency, stale reads, partial commits, dependency outage, recovery, migration and rollback;
- run a pre-mortem from the perspective of on-call, security, data ownership, finance and the team that must evolve the system six months later;
- identify at least one operational surprise that would look green in a happy-path test while failing in production;
- state which evidence or experiment would falsify the recommendation;
- reject accidental complexity, future-proofing without a measured pressure, disguised distributed transactions, duplicated authority and boundaries drawn around code rather than ownership;
- prefer a simpler or narrower alternative when it satisfies the same constraints, regardless of which option the requester proposed;
- change or reject the provisional recommendation when the critique wins.

`ready` is allowed only when every non-recommended option has an evidence-linked rejection and no critical challenge remains unresolved. Use `revise` when the option set or recommendation must change. Use `blocked` when the missing fact cannot be resolved inside the declared boundary. Never invent objections merely to populate the structure: every ID must resolve inside the challenge receipt.

For a `ready` decision, also build one accessible interactive HTML review of every challenged option. The recommended option must be useful on first render without hiding the strongest case against it. The review must show each deployable process, owned store, ingress, side-effect boundary and directional cross-process data flow, plus normal, retry, concurrency, dependency-outage, recovery, migration and rollback consequences. Put the disconfirming evidence, operational surprises, irreversible commitments and reason each losing option was rejected beside the recommendation. Visually distinguish desired-state/control edges from runtime execution and evidence/reporting edges. It must display the exact `OK ARCHITECTURE <decision>@<option-set-hash>` command for the active option. Bind it through `payload.reviewPreview`; prose, ASCII art or a static code block cannot satisfy this requirement.

## Step 4 — Validate the candidate

**Read:** candidate artifact, decision evidence, and exact context lineage.
**Context:** no new load is allowed.
**Analysis:** prove the candidate is closed, traceable, route-compatible, free of copied context or reasoning transcripts, and has survived the falsification-first pass. Confirm that `challengeSummary.verdict` matches the decision, every challenge ID resolves inside the challenge receipt, every losing rendered option is explicitly rejected, and a ready result contains no unresolved critical challenge.
**Session write:** accepted artifact at `payload.session.scratchPrefix/challengeReceiptRef`, HTML review at the bound `payload.reviewPreview.artifactRef`, and evidence under `scratchPrefix/evidence`.
**Stop:** do not invent evidence, broaden scope, omit a challenged option or ask for approval when the preview cannot be rendered.

## Step 5 — Emit and register cleanup

**Read:** accepted candidate, decision, evidence refs, lineage, and any durable-effect refs.
**Context:** return refs and revisions only, not loaded content or worker prompts.
**Action:** construct `output.schema.json`, align `payload.decision`, `payload.state`, root route, and emitted facts, then run `validate-output.mjs`. For `ready`, render `payload.reviewPreview.artifactRef` through the host `visualize` capability in the same review response; only after that render may the parent enter the architecture-selection wait.
**Session write:** `payload.session.outputRef`; list every scratch ref in `payload.cleanup.scratchRefs`.
**Stop:** do not emit an invalid or partially joined result.
**Orchestration:** coordinator validates the final output and purges all intermediate session objects when the parent skill terminates.
