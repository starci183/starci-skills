# Execute `architecture.decide`

## Single job

Turn one bounded objective into one decided architecture: its boundaries, its data ownership, and its
tech stack, proved against the observed current state, at least one rejected alternative, verified
compatibility, and an independent critique. This is one linear operator invocation. It does not call
another operator, route a workflow, pause internally, or return a free-form control instruction.

The twenty v7 stages — bounding the scope, discovering source and evidence, capturing current state,
binding patterns, modelling the system, planning and challenging boundaries, modelling data ownership,
analysing contradictions, framing the decision, generating alternatives, selecting one, challenging
and critiquing that selection, realizing the design, checking conformance, packaging the handoff, and
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

## Sequence

| # | Step | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- |
| 1 | Validate input and resume | input, `@receipt/architecture-decision/<invocationId>`, `@workspaces/be` (the frozen head binding) | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Observe the current state | `@workspaces/be` (observed at the frozen head) | `@artifacts/current-state.json` | `CURRENT_STATE_UNOBSERVED` |
| 3 | Bind the observed inventory and the business authority | `@artifacts/current-state.json` (inventory components and their evidence), `@worktrees/businesses/<featureId>` (the published head) | — | `BUSINESS_AUTHORITY_REQUIRED`, `EVIDENCE_MISSING` |
| 4 | Frame the decision | input (objective, trade-off axes, separated constraints) | — | `CONSTRAINT_CONTRADICTION` |
| 5 | Generate alternatives | `@artifacts/current-state.json`, `@knowledge/patterns` | `@artifacts/<decisionId>-alternatives.html` | `NO_VIABLE_ALTERNATIVE` |
| 6 | Select provisionally | `@artifacts/<decisionId>-alternatives.html`, input (selection policy, owner approval) | — | `CHOICE_REQUIRED` |
| 7 | Deepen the selected alternative | `@artifacts/<decisionId>-alternatives.html`, `@artifacts/current-state.json` (inventory), input (constraints) | `@artifacts/stack-model.json` | `DATA_OWNERSHIP_UNASSIGNED`, `COMPATIBILITY_UNVERIFIED` |
| 8 | Critique the selected alternative | `@artifacts/stack-model.json` (the deepened design and its claims) | `@artifacts/independent-critique.json` | `CRITIQUE_UNRESOLVED` |
| 9 | Confirm the selection | `@artifacts/independent-critique.json`, `@artifacts/stack-model.json` | — | — |
| 10 | Freeze the handoff | `@artifacts/stack-model.json` (the confirmed decision) | — | — |
| 11 | Emit and stop | everything above | `@artifacts/architecture-decision.json` | — |

Validation rejects a stale source binding, an unevidenced inventory component, missing fixed intent or
measurable constraints, an automatic policy carrying an approval, and unchanged progress. Nothing is
proposed on memory: the observation is read at the frozen head, and the inventory is taken as facts
about today and as nothing more. A contradiction between two fixed constraints stops the invocation
rather than being averaged away.

Alternatives are two to four materially different designs — different in ownership or mechanism, not
in wording — each carrying its own boundary and store-ownership sketch, each assessed on every named
axis, and all of them rendered as one inspectable HTML comparison exposing boundaries, ownership,
data and control flow, normal operation, and the applicable adverse paths. Selection is provisional
and cheap: under `approval-required` it binds exactly the alternative the owner approved, under
`automatic` it binds the sole survivor, and when several alternatives remain material it returns the
candidates rather than picking one. Only the selected alternative is deepened, because deepening all
of them is how a comparison turns into four designs nobody chose.

Deepening states each boundary's responsibility, owner, interfaces, and whether it owns data; for
each store it names the owning boundary, its writers, readers, migrators, transaction scope, backup,
and restore; and it marks each stack component existing, added, replaced, or removed, states the kind
of justification behind it, and verifies compatibility across all five axes.

The critique attacks the *selected* alternative under partial failure, retry and idempotency,
concurrency, stale state, deletion, recovery, dependency outage, and rollback; attacking only the
rejected options restates the decision. It is a fresh execution on this operator's own profile with
no inherited turns, given only the artifacts and the claims they make, never the author's rationale.
Each attack carries a resolution, and confirmation either keeps the provisional selection or returns
the choice to the owner. The handoff records the invariants, risks, affected contracts, migration
steps and rollback, proof expectations, and unknowns; it names contracts, never implementation files,
because choosing the files is the next domain's job and naming them here quietly takes it. Emission
writes the artifacts under `input.project.artifactRootRef`, returns one output conforming to
`output.schema.json`, binds every fingerprint, and claims no implementation, quality, or UAT proof.

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
- the critique received the author's rationale or inherited turns;
- the handoff names implementation files;
- an error finding is still open.
