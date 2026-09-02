# Output of `architecture.decide`

The operator returns one closed envelope with `outcome` equal to `decided` or `blocked`. It never
emits a handoff object or a free-form routing instruction.

## Decided receipt

A decided receipt contains:

- exact project, source, artifact root, decision, objective, trade-off axis, selection policy,
  business, inventory, constraint, current-state, input, and progress bindings;
- the observed current state, its fingerprint, the head it was observed at, and the boundaries that
  exist today;
- two to four alternatives, one selected and at least one rejected with a reason, each assessed on
  every named axis, plus the rendered comparison artifact;
- the target boundaries with their responsibilities, owners, interfaces, and data answer;
- the data-ownership model: one row per store with its owning boundary, writers, readers, migrators,
  transaction scope, backup, and restore;
- the stack model: one row per component with its status, justification kind, evidence, and verified
  compatibility across all five axes;
- the independent critique, its reviewer, and one attack per adverse path against the selected
  alternative;
- the frozen handoff: invariants, risks, affected contracts, migration and rollback, proof
  expectations, and unknowns.

The receipt authorises backend and platform work to begin against a frozen decision. It does not prove
that anything was built, and it carries no verdict on an implementation.

## Alternatives

An alternative is counted only when it is materially different — different in ownership or mechanism,
not in wording — and only when it is assessed on exactly the axes the objective named.

Exactly one alternative is `selected`; at least one is `rejected` and states why. A rejection with no
reason records a preference. A comparison where one option was scored on fewer axes than another
proves nothing, and is refused.

## Data ownership

Each boundary declares whether it owns data. A boundary that claims data owns at least one store; a
boundary that claims none owns exactly zero.

Each store names one owning boundary, and that boundary must be among its writers. A second writer is
permitted, but only with an explicit shared-write justification, because an unjustified shared write is
how a store ends up with no real owner at all.

## Independent critique

The critique is written by a reviewer other than the deciding author, and it attacks the alternative
that was actually selected under all eight adverse paths: partial failure, retry and idempotency,
concurrency, stale state, deletion, recovery, dependency outage, and rollback.

Attacks aimed only at the rejected options are permitted as context but do not satisfy the
requirement. Restating why the losers lost is not a review of the winner.

## Blocked receipt

A blocked receipt has no decision. It contains one typed failure, the references involved, the owning
domain, retryability, and, only when retryable, a single-use resume token with the required material
delta and any surviving candidate alternatives.

## Failure codes

| Code | Owning issue | Valid material delta |
| --- | --- | --- |
| `INVALID_INPUT` | Closed input contract failed. | Corrected input. |
| `SOURCE_DRIFT` | The observed source no longer matches the frozen head. | Refreshed source binding. |
| `CURRENT_STATE_UNOBSERVED` | The system today could not be read at the frozen head. | A readable source observation. |
| `BUSINESS_AUTHORITY_REQUIRED` | The promise the architecture must keep is missing or stale. | The published business head. |
| `EVIDENCE_MISSING` | A claim about the system has no file behind it. | The observed evidence. |
| `CONSTRAINT_CONTRADICTION` | Two fixed constraints cannot both hold. | The owner's resolution. |
| `NO_VIABLE_ALTERNATIVE` | Nothing survives the frozen constraints. | A relaxed constraint, or a new alternative. |
| `ALTERNATIVE_CHOICE_REQUIRED` | Several alternatives remain material. | The owner's choice of one candidate. |
| `COMPATIBILITY_UNVERIFIED` | A retained component has no compatibility evidence. | The compatibility check and its evidence. |
| `DATA_OWNERSHIP_UNASSIGNED` | A store has no owning boundary. | The ownership decision. |
| `CRITIQUE_UNRESOLVED` | An attack on the selected architecture has no resolution. | The resolution, or a different selection. |
| `APPROVAL_REQUIRED` | The selection policy needs an approval that was never bound. | The approval reference. |
| `NO_PROGRESS` | A resume adds no effective delta. | Materially new evidence, constraint, inventory, or approval. |

`ALTERNATIVE_CHOICE_REQUIRED` is the expected outcome when two designs are genuinely different and
neither dominates. It is owned by product authority, and deciding again after the choice is bound is
the correct next step.

## Cross-field invariants

- `outcome="decided"` requires `receipt.status="decided"`, a non-null decision, null `failure`, null
  `resume`, and no open error finding.
- `outcome="blocked"` requires `receipt.status="blocked"`, a null decision, and a typed failure. A
  retryable failure requires a resume; a non-retryable failure forbids one.
- `receipt.evidenceRefs` and `output.evidenceRefs` are the same set, and every artifact reference stays
  under `artifactRootRef`.
- The current state was observed at `binding.sourceHead`, and `binding.currentStateFingerprint` equals
  its fingerprint.
- The comparison artifact is an inspectable HTML page, and the comparison, current state, stack model,
  and critique are all registered in `artifactRefs`.
- Exactly one alternative is selected and equals `selectedAlternativeId`; at least one is rejected with
  a reason; a selected alternative carries no rejection reason; every alternative is assessed on
  exactly the bound trade-off axes, each axis once.
- Under `approval-required`, the selected alternative equals the approved alternative; under
  `automatic`, no approved alternative is bound.
- Boundary and store identifiers are unique; every boundary referenced by a store exists; the owning
  boundary writes its store; more than one writer requires a shared-write justification, and one writer
  forbids it; a boundary owning data owns a store, and one owning no data owns none.
- Every stack component identifier is unique; none is justified by incumbency; a retained component is
  verified across all five compatibility axes with evidence; a removed component carries no verdict.
- The critique reviewer differs from the decision author, every attack names a known alternative, and
  all eight adverse paths attack the selected alternative.
- No affected contract reference names an implementation file.
- `handoff` is always `null`.

## Practical outcomes

Decide one entitlement read path: the current state records three boundaries deriving the same answer
independently, three alternatives are compared on correctness, consistency, operability, latency, and
migration, the shared boundary is selected and the per-feature guards and edge-cached claims are
rejected with reasons, the entitlement store gains one owning writer while the settlement ledger keeps
a justified second writer, change capture is added with verified compatibility, the removed cache
carries no verdict, and the critique attacks the selected boundary under all eight adverse paths.

Decide the same objective when two alternatives survive the constraints: the invocation returns
`ALTERNATIVE_CHOICE_REQUIRED` with both candidates and the rendered comparison, and no boundary, store,
or component is bound.
