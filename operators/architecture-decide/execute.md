# Execute `architecture.decide`

## Single job

Turn one bounded objective into one decided architecture: its boundaries, its data ownership, and its
tech stack, proved against the observed current state, at least one rejected alternative, verified
compatibility, and an independent critique. This is one linear operator invocation. It does not call
another operator, route a workflow, pause internally, or return a free-form control instruction.

The twenty v7 stages — bounding the scope, discovering source and evidence, capturing current state,
binding patterns, modelling the system, planning and challenging boundaries, modelling data ownership,
analysing contradictions, framing the decision, generating alternatives, challenging the selection,
critiquing it independently, realizing the design, checking conformance, packaging the handoff, and
the four tech-stack stages that discover, model, check, and publish the stack — are steps inside the
sequence below, not separate operators.

## Observe before proposing

Nothing may be proposed before the current state has been observed at the frozen source head, and the
observation is carried in the receipt with its own fingerprint.

This ordering is not politeness toward the existing system. A proposal written before the observation
inevitably describes a system that is simpler than the real one, and every later comparison inherits
that simplification. An observation taken at a different head is worse, because it looks rigorous
while describing code that no longer exists.

## Prove, do not assume

Four prohibitions carry the decision, and each is enforced rather than advised:

1. **An alternative is real or it is not counted.** At least one alternative is genuinely rejected,
   with a stated reason, and every alternative is assessed on exactly the axes the objective named.
   Two options scored on different criteria have not been compared.
2. **Incumbency is not a justification.** A component may be justified by a measured constraint, by
   observed evidence, or by fit to a requirement. Never by already being there.
3. **Compatibility is checked, not asserted.** Every retained component carries a verified verdict
   with evidence, across runtime version, deployable unit, communication failure, datastore
   ownership, and backup and restore. A verdict that skipped an axis is a partial check wearing a
   complete label.
4. **Every boundary answers the data question.** A boundary either owns at least one store or states
   that it owns none. A store names one owning boundary, and that boundary writes it; a second writer
   exists only with an explicit justification.

## Execution sequence

1. **Validate input and resume.** Apply `input.schema.json` and semantic validation. Reject a stale
   source binding, an unevidenced inventory component, missing fixed intent or measurable constraints,
   an automatic policy carrying an approval, and unchanged progress.
2. **Observe the current state.** Read the routed source at the frozen head and record the boundaries
   that exist today, each with its responsibility and the evidence behind it. Failure to observe is
   `CURRENT_STATE_UNOBSERVED`; the invocation does not proceed on memory.
3. **Bind the observed inventory.** Take the runtimes, frameworks, persistence, communication, build,
   deployment, and operational ownership as facts about today, and as nothing more.
4. **Frame the decision.** Restate the objective as a cross-boundary trade-off on the named axes, with
   the separated constraints attached. A contradiction between two fixed constraints stops the
   invocation with `CONSTRAINT_CONTRADICTION` rather than being averaged away.
5. **Generate alternatives.** Produce two to four materially different alternatives — different in
   ownership or mechanism, not in wording — and assess each on every named axis. Render them as one
   inspectable HTML comparison exposing boundaries, ownership, data and control flow, normal
   operation, and the applicable adverse paths.
6. **Model boundaries and data ownership.** State each boundary's responsibility, owner, interfaces,
   and whether it owns data. For each store, name the owning boundary, its writers, readers,
   migrators, transaction scope, backup, and restore. An unowned store is `DATA_OWNERSHIP_UNASSIGNED`.
7. **Model and check the stack.** Mark each component existing, added, replaced, or removed; state its
   role and the kind of justification behind it; and verify compatibility across all five axes. An
   unverified retained component is `COMPATIBILITY_UNVERIFIED`.
8. **Critique independently.** A reviewer other than the deciding author attacks the *selected*
   alternative under partial failure, retry and idempotency, concurrency, stale state, deletion,
   recovery, dependency outage, and rollback. Each attack carries a resolution, or the invocation
   stops with `CRITIQUE_UNRESOLVED`. Attacking only the rejected options restates the decision.
9. **Select.** Under `approval-required`, bind exactly the alternative the owner approved; with no
   approval bound, stop with `APPROVAL_REQUIRED`. Under `automatic`, bind the surviving alternative.
   When several alternatives remain material, stop with `ALTERNATIVE_CHOICE_REQUIRED` and return the
   candidates rather than picking one.
10. **Freeze the handoff.** Record the invariants, risks, affected contracts, migration steps and
    rollback, proof expectations, and unknowns. The handoff names contracts, never implementation
    files: choosing the files is the next domain's job, and naming them here quietly takes it.
11. **Emit and stop.** Write the artifacts under `input.project.artifactRootRef`, return one output
    conforming to `output.schema.json`, and bind every fingerprint. Do not claim implementation,
    quality, or UAT proof.

## Resume execution

A resume begins again at validation, reuses only unchanged fingerprinted observations, and consumes
the exact delta. A resume that adds no evidence, constraint, inventory, or approval change returns
`NO_PROGRESS`. A re-observed system must arrive as a new fingerprint; the same fingerprint cannot
yield a different answer.

## Mandatory attacks

The operator cannot decide while any applicable item remains unresolved:

- the current state was never observed, or was observed at another head;
- no alternative was genuinely rejected, or the alternatives were scored on different criteria;
- a component is justified by incumbency, or claims compatibility no evidence checked;
- a boundary leaves the data question unanswered, or a store has an owner that never writes it;
- a second writer exists with no justification;
- the selected architecture was never attacked under one of the eight adverse paths;
- the critique was authored by the deciding role;
- the handoff names implementation files;
- an error finding is still open.
